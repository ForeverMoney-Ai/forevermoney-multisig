#!/usr/bin/env python3
"""Restore a private snapshot into disposable, network-isolated local Postgres.

No cluster writes, published ports, persistent test volumes or live DB restores.
Usage: python3 deploy/verify-backup.py /absolute/path/to/snapshot
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid


def main():
    os.umask(0o077)
    snapshot = Path(sys.argv[1]).resolve(strict=True)
    manifest = json.loads((snapshot / 'manifest.json').read_text())
    for name, expected in manifest['files'].items():
        if Path(name).name != name:
            raise SystemExit('Invalid manifest filename')
        data = (snapshot / name).read_bytes()
        if len(data) != expected['bytes'] or hashlib.sha256(data).hexdigest() != expected['sha256']:
            raise SystemExit('Snapshot checksum mismatch: ' + name)
    container = 'safe-restore-' + uuid.uuid4().hex[:12]
    image = 'postgres@sha256:029660641a0cfc575b14f336ba448fb8a75fd595d42e1fa316b9fb4378742297'

    def run(args, stdin=None):
        result = subprocess.run(['docker'] + args, stdin=stdin, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=120)
        if result.returncode:
            raise RuntimeError('Isolated restore check failed; no live database changed')
        return result.stdout.decode().strip()

    results = {}
    try:
        run(['run', '-d', '--name', container, '--network', 'none', '--memory', '512m',
             '--cpus', '1', '--tmpfs', '/var/lib/postgresql/data:rw,size=256m',
             '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image])
        for _ in range(40):
            result = subprocess.run(['docker', 'exec', container, 'pg_isready', '-U', 'postgres'],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
            if result.returncode == 0:
                break
            time.sleep(.5)
        else:
            raise RuntimeError('Isolated Postgres did not become ready')
        for database in ('txs', 'cfg', 'cgw'):
            run(['exec', container, 'createdb', '-U', 'postgres', database])
            with (snapshot / (database + '.dump')).open('rb') as source:
                run(['exec', '-i', container, 'pg_restore', '-U', 'postgres', '-d', database,
                     '--no-owner', '--no-acl', '--exit-on-error'], stdin=source)
            query = "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
            results[database] = {'tables': int(run(['exec', container, 'psql', '-U', 'postgres',
                                                   '-d', database, '-Atc', query]))}
        results['txs']['safes'] = int(run(['exec', container, 'psql', '-U', 'postgres', '-d',
                                         'txs', '-Atc', 'SELECT count(*) FROM history_safecontract']))
        evidence = {'verified_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'image': image, 'restored': results,
                    'scope': 'Checksums and full DB restore; roles and cluster restore not tested.'}
        (snapshot / 'restore-verification.json').write_text(json.dumps(evidence, indent=2) + '\n')
        print(json.dumps(evidence))
    finally:
        subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=30)


if __name__ == '__main__':
    main()
