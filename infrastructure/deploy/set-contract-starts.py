"""Run in the stopped-indexer maintenance window after archive boundary checks."""
from django.db import transaction
from safe_transaction_service.history.models import SafeMasterCopy, IndexingStatus

starts = {'0x3E5c63644E683549055b9Be8653de26E0B4CD36E': 4970425,
          '0xfb1bffC9d739B8D520DaF37dF666da4C687191EA': 5112613,
          '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762': 5125434}
with transaction.atomic():
    for address, first in starts.items():
        obj = SafeMasterCopy.objects.select_for_update().get(address=address, l2=True)
        obj.initial_block_number = first
        obj.tx_block_number = max(obj.tx_block_number, first)
        obj.save(update_fields=['initial_block_number','tx_block_number'])
    token = IndexingStatus.objects.select_for_update().get(indexing_type=0)
    token.block_number = max(token.block_number, min(starts.values()))
    token.save(update_fields=['block_number'])
print('Verified deployment starts installed; no indexed history was reset.')
