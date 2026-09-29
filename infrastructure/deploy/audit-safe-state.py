"""Read-only comparison of each discovered Safe's state against chain 964."""
import json,time
from django.conf import settings
from safe_eth.eth import EthereumClient
from safe_transaction_service.history.models import SafeLastStatus,SafeContract
from safe_transaction_service.history.services.index_service import IndexServiceProvider
w3=EthereumClient(settings.ETHEREUM_NODE_URL).w3
assert w3.eth.chain_id == 964
block=w3.eth.block_number
checks=[]
for row in SafeLastStatus.objects.all():
    result={"address":row.address}
    for method,abi_type,wanted in [('nonce()','uint256',row.nonce),('getThreshold()','uint256',row.threshold),('getOwners()','address[]',row.owners)]:
        data=w3.keccak(text=method)[:4]
        actual=w3.codec.decode([abi_type],w3.eth.call({'to':row.address,'data':data},block_identifier=block))[0]
        if method=='getOwners()':actual=sorted(a.lower() for a in actual);wanted=sorted(a.lower() for a in wanted)
        result[method]=actual==wanted
        time.sleep(.15)
    checks.append(result)
print('SAFE_STATE_AUDIT',json.dumps({'block':block,'registered':SafeContract.objects.count(),'checked':len(checks),'mismatches':[x for x in checks if not all(v for k,v in x.items() if k!='address')]}))
print('SYNC_STATUS',IndexServiceProvider().get_indexing_status())
