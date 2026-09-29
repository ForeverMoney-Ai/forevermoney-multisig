# ForeverMoney Multi-sig

Private source handoff for https://safe.forevermoney.ai on Bittensor Finney (EVM chain 964).

## Layout

- `frontend/`: complete customised Safe Wallet workspace snapshot extracted from the working build container, including web/mobile/shared packages and upstream licences. This is the working source, not a generated site.
- `infrastructure/`: deployment tooling, UI overrides, branding assets, configuration generators, tests and operating documentation.
- `transaction-builder/`: patched standalone Safe React Apps checkout used by the deployed embedded builder. Do not confuse it with the newer builder workspace included upstream in `frontend/apps/tx-builder`.
- `deployment-inventory.json`: image references and replica counts observed in production on 29 September 2026, after the move to the MIT backend releases. No secret values.
- `DEPLOYMENT.md`: original-machine paths, namespace and publication procedure.

## Start on the Mac mini

```sh
gh repo clone forevermoney-ai/forevermoney-multisig
cd forevermoney-multisig
```

Read this README and DEPLOYMENT.md first. The source is self-contained, but credentials and running Docker containers do not transfer with a Git clone. Kubernetes access must be supplied separately and securely. Nothing in this repository should be deployed merely to bootstrap local development.

For frontend work, enter `frontend/`, use the Node version in `.nvmrc` and the Yarn version in `package.json`, then install with `corepack enable` and `yarn install --immutable`. Read its AGENTS.md and web workspace guidance. The Dockerfile is also included as a starting point for reproducing its dependency environment. Production builds have used Node 24 in the existing Docker container.

## Continuous delivery

The root GitHub Actions workflow builds the wallet and embedded Transaction Builder from clean source, runs deployment and browser smoke checks, and deploys successful `main` commits to the existing Hetzner Kubernetes application stack. See [ci/README.md](ci/README.md) for managed services, runtime configuration, credentials, rollout and rollback behavior.

The frontend source of truth for CI is `frontend/`; the older overlay scripts below are retained for historical local workflows. CI uses the bundled subnet metadata snapshot and does not depend on a developer machine or pre-existing container.

## Existing build tooling

`infrastructure/deploy/preview-branding.sh multisig` historically operates on a **pre-existing** Docker container named `forevermoney-brand-preview`, with this frontend at `/app`. It does not create that environment from scratch on a fresh machine: its fallback references old local images/containers. Provision a new build environment from `frontend/` before using it, or adapt the script deliberately.

The actual override copy list is `infrastructure/deploy/apply-address-overrides.sh`; the companion mapping is `infrastructure/deploy/ui-overrides/paths.json`. New override files need both. Existing customised source is already present in `frontend/`. Avoid accidentally replacing it with an unmodified upstream checkout.

The subnet metadata import script currently references the original machine's separate ForeverMoney checkout at `/Users/creatorbid/Documents/development/forevermoney`. Adapt that path on the Mac mini or use the bundled `infrastructure/deploy/assets/metadata/` snapshot.

Transaction Builder's legacy build script expects `infrastructure/artifacts/safe-react-apps` and a dedicated container. Its source is now at `transaction-builder/`; adapt the script or create that local link before rebuilding. The source snapshot corresponds to upstream commit `e8cccfb9a1042fa2954087988bae59c3b8c81780` plus the existing local patches.

Environment templates in `infrastructure/container_env_files/*.env.example` are **upstream defaults, not production configuration**. Copy to the corresponding ignored `.env` names only when intentionally configuring a local stack. Do not regenerate the live deployment with template defaults.

## Provenance and scope

This is an initial source snapshot, not a recreation of upstream Git histories. Infrastructure originated at https://github.com/safe-global/safe-infrastructure.git; frontend at https://github.com/safe-global/safe-wallet-monorepo; standalone builder at https://github.com/safe-global/safe-react-apps. The exact frontend upstream commit was not available in the working container; do not invent one. All supplied upstream licence files are retained; this repository does not relicense components. Backend services are referenced by image and managed by infrastructure scripts; their separate source repositories are not vendored here.

Excluded: private keys, kubeconfigs, runtime secrets, database dumps, generated deployment manifests containing secrets, local operational reports, dependency directories and built exports. Original directories and production were not changed by this repository handoff.
