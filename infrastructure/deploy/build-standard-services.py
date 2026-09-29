"""Restore upstream worker and scheduler, without changing other workloads."""
import copy
import json
import hashlib
from pathlib import Path

root = Path(__file__).parent
resources = json.loads((root / 'manifests.json').read_text())['items']
code = {'standard-worker.py': (root / 'standard-worker.py').read_text(),
        'pacer.py': (root / 'paced-backfill.py').read_text().split('\ndef run():')[0]}
out = [{'apiVersion':'v1','kind':'ConfigMap','metadata':{'name':'standard-worker-runtime','namespace':'bittensor-safe'},'data':code}]
for name in ('txs', 'worker', 'worker-live', 'scheduler'):
    source = 'worker' if name == 'worker-live' else name
    d = copy.deepcopy(next(x for x in resources if x['kind'] == 'Deployment' and x['metadata']['name'] == source))
    d['metadata']['name'] = name
    d['spec']['selector']['matchLabels']['app'] = name
    d['spec']['template']['metadata']['labels']['app'] = name
    d['spec']['replicas'] = 1
    c = d['spec']['template']['spec']['containers'][0]
    c['envFrom'] = [e for e in c['envFrom'] if e.get('secretRef', {}).get('name') != 'archive-rpc']
    values = {e['name']: e for e in c.get('env', [])}
    for key, value in {
        'ETH_EVENTS_BLOCK_PROCESS_LIMIT': '500' if name == 'worker' else '1000',
        'ETH_EVENTS_BLOCK_PROCESS_LIMIT_MAX': '500' if name == 'worker' else '1000',
        'ETH_EVENTS_GET_LOGS_CONCURRENCY': '1',
        'RUN_MIGRATIONS': '0',
    }.items():
        values[key] = {'name': key, 'value': value}
    values['ETHEREUM_NODE_URL'] = {
        'name': 'ETHEREUM_NODE_URL',
        'valueFrom': {'secretKeyRef': {'name': 'archive-rpc', 'key': 'ETHEREUM_NODE_URL'}},
    }
    c['env'] = list(values.values())
    if name in ('worker','worker-live'):
        queues = 'indexing' if name == 'worker' else 'live-indexing,default,processing,contracts,tokens,notifications,webhooks'
        c['env'] = [e for e in c['env'] if e['name'] not in ('WORKER_QUEUES','RPC_INTERVAL_SECONDS','RPC_ADAPTIVE_WINDOWS')]
        c['env'] += [{'name':'WORKER_QUEUES','value':queues},
                     {'name':'RPC_INTERVAL_SECONDS','value':'0.1' if name == 'worker' else '1'},
                     {'name':'RPC_ADAPTIVE_WINDOWS','value':'1' if name == 'worker' else '0'}]
        c['command'] = ['python', '/runtime/standard-worker.py']
        c['volumeMounts'] = [{'name':'runtime','mountPath':'/runtime','readOnly':True}]
        d['spec']['template']['spec']['volumes'] = [{'name':'runtime','configMap':{'name':'standard-worker-runtime'}}]
        d['spec']['template']['metadata']['annotations'] = {'checksum/runtime':hashlib.sha256(json.dumps(code,sort_keys=True).encode()).hexdigest()}
    out.append(d)
(root / 'standard-services.json').write_text(json.dumps({'apiVersion': 'v1', 'kind': 'List', 'items': out}, indent=2)+'\n')
