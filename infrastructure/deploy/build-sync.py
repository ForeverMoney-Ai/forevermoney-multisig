"""Generate namespace-scoped follower resources; no credentials in output."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
data = {
    'continuous_sync.py': (root / 'continuous-sync.py').read_text(),
    'pacer.py': (root / 'paced-backfill.py').read_text().split('\ndef run():')[0],
}
template = json.loads((root / 'governance-token-fixed.json').read_text())['spec']['template']['spec']
template['restartPolicy'] = 'Always'
template['terminationGracePeriodSeconds'] = 60
template['volumes'] = [{'name': 'sync-code', 'configMap': {'name': 'governance-sync-code'}}]
c = template['containers'][0]
c['name'] = 'sync'
c['envFrom'] = [e for e in c.get('envFrom', []) if e.get('secretRef', {}).get('name') != 'archive-rpc']
c['env'] = [e for e in c.get('env', []) if e['name'] not in ('SYNC_RPC_INTERVAL_SECONDS', 'SYNC_POLL_SECONDS', 'ETHEREUM_NODE_URL')]
c['env'] += [{'name': 'ETHEREUM_NODE_URL', 'value': 'https://archive.chain.opentensor.ai'}]
c['env'] += [{'name': 'SYNC_RPC_INTERVAL_SECONDS', 'value': '1'}, {'name': 'SYNC_POLL_SECONDS', 'value': '6'}]
c['command'] = ['python', 'manage.py', 'shell', '-c', "import sys; sys.path.insert(0, '/sync'); from continuous_sync import main; main()"]
c['volumeMounts'] = [{'name': 'sync-code', 'mountPath': '/sync', 'readOnly': True}]
c['readinessProbe'] = {'exec': {'command': ['python', '-c', "import json,time; d=json.load(open('/tmp/sync-health.json')); assert 0<=time.time()-d['checked_at']<90 and 0<=d['head_lag']<=6"]}, 'initialDelaySeconds': 30, 'periodSeconds': 15, 'timeoutSeconds': 5}
objects = [
    {'apiVersion': 'v1', 'kind': 'ConfigMap', 'metadata': {'name': 'governance-sync-code', 'namespace': 'bittensor-safe'}, 'data': data},
    {'apiVersion': 'apps/v1', 'kind': 'Deployment', 'metadata': {'name': 'governance-sync', 'namespace': 'bittensor-safe'},
     'spec': {'replicas': 0, 'strategy': {'type': 'Recreate'}, 'selector': {'matchLabels': {'app': 'governance-sync'}},
              'template': {'metadata': {'labels': {'app': 'governance-sync'}, 'annotations': {'checksum/code': hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()}}, 'spec': template}}},
]
(root / 'continuous-sync.json').write_text(json.dumps({'apiVersion': 'v1', 'kind': 'List', 'items': objects}, indent=2)+'\n')
