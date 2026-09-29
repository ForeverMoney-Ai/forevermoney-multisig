"""Repair only the missing singleton metadata left by the initial address-only bootstrap.
No nonce, owner, signature, execution or checkpoint is modified.
"""
from django.db import transaction
from django.conf import settings
from safe_eth.eth import EthereumClient
from safe_eth.eth.contracts import get_proxy_factory_V1_4_1_contract
from safe_transaction_service.history.models import InternalTxDecoded, SafeStatus, SafeLastStatus
from web3.logs import DISCARD
address='0xADF60fcC63217961c931d57f1dCE2C5d70Af3546'
zero='0x0000000000000000000000000000000000000000'
w=EthereumClient(settings.ETHEREUM_NODE_URL).w3
assert w.eth.chain_id==964
setup=InternalTxDecoded.objects.select_related('internal_tx').get(safe_address=address,function_name='setup')
r=w.eth.get_transaction_receipt(setup.internal_tx.ethereum_tx_id)
events=get_proxy_factory_V1_4_1_contract(w).events.ProxyCreation().process_receipt(r,errors=DISCARD)
e=[x for x in events if x['args']['proxy']==address and x['address']=='0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67']
assert len(e)==1
singleton=e[0]['args']['singleton']
assert singleton=='0x29fcB43b46531BcA003ddC8FCB67FFE91900C762'
assert w.eth.get_storage_at(address,0)[-20:].hex()==singleton[2:].lower()
with transaction.atomic():
    setup=InternalTxDecoded.objects.select_for_update().select_related('internal_tx').get(pk=setup.pk)
    assert setup.internal_tx.to in (zero,singleton)
    setup.internal_tx.to=singleton
    setup.internal_tx.save(update_fields=['to'])
    historical=SafeStatus.objects.filter(address=address,master_copy=zero).update(master_copy=singleton)
    latest=SafeLastStatus.objects.filter(address=address,master_copy=zero).update(master_copy=singleton)
print('REPAIRED_SINGLETON_METADATA',historical,latest,'SINGLETON',singleton)
