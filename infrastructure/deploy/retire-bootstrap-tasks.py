"""Disable temporary rescans only once normal L2/token indexing is caught up."""
from django.db import transaction
from django.conf import settings
from django_celery_beat.models import PeriodicTask
from safe_transaction_service.history.models import SafeMasterCopy
from safe_eth.eth import EthereumClient
from safe_transaction_service.history.services.index_service import IndexServiceProvider
head = EthereumClient(settings.ETHEREUM_NODE_URL).w3.eth.block_number
masters = list(SafeMasterCopy.objects.filter(l2=True).values_list('tx_block_number', flat=True))
assert masters and min(masters) >= head - 10, (head, masters)
assert IndexServiceProvider().get_erc20_721_current_indexing_block_number() >= head - 10
with transaction.atomic():
    for name in ('Bootstrap live Safe discovery (all addresses)', 'Bootstrap live token events (all discovered Safes)'):
        task = PeriodicTask.objects.get(name=name)
        task.enabled = False
        task.save(update_fields=['enabled'])
        print('DISABLED', name)
print('HEAD', head, 'NORMAL_L2_CHECKPOINT', min(masters))
