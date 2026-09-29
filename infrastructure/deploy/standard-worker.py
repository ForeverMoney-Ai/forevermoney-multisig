"""RPC pacing for the unmodified upstream Celery tasks; no indexing logic here."""
from gevent import monkey
monkey.patch_all()
import os
import requests
from gevent import sleep
from gevent.lock import Semaphore
from pacer import RpcPacer

pacer = RpcPacer(requests.Session.send, Semaphore(), sleep=sleep,
                 interval=float(os.environ.get('RPC_INTERVAL_SECONDS', '5')))
requests.Session.send = lambda session, request, **kwargs: pacer(session, request, **kwargs)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
import django
django.setup()
from django.core.management import call_command
call_command('check_chainid_matches')
from safe_transaction_service.history.indexers import SafeEventsIndexerProvider, Erc20EventsIndexerProvider
# Paid historical worker uses upstream adaptive windows: shrink on errors and
# recover after fast successful reads. Live worker retains its existing setting.
for provider in (SafeEventsIndexerProvider, Erc20EventsIndexerProvider):
    provider().block_auto_process_limit = os.environ.get('RPC_ADAPTIVE_WINDOWS', '0') == '1'
from config.celery_app import app
app.worker_main(['worker', '--pool=gevent', '--loglevel=info', '--concurrency='+os.environ.get('CELERYD_CONCURRENCY','3'),
                 '--prefetch-multiplier=1', '--without-heartbeat', '--without-gossip',
                 '--without-mingle', '-E', '-Q', os.environ['WORKER_QUEUES']])
