"""Bounded governance history backfill with request-level RPC throttling."""
import json
import time
from urllib.parse import urlsplit


class RpcPacer:
    def __init__(self, send, lock, sleep=time.sleep, clock=time.monotonic, interval=15):
        self.send, self.lock, self.sleep, self.clock = send, lock, sleep, clock
        self.interval, self.next_request = interval, 0

    def __call__(self, session, request, **kwargs):
        # Pace either supported archive provider; never pace unrelated services.
        host = urlsplit(request.url).hostname or ''
        if not (host.endswith('.onfinality.io') or host == 'archive.chain.opentensor.ai'):
            return self.send(session, request, **kwargs)
        with self.lock:
            try:
                payload = json.loads(request.body or '{}')
                weight = max(1, len(payload)) if isinstance(payload, list) else 1
            except (ValueError, TypeError):
                weight = 1
            for attempt in range(5):
                self.sleep(max(0, self.next_request - self.clock()))
                self.next_request = self.clock() + self.interval * weight
                response = self.send(session, request, **kwargs)
                limited = response.status_code == 429
                if response.status_code == 200:
                    try:
                        data = response.json()
                        entries = data if isinstance(data, list) else [data]
                        limited = any(isinstance(e, dict) and e.get('error', {}).get('code') in (-32029, -32004) for e in entries)
                    except ValueError:
                        pass
                if not limited:
                    return response
                try:
                    retry_after = float(response.headers.get('Retry-After', 0))
                except (ValueError, TypeError):
                    retry_after = 0
                delay = max(120 * 2 ** attempt, retry_after)
                response.close()
                self.next_request = max(self.next_request, self.clock() + delay)
                print('RPC_RATE_LIMIT wait_seconds=', delay, 'attempt=', attempt + 1, flush=True)
            raise RuntimeError('Archive RPC remains rate limited; stopping without skipping history')


def run():
    import requests
    from gevent import sleep
    from gevent.lock import Semaphore
    from safe_transaction_service.history.services import IndexServiceProvider
    pacer = RpcPacer(requests.Session.send, Semaphore(), sleep=sleep)
    def send(session, request, **kwargs):
        return pacer(session, request, **kwargs)
    requests.Session.send = send
    s = IndexServiceProvider()
    addresses = ['0xADF60fcC63217961c931d57f1dCE2C5d70Af3546']
    stop = 9122933
    for phase, start, method in [('SAFE', 9081169, s.reindex_master_copies), ('TOKEN', 8786146, s.reindex_erc20_events)]:
        print('PHASE_START', phase, start, stop, flush=True)
        for lo in range(start, stop + 1, 1000):
            hi = min(lo + 999, stop)
            n = method(min(lo, hi - 1), to_block_number=hi, block_process_limit=1000, addresses=addresses)
            print('CHECKPOINT', phase, hi, 'events', n, flush=True)
        if phase == 'SAFE':
            s.reprocess_addresses(addresses)
        print('PHASE_COMPLETE', phase, flush=True)
    print('BACKFILL_COMPLETE through=', stop, flush=True)

if __name__ == '__main__':
    run()
