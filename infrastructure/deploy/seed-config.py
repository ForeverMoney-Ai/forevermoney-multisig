from chains import models
from chains.models import Chain, Wallet, Feature
# Version-tolerant: cfg v2.91.0 (MIT) has no vpc_rpc_uri, Service model or Feature.services.
chain_fields={f.name for f in Chain._meta.get_fields()}
Service=getattr(models,'Service',None)
defaults=dict(name='Bittensor',short_name='tao',description='Bittensor EVM mainnet',l2=True,is_testnet=False,rpc_authentication='NO_AUTHENTICATION',rpc_uri='https://lite.chain.opentensor.ai',safe_apps_rpc_uri='https://lite.chain.opentensor.ai',public_rpc_uri='https://lite.chain.opentensor.ai',vpc_rpc_uri='https://lite.chain.opentensor.ai',block_explorer_uri_address_template='https://evm.tao.app/address/{{address}}',block_explorer_uri_tx_hash_template='https://evm.tao.app/tx/{{txHash}}',block_explorer_uri_api_template='https://evm.tao.app/api?module={{module}}&action={{action}}&address={{address}}&apiKey={{apiKey}}',currency_name='TAO',currency_symbol='TAO',currency_decimals=18,currency_logo_uri='tao.png',transaction_service_uri='http://txs:8888',vpc_transaction_service_uri='http://txs:8888',recommended_master_copy_version='1.4.1',prices_provider_native_coin='bittensor',hidden=False)
c,_=Chain.objects.update_or_create(id=964,defaults={k:v for k,v in defaults.items() if k in chain_fields})
for key in ['metamask','rabby','detected','coinbase','ledger','trezor']:
 w,_=Wallet.objects.get_or_create(key=key);w.chains.add(c)
for key in ['MY_ACCOUNTS','CONTRACT_INTERACTION','ERC721','ERC1155','SAFE_APPS']:
 f,_=Feature.objects.get_or_create(key=key);f.chains.add(c)
 if Service and hasattr(f,'services'):
  for skey in ['WALLET_WEB','cgw']:
   svc,_=Service.objects.get_or_create(key=skey,defaults={'name':skey});f.services.add(svc)
print('Configured Bittensor chain',c.id)
