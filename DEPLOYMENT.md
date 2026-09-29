# ForeverMoney Multi-sig — repository and deployment map

Prepared 29 September 2026. This document describes locations and deployment mechanics only.

## Local repositories

### Safe infrastructure and customisations — primary working directory

`/Users/creatorbid/Documents/development/bittensor-safe-infra`

Git origin currently points to `https://github.com/safe-global/safe-infrastructure.git` (the upstream infrastructure repository, not a private ForeverMoney destination).

Most project-specific work lives in `deploy/`. At the last check, `deploy/` and several scripts were untracked, and `.gitignore` was modified. The local filesystem therefore contains work that is not represented by upstream Git history. Preserve it before reorganising anything; inspect `git status` first.

Important locations relative to this repository:

| Path | Purpose |
|---|---|
| `deploy/ui-overrides/` | Custom frontend source files |
| `deploy/ui-overrides/paths.json` | Mapping of overrides to frontend source locations |
| `deploy/apply-address-overrides.sh` | Actual copy commands that apply overrides to the frontend build container; update this as well as the mapping when adding a file |
| `deploy/preview-branding.sh` | Local frontend build/export entry point |
| `deploy/branding/` | Reversible branding mode, postprocessing, and documentation |
| `deploy/assets/forevermoney/` | Brand assets |
| `deploy/import-forevermoney-metadata.py` | Subnet metadata/artwork import |
| `deploy/tx-builder/` | Separately built embedded Transaction Builder, patch/build/registration scripts |
| `deploy/generate.py` | Baseline Kubernetes manifest generator |
| `deploy/seed-config.py` | Initial chain configuration |
| `deploy/build-standard-services.py` | Worker/runtime deployment configuration |
| `deploy/build-resolver.py` | Address resolver deployment configuration |
| `deploy/telegram-monitor/` | Sync monitoring deployment |
| `deploy/trusted-batches/` | Additional runtime configuration installer and documentation |
| `deploy/check-*` | Focused validation scripts and tests |
| `artifacts/` | Local exports, build logs, previews and rollback archives; not a source repository |

The baseline generator is not a complete representation of later live configuration. Inspect current cluster resources and the additional deployment scripts before applying it.

### Main ForeverMoney product repository

`/Users/creatorbid/Documents/development/forevermoney`

Git origin: `git@github.com:creatorbid/forevermoney.git`

This is the main ForeverMoney product, not the Safe infrastructure repository. It is also the source of shared branding/subnet assets. Follow the metadata import script to locate its current asset folders.

### Transaction Builder source checkout

`/Users/creatorbid/Documents/development/bittensor-safe-infra/artifacts/safe-react-apps`

The build script pins commit `e8cccfb9a1042fa2954087988bae59c3b8c81780`. See `deploy/tx-builder/README.md` and `build.sh` for its separate build process.

## Frontend source and build environment

The customised upstream Safe frontend is built inside Docker:

- Container: `forevermoney-brand-preview`
- Upstream workspace root in container: `/app`
- Web app: `/app/apps/web`
- Web source: `/app/apps/web/src`
- Next.js static export: `/app/apps/web/out`

The frontend is a monorepo workspace. The surrounding backend services are separate upstream projects, assembled by the infrastructure repository.

Run from the infrastructure repository:

```sh
sh deploy/preview-branding.sh multisig
```

This restores the branding baseline, applies local source overrides, applies the selected branding mode, runs TypeScript checking and the frontend build, exports files, and applies metadata/postprocessing. It does **not** deploy.

Output:

`/Users/creatorbid/Documents/development/bittensor-safe-infra/artifacts/branding-multisig`

The script also supports `safe` branding mode. Read `deploy/branding/README.md` before switching modes.

Local preview helpers used during development:

- `artifacts/preview-branding.py` — preview on port 8772.
- `artifacts/preview-alpha-e2e.py` — signing-disabled test fixture on port 8774.

Check whether these servers are running before starting another. The E2E fixture is test-only and must never be published with production assets.

## Production deployment

- Public domain: `https://safe.forevermoney.ai`
- Network: Bittensor Finney EVM, chain ID `964`
- Kubernetes kubeconfig: `/Users/creatorbid/.kube/bg-staging.yaml`
- Namespace: `bittensor-safe`
- Despite the kubeconfig filename, this namespace serves the public site.

Read-only inventory:

```sh
kubectl --kubeconfig "$HOME/.kube/bg-staging.yaml" -n bittensor-safe get deployments,services,pods,pvc
```

Deployment names observed:

`ui`, `cgw`, `cfg`, `txs`, `worker`, `worker-live`, `scheduler`, `postgres`, `redis`, `address-resolver`, `governance-sync`.

A deployment existing does not imply it is actively running; check replica counts.

### Frontend serving

- Deployment: `ui`
- Nginx listens on port `8080`.
- Static root: `/usr/share/nginx/html`
- Static files are held on PVC `ui`.
- Nginx configuration: ConfigMap `ui-nginx`, mounted at `/etc/nginx/nginx.conf` using `subPath`.
- ConfigMap changes require a pod restart to refresh that subPath mount.

Routes include:

- `/cgw/` → Client Gateway
- `/txs/api/` → Transaction Service
- `/address-resolver/` → address resolver
- `/tx-builder/` → separately built static embedded app
- Other page paths → static frontend export

Inspect the live nginx configuration for all current routes; do not overwrite it using an older baseline.

### Frontend publication pattern

1. Build and verify the local export.
2. Back up current mutable production files and record existing `_next` chunks.
3. Package and upload newly generated immutable chunks first.
4. Upload matching HTML/JSON page files afterwards.
5. Retain previous chunks so older sessions and rollback page references keep working.
6. Verify public HTML and changed chunks against the tested export, and run route checks.

Uploads have used archive extraction through `kubectl exec -i deploy/ui -- tar -xzf - -C /usr/share/nginx/html`. Only use an archive deliberately prepared from the tested export. Do not upload the whole artifacts directory.

Recent examples of local packaging and backup artifacts:

- `artifacts/package-alpha-shield.py`
- `artifacts/alpha-shield-chunks.tar.gz`
- `artifacts/alpha-shield-pages.tar.gz`
- `artifacts/ui-before-alpha-shield.tar.gz`

These are historical examples, not necessarily the next release or its correct rollback target. Create a fresh backup for new work.

Builder route check:

```sh
python3 deploy/tx-builder/check-routes.py https://safe.forevermoney.ai
```

### Backend deployment and configuration

Backend images run as Kubernetes deployments. ConfigMaps and Secrets provide environment configuration; query deployed image references rather than assuming the baseline generator matches current production.

```sh
kubectl --kubeconfig "$HOME/.kube/bg-staging.yaml" -n bittensor-safe get deployments -o wide
```

After intentionally changing a service's environment configuration, roll out the relevant deployment and verify readiness. Preserve existing PVCs, databases, Secrets and unrelated namespace resources.

## Handling local material

- Do not include private keys, Kubernetes credentials, Secrets, database dumps, or raw configuration snapshots in a new repository or handover.
- Local `artifacts/` may contain sensitive operational snapshots. Inspect before sharing.
- Existing deployment documentation includes dated notes; use it for navigation and verify live state for current facts.
- No production changes are authorised merely by this location guide; follow the user's current instructions.
