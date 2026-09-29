import importlib.util
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import io
import json
import os

spec = importlib.util.spec_from_file_location('deploy', Path(__file__).with_name('deploy.py'))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeploymentSafety(unittest.TestCase):
    def test_rejects_state_and_cross_namespace_resources(self):
        for kind, name, namespace in [('Secret', 'cfg', 'bittensor-safe'), ('Deployment', 'postgres', 'bittensor-safe'), ('Deployment', 'redis', 'bittensor-safe'), ('Deployment', 'ui', 'default')]:
            with self.subTest(kind=kind, name=name, namespace=namespace), self.assertRaises(ValueError):
                deploy.validate([{'kind': kind, 'metadata': {'name': name, 'namespace': namespace}}])

    def test_tracked_resources_are_application_only(self):
        for path in Path(__file__).parent.joinpath('kubernetes').glob('*.json'):
            deploy.validate(deploy.objects(path))

    def test_chunks_are_separate_from_mutable_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'site'
            (source / '_next').mkdir(parents=True)
            (source / '_next/a.js').write_text('chunk')
            (source / 'index.html').write_text('page')
            for chunks, expected in [(True, ['_next/a.js']), (False, ['index.html'])]:
                target = root / 'out.tar.gz'
                deploy.archive(source, target, chunks)
                with tarfile.open(target) as archive:
                    self.assertEqual(archive.getnames(), expected)

    def test_symlinks_cannot_enter_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'site'
            source.mkdir()
            (source / 'secret').symlink_to('/etc/passwd')
            with self.assertRaises(ValueError):
                deploy.archive(source, root / 'out.tar.gz', False)

    def test_failed_health_check_restores_site_and_manifests(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'ci/kubernetes').mkdir(parents=True)
            ui = {'apiVersion': 'apps/v1', 'kind': 'Deployment', 'metadata': {'name': 'ui', 'namespace': 'bittensor-safe'}, 'spec': {'template': {'metadata': {}, 'spec': {'containers': [{'name': 'ui', 'image': 'nginx:1.28-alpine'}]}}}}
            (root / 'ci/kubernetes/applications.json').write_text(json.dumps({'items': [ui]}))
            (root / 'ci/kubernetes/code-config.json').write_text(json.dumps({'items': []}))
            (root / 'ci/config-sources.json').write_text('{}')
            (root / 'ci/runtime-settings.json').write_text('{}')
            for name in ['web/index.html', 'builder/index.html', 'web/assets/metadata/subnets.json', 'web/_next/new.js']:
                file = root / 'ci/output' / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('new')
            calls, uploads = [], []

            def fake_kubectl(*args, **kwargs):
                calls.append(args)
                if 'tar' in args and '-czf' in args:
                    with tarfile.open(fileobj=kwargs['stdout'], mode='w:gz') as saved:
                        info = tarfile.TarInfo('./index.html')
                        info.size = 3
                        saved.addfile(info, io.BytesIO(b'old'))

            with patch.object(deploy, 'ROOT', root), patch.dict(os.environ, {'GITHUB_SHA': 'a' * 40}), patch.object(deploy.sys, 'argv', ['deploy.py']), patch.object(deploy, 'kubectl', side_effect=fake_kubectl), patch.object(deploy.subprocess, 'check_output', return_value=json.dumps(ui).encode()), patch.object(deploy, 'upload', side_effect=lambda path: uploads.append(path.name)), patch.object(deploy, 'check_public', side_effect=RuntimeError('unhealthy')):
                with self.assertRaisesRegex(RuntimeError, 'unhealthy'):
                    deploy.main()
            self.assertEqual(uploads, ['chunks.tar.gz', 'pages.tar.gz', 'ui-before.tar.gz'])
            self.assertTrue(any(args[0] == 'apply' and str(args[-1]).endswith('rollback.json') for args in calls))
            self.assertTrue(any('rm' in args and '/usr/share/nginx/html/release.json' in args for args in calls))


if __name__ == '__main__':
    unittest.main()
