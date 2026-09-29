# Production delivery

GitHub Actions builds both applications from a fresh checkout on every pull request and push to main. Successful main builds deploy to the existing Hetzner Kubernetes namespace `bittensor-safe`. Pull requests and the CI setup branch never deploy.

## Managed application stack

`kubernetes/applications.json` is the desired state for UI, Client Gateway, Config Service, Transaction Service, indexing workers, scheduler, address resolver, the paused governance worker, monitoring CronJob, application Services and Ingress. Backend images are pinned by digest to the last MIT releases before Safe's 17 Feb 2026 relicence (transaction service v5.42.1, config service v2.91.0, client gateway v1.101.0); changing a backend image is a reviewed code change and must stay on pre-17-Feb releases. This pipeline issues no migrations: moving the live databases between backend versions is done once with `infrastructure/deploy/mit-cutover.sh backend`, and these pins must reach `main` only after that has run.

`config-sources.json` maps executable/routing ConfigMaps to their authoritative files. Make runtime code changes in those files. The frontend builds directly from `frontend/`, not from the legacy overlay scripts. The builder builds from `transaction-builder/`. Subnet metadata is bundled under `infrastructure/deploy/assets/metadata/`.

## Existing infrastructure and credentials

This is application delivery into the existing cluster, not a new-cluster bootstrap. Postgres, Redis, persistent volumes, cluster networking, TLS controller, existing service accounts, credentials in runtime ConfigMaps and Secrets stay in the cluster. Reviewed non-secret settings for `cfg`/`cgw`/`txs` live in `runtime-settings.json`; the deployer patches only those keys and preserves all other values. No database resets, deletes, migrations, or dependency upgrades are issued by the deployment script. Application entrypoints can have their own migration behavior; review it before changing backend image versions.

Install `kubernetes-access.json` once with administrator access. GitHub repository secret `DEPLOY_KUBECONFIG` must contain credentials for the `github-deploy` service account, not an administrator kubeconfig. The role can update named application deployments/configuration and execute in namespace pods for static file publication; it cannot update stateful deployments or read Secrets through the API. Pod execution is powerful: protect write access to main and workflow files. Configure credential rotation according to your cluster policy.

## Release and rollback

The existing UI volume is retained. New `_next` assets upload first, followed by matching pages and the separately tested builder. Existing chunks stay available to open browser sessions. A release marker records the commit. Kubernetes application/configuration changes follow and readiness plus public route checks gate success. Deployment jobs are serialized; main workflows are never cancelled mid-release.

Before mutation, the deployer saves current managed objects and the static site in the runner's temporary directory. A failure restores the prior configuration and site; the run stays failed. This automatic rollback is not a database rollback. For a deliberate later rollback, revert the relevant main commit and allow CI to rebuild/redeploy. Keep independent database backups.

## Validation

- Clean frontend installation, TypeScript check, alpha planner and Shield regression checks, static production build.
- Clean Transaction Builder installation, upstream tests, production build.
- Deployment safety unit tests and server-side dry run before mutation.
- Readiness for every managed Deployment, public application/API/builder routes, release SHA check.

Browser smoke checks render the account overview and assets using the built export with read-only production API requests, and check the embedded builder assets. These checks never sign/broadcast transactions. They do not cover wallet signing, builder batch submission, or execution on chain.
