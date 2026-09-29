"""Deploy tested static exports and the tracked application stack; preserve stateful services."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
K = ['kubectl', '-n', 'bittensor-safe']
STATEFUL = {'postgres', 'redis'}


def kubectl(*args, **kwargs):
    return subprocess.run(K + list(args), check=True, **kwargs)


def objects(path):
    return json.loads(path.read_text())['items']


def validate(items):
    for obj in items:
        if obj['kind'] not in {'Deployment', 'Service', 'Ingress', 'ConfigMap', 'CronJob'}:
            raise ValueError('Unexpected managed resource kind')
        if obj['metadata']['namespace'] != 'bittensor-safe':
            raise ValueError('Unexpected namespace')
        if obj['metadata']['name'] in STATEFUL:
            raise ValueError('Stateful resources must not be updated by application deployment')


def archive(source, target, chunks):
    with tarfile.open(target, 'w:gz') as tar:
        for file in sorted(source.rglob('*')):
            if file.is_symlink():
                raise ValueError('Build export contains a symlink')
            if file.is_file() and (file.relative_to(source).parts[0] == '_next') == chunks:
                tar.add(file, arcname=str(file.relative_to(source)), recursive=False)


def upload(path):
    with path.open('rb') as stream:
        kubectl('exec', '-i', 'deploy/ui', '--', 'tar', '-xzf', '-', '-C', '/usr/share/nginx/html', stdin=stream)


def check_public(sha):
    for path in ('/', '/home', '/balances', '/tx-builder/', '/tx-builder/manifest.json', '/cgw/v1/chains/964'):
        with urllib.request.urlopen('https://safe.forevermoney.ai' + path, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError('Public route failed: ' + path)
    with urllib.request.urlopen('https://safe.forevermoney.ai/release.json', timeout=30) as response:
        if json.load(response)['commit'] != sha:
            raise RuntimeError('Public release does not match tested commit')


def main():
    sha = os.environ['GITHUB_SHA']
    if len(sha) != 40 or any(c not in '0123456789abcdef' for c in sha):
        raise ValueError('Expected full commit SHA')
    items = objects(ROOT / 'ci/kubernetes/code-config.json') + objects(ROOT / 'ci/kubernetes/applications.json')
    sources = json.loads((ROOT / 'ci/config-sources.json').read_text())
    for obj in items:
        if obj['kind'] == 'ConfigMap':
            obj['data'] = {key: (ROOT / path).read_text() for key, path in sources[obj['metadata']['name']].items()}
    validate(items)
    settings = json.loads((ROOT / 'ci/runtime-settings.json').read_text())
    # A configuration change must restart consumers, including subPath-mounted nginx.
    config_hash = hashlib.sha256(json.dumps([[obj for obj in items if obj['kind'] == 'ConfigMap'], settings], sort_keys=True).encode()).hexdigest()
    for obj in items:
        if obj['kind'] == 'Deployment':
            obj['spec']['template']['metadata'].setdefault('annotations', {})['forevermoney.ai/config-hash'] = config_hash
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        desired = temp / 'desired.json'
        desired.write_text(json.dumps({'apiVersion': 'v1', 'kind': 'List', 'items': items}))
        kubectl('apply', '--dry-run=server', '-f', str(desired), stdout=subprocess.DEVNULL)
        for name, values in settings.items():
            kubectl('patch', 'configmap', name, '--type=merge', '--dry-run=server', '-p', json.dumps({'data': values}), stdout=subprocess.DEVNULL)
        if '--check' in sys.argv:
            print('Cluster accepted the application manifests (dry run only).')
            return
        previous_settings = {}
        for name, values in settings.items():
            current = json.loads(subprocess.check_output(K + ['get', 'configmap', name, '-o', 'json']))['data']
            previous_settings[name] = {key: current.get(key) for key in values}
        before = []
        for obj in items:
            current = json.loads(subprocess.check_output(K + ['get', obj['kind'], obj['metadata']['name'], '-o', 'json']))
            current.pop('status', None)
            for field in ('managedFields', 'resourceVersion', 'uid', 'creationTimestamp', 'generation'):
                current['metadata'].pop(field, None)
            before.append(current)
        rollback = temp / 'rollback.json'
        rollback.write_text(json.dumps({'apiVersion': 'v1', 'kind': 'List', 'items': before}))
        backup = temp / 'ui-before.tar.gz'
        with backup.open('wb') as stream:
            kubectl('exec', 'deploy/ui', '--', 'tar', '-czf', '-', '-C', '/usr/share/nginx/html', '.', stdout=stream)
        site = ROOT / 'ci/output/web'
        builder = ROOT / 'ci/output/builder'
        for required in (site / 'index.html', builder / 'index.html', site / 'assets/metadata/subnets.json'):
            if not required.is_file():
                raise RuntimeError('Missing release file: ' + str(required))
        shutil.copytree(builder, site / 'tx-builder', dirs_exist_ok=True)
        (site / 'release.json').write_text(json.dumps({'commit': sha}))
        with tarfile.open(backup) as saved:
            old_paths = {str(Path(member.name)) for member in saved if member.isfile()}
        added_paths = [str(path.relative_to(site)) for path in site.rglob('*') if path.is_file() and path.relative_to(site).parts[0] != '_next' and str(path.relative_to(site)) not in old_paths]
        chunks, pages = temp / 'chunks.tar.gz', temp / 'pages.tar.gz'
        archive(site, chunks, True)
        archive(site, pages, False)
        try:
            upload(chunks)
            upload(pages)
            for name, values in settings.items():
                kubectl('patch', 'configmap', name, '--type=merge', '-p', json.dumps({'data': values}), stdout=subprocess.DEVNULL)
            kubectl('apply', '-f', str(desired))
            for obj in items:
                if obj['kind'] == 'Deployment':
                    kubectl('rollout', 'status', 'deploy/' + obj['metadata']['name'], '--timeout=300s')
            check_public(sha)
            subprocess.run([sys.executable, str(ROOT / 'infrastructure/deploy/tx-builder/check-routes.py'), 'https://safe.forevermoney.ai'], check=True)
        except BaseException:
            print('Deployment failed; restoring application configuration and previous site.', flush=True)
            for name, values in previous_settings.items():
                kubectl('patch', 'configmap', name, '--type=merge', '-p', json.dumps({'data': values}), stdout=subprocess.DEVNULL)
            kubectl('apply', '-f', str(rollback))
            kubectl('rollout', 'status', 'deploy/ui', '--timeout=300s')
            upload(backup)
            for offset in range(0, len(added_paths), 100):
                kubectl('exec', 'deploy/ui', '--', 'rm', '-f', '--', *['/usr/share/nginx/html/' + path for path in added_paths[offset:offset + 100]])
            for obj in before:
                if obj['kind'] == 'Deployment':
                    kubectl('rollout', 'status', 'deploy/' + obj['metadata']['name'], '--timeout=300s')
            raise
        print('Verified full application release ' + sha)


if __name__ == '__main__':
    main()
