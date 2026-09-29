#!/usr/bin/env python3
"""Private, manual recovery snapshot. Does not change cluster resources.

This is an off-cluster copy on this Mac, not unattended off-site backup coverage.
Restore into an isolated environment before relying on any new backup process.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess


def main():
    os.umask(0o077)
    root = Path.home() / '.kube/bittensor-safe-backups'
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if root.is_symlink() or root.stat().st_mode & 0o077:
        raise SystemExit('Backup directory must be private (0700) and not a symlink')
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    destination = root / ('manual-' + timestamp)
    partial = root / ('.manual-' + timestamp + '.partial')
    partial.mkdir(mode=0o700)
    kube = ['kubectl', '--kubeconfig=' + str(Path.home() / '.kube/bg-staging.yaml'),
            '-n', 'bittensor-safe']

    def capture(name, arguments):
        path = partial / name
        with path.open('xb') as output:
            # Do not print command stderr: it may contain connection details.
            result = subprocess.run(kube + arguments, stdout=output,
                                    stderr=subprocess.PIPE, timeout=180)
            output.flush()
            os.fsync(output.fileno())
        if result.returncode or not path.stat().st_size:
            raise RuntimeError('Backup failed for ' + name + '; private partial snapshot retained')
        return path

    for database in ('txs', 'cfg', 'cgw'):
        path = capture(database + '.dump', ['exec', 'deploy/postgres', '--',
                       'pg_dump', '-U', 'postgres', '-Fc', database])
        with path.open('rb') as dump:
            if dump.read(5) != b'PGDMP':
                raise RuntimeError('Invalid dump header for ' + database)
    capture('roles.sql', ['exec', 'deploy/postgres', '--',
                         'pg_dumpall', '-U', 'postgres', '--roles-only'])
    resources = ('deployments,statefulsets,services,ingresses,certificates,issuers,'
                 'persistentvolumeclaims,configmaps,secrets,networkpolicies,'
                 'resourcequotas,limitranges,serviceaccounts,cronjobs')
    config = capture('k8s-private.json', ['get', resources, '-o', 'json'])
    contents = json.loads(config.read_text())
    if not contents.get('items'):
        raise RuntimeError('Empty Kubernetes recovery configuration')
    files = {}
    for path in partial.iterdir():
        files[path.name] = {'bytes': path.stat().st_size,
                            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    (partial / 'manifest.json').write_text(json.dumps({
        'created_utc': timestamp, 'namespace': 'bittensor-safe', 'files': files,
        'notes': ['Databases dumped sequentially; not a cross-database atomic snapshot.',
                  'Kubernetes export includes secrets. Never commit or publish.',
                  'This snapshot has not yet undergone a full restore test.']
    }, indent=2) + '\n')
    partial.rename(destination)
    print(json.dumps({'backup': str(destination), 'files': len(files),
                      'bytes': sum(f['bytes'] for f in files.values())}))


if __name__ == '__main__':
    main()
