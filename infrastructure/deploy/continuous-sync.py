"""Follow finalized Bittensor blocks for the explicitly bootstrapped Safe.

Uses upstream event decoders/processors, but owns a separate durable checkpoint.
This does not claim that the global Safe factory index has been backfilled.
"""
import json
import logging
import os
import time
from pathlib import Path

ADDRESS = '0xADF60fcC63217961c931d57f1dCE2C5d70Af3546'
BOOTSTRAP = 9122933
LOCK_ID = 964141


def next_window(checkpoint, finalized, limit=1000):
    if finalized < checkpoint:
        raise ValueError('RPC finalized height is behind the saved checkpoint')
    return None if finalized == checkpoint else (checkpoint + 1, min(checkpoint + limit, finalized))


def main():
    import requests
    import psycopg
    from gevent import sleep
    from gevent.lock import Semaphore
    from django.conf import settings
    from django.db import connection, transaction
    from safe_transaction_service.history.indexers import Erc20EventsIndexerProvider, SafeEventsIndexerProvider
    from safe_transaction_service.history.services import IndexServiceProvider
    from safe_transaction_service.history.models import InternalTxDecoded
    from pacer import RpcPacer

    # Ensure neither library exceptions nor provider URLs leak the API key.
    class Redact(logging.Filter):
        def filter(self, record):
            record.msg = record.getMessage().replace(settings.ETHEREUM_NODE_URL, '[archive-rpc]')
            record.args = ()
            if record.exc_info:
                record.exc_info = None
                record.exc_text = None
            return True
    for handler in logging.getLogger().handlers:
        handler.addFilter(Redact())

    interval = float(os.environ.get('SYNC_RPC_INTERVAL_SECONDS', '15'))
    poll_seconds = float(os.environ.get('SYNC_POLL_SECONDS', '60'))
    if not (0.5 <= interval <= 60 and 1 <= poll_seconds <= 300):
        raise ValueError('Invalid sync pacing configuration')
    pacer = RpcPacer(requests.Session.send, Semaphore(), sleep=sleep, interval=interval)
    requests.Session.send = lambda session, request, **kw: pacer(session, request, **kw)
    service = IndexServiceProvider()
    w3 = service.ethereum_client.w3
    if w3.eth.chain_id != 964:
        raise RuntimeError('Wrong chain; refusing to index')

    # A dedicated unpooled session owns the lock; ORM connection recycling must
    # never silently release it while this follower continues running.
    lock_connection = psycopg.connect(os.environ['DATABASE_URL'].replace('psql://', 'postgresql://', 1), autocommit=True)
    if not lock_connection.execute('SELECT pg_try_advisory_lock(%s)', [LOCK_ID]).fetchone()[0]:
        raise RuntimeError('Another governance follower holds the lock')
    with connection.cursor() as cursor:
        cursor.execute('''CREATE TABLE IF NOT EXISTS fm_governance_sync (
            address TEXT PRIMARY KEY, block_number BIGINT NOT NULL,
            block_hash TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())''')
        cursor.execute('SELECT block_number FROM fm_governance_sync WHERE address=%s', [ADDRESS])
        needs_seed = cursor.fetchone() is None
    if needs_seed:
        # BOOTSTRAP is backed by completed SAFE and TOKEN jobs, not a guessed head.
        block_hash = w3.eth.get_block(BOOTSTRAP)['hash'].hex()
        with connection.cursor() as cursor:
            cursor.execute('INSERT INTO fm_governance_sync(address,block_number,block_hash) VALUES (%s,%s,%s)',
                           [ADDRESS, BOOTSTRAP, block_hash])

    failures = 0
    while True:
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT block_number,block_hash FROM fm_governance_sync WHERE address=%s', [ADDRESS])
                checkpoint, anchor = cursor.fetchone()
            finalized = w3.eth.get_block('finalized')['number']
            if w3.eth.get_block(checkpoint)['hash'].hex() != anchor:
                # Do not silently delete or accept history after an unexpected finalized reorg.
                raise RuntimeError('Saved finalized block hash changed; manual recovery required')
            window = next_window(checkpoint, finalized)
            if window:
                lo, hi = window
                expected_hash = w3.eth.get_block(hi)['hash'].hex()
                safe = SafeEventsIndexerProvider.get_new_instance()
                token = Erc20EventsIndexerProvider.get_new_instance()
                safe.IGNORE_ADDRESSES_ON_LOG_FILTER = False
                safe.block_auto_process_limit = token.block_auto_process_limit = False
                safe_events = safe.find_relevant_elements({ADDRESS}, lo, hi)
                token_events = token.find_relevant_elements({ADDRESS}, lo, hi)
                if w3.eth.get_block(hi)['hash'].hex() != expected_hash:
                    raise RuntimeError('Block changed during scan; checkpoint not advanced')
                # Upstream writes are idempotent. Do not hold an outer database
                # transaction across throttled network calls: that exceeds the
                # database idle-in-transaction timeout. Advance progress only
                # after both stages and decoded-transaction processing succeed.
                safe.process_elements(safe_events)
                token.process_elements(token_events)
                service.process_decoded_txs_for_safe(ADDRESS)
                if InternalTxDecoded.objects.filter(safe_address=ADDRESS, processed=False).exists():
                    raise RuntimeError('Unprocessed Safe transactions; checkpoint not advanced')
                lock_connection.execute('SELECT 1')
                with transaction.atomic():
                    with connection.cursor() as cursor:
                        cursor.execute('UPDATE fm_governance_sync SET block_number=%s,block_hash=%s,updated_at=now() WHERE address=%s',
                                       [hi, expected_hash, ADDRESS])
                checkpoint = hi
                print('SYNC_COMMIT', lo, hi, 'safe_events', len(safe_events), 'token_events', len(token_events), flush=True)
            # Compare against a fresh live tip, not just the head observed before
            # the scan. This makes readiness reflect actual current lag.
            latest = w3.eth.block_number
            if latest < checkpoint:
                raise RuntimeError('RPC live tip is behind committed progress')
            state = dict(checkpoint=checkpoint, finalized=finalized, lag=finalized-checkpoint,
                         latest=latest, head_lag=latest-checkpoint, checked_at=time.time())
            Path('/tmp/sync-health.json').write_text(json.dumps(state))
            print('SYNC_STATUS', json.dumps(state), flush=True)
            failures = 0
            if checkpoint == finalized:
                sleep(poll_seconds)
        except Exception as exc:
            failures += 1
            # A lost DB session also loses the lock: exit instead of reconnecting unlocked.
            if lock_connection.closed or lock_connection.broken:
                raise RuntimeError('Lock session lost; restarting follower') from None
            print('SYNC_ERROR', type(exc).__name__, str(exc).replace(settings.ETHEREUM_NODE_URL, '[archive-rpc]')[:250], 'consecutive', failures, flush=True)
            if failures >= 5:
                raise RuntimeError('Follower stopped after repeated errors; checkpoint preserved') from None
            sleep(min(120 * 2 ** (failures - 1), 900))


if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
    import django
    django.setup()
    main()
