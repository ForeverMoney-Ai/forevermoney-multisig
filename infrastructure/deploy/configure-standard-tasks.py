"""Schedule upstream tasks for recent blocks while historical catch-up proceeds.

Keep the original backfill checkpoints: these extra tasks do not mark history
complete. Remove the bootstrap schedules once full historical indexing catches up.
"""
import json
from django.db import transaction
from django_celery_beat.models import IntervalSchedule, PeriodicTask
from safe_eth.eth import EthereumClient

head = EthereumClient('https://archive.chain.opentensor.ai').w3.eth.block_number
with transaction.atomic():
    interval, _ = IntervalSchedule.objects.get_or_create(every=30, period='seconds')
    first, _ = PeriodicTask.objects.get_or_create(
        name='Bootstrap live Safe discovery (all addresses)',
        defaults=dict(task='safe_transaction_service.history.tasks.reindex_master_copies_task',
                      interval=interval, queue='live-indexing', expire_seconds=30,
                      kwargs=json.dumps({'from_block_number':max(0,head-10)}), enabled=True))
    start = json.loads(first.kwargs)['from_block_number']
    PeriodicTask.objects.get_or_create(
        name='Bootstrap live token events (all discovered Safes)',
        defaults=dict(task='safe_transaction_service.history.tasks.reindex_erc20_events_task',
                      interval=interval, queue='live-indexing', expire_seconds=30,
                      kwargs=json.dumps({'from_block_number':start}), enabled=True))
    for t in PeriodicTask.objects.filter(task='safe_transaction_service.history.tasks.process_decoded_internal_txs_task'):
        t.interval=interval; t.crontab=None; t.enabled=True; t.expire_seconds=30
        t.save()
print('STANDARD_LIVE_TASKS_START',start,'HISTORY_CHECKPOINTS_UNCHANGED')
