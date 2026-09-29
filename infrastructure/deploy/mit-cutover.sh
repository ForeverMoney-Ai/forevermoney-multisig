#!/bin/sh
# Move backends to the last MIT releases (pre-17-Feb-2026). Rehearsed locally on
# 2026-09-29 against production dumps. Phases: ui | backend | verify.
# Each phase changes PRODUCTION except verify. Run only with explicit approval.
set -eu
cd "$(dirname "$0")/.."
K() { kubectl --kubeconfig "$HOME/.kube/bg-staging.yaml" -n bittensor-safe "$@"; }
D=artifacts/mit-cutover
TXS='ghcr.io/safe-global/safe-transaction-service:v5.42.1@sha256:5d177ed215decd3525c5757358076a88d24941ca54e2ee8c5afe80f52179b3d6'
CFG='safeglobal/safe-config-service:v2.91.0@sha256:ec5ac71cce837a1030773590022a5a61afe1b3d065199e8edc21487f5a0edad3'
CGW='safeglobal/safe-client-gateway-nest:v1.101.0@sha256:b8bf3dc3ebc4a905a5a4b24cad0fad68395b75b2b6d754807ebd6b3c38e3ce7a'
WORKERS='worker worker-live scheduler'

ui() {
  # Chain config via /v1/chains; works on both cgw v1.110.0 and v1.101.0. Chunks first, pages after.
  K exec -i deploy/ui -- tar -xzf - -C /usr/share/nginx/html < $D/ui-v1chains-chunks.tar.gz
  K exec -i deploy/ui -- tar -xzf - -C /usr/share/nginx/html < $D/ui-v1chains-pages.tar.gz
  curl -fsS https://safe.forevermoney.ai/balances | grep -q '_app-271dfdd781c4bade.js' && echo 'UI: new build live'
}

backend() {
  ts=$(date +%Y%m%d-%H%M)
  umask 077
  for db in txs cfg cgw; do K exec deploy/postgres -- pg_dump -U postgres -Fc $db > $D/$db-precutover-$ts.dump; done
  K get deploy -o yaml > $D/deployments-precutover-$ts.yaml
  for w in $WORKERS; do echo "$w $(K get deploy $w -o jsonpath='{.spec.replicas}')"; done > $D/replicas-$ts.txt
  cat $D/replicas-$ts.txt
  for w in $WORKERS; do K scale deploy/$w --replicas=0; done
  for w in $WORKERS; do K wait --for=delete pod -l app=$w --timeout=180s || true; done

  # Reverse post-cut-off migrations using the CURRENT (newer) images.
  K exec deploy/txs -- python manage.py migrate history 0100_safelaststatus_module_guard_safestatus_module_guard
  K exec deploy/txs -- python manage.py migrate account_abstraction 0005_alter_safeoperation_module_address_and_more
  K exec deploy/txs -- python manage.py migrate safe_messages 0006_remove_contract_signatures
  K exec deploy/cfg -- sh -c 'cd /app/src && python manage.py migrate chains 0047_chain_zk'
  for i in 1 2 3 4 5 6 7; do
    K exec deploy/cgw -- node ./node_modules/typeorm/cli -d ./dist/src/config/entities/orm.config.js migration:revert
  done
  max=$(K exec deploy/postgres -- psql -U postgres -d cgw -Atc 'select max(timestamp) from _migrations')
  [ "$max" = 1755621780124 ] || { echo "cgw migrations at $max, expected 1755621780124; stopping" >&2; exit 1; }

  K set image deploy/cfg cfg=$CFG
  K set image deploy/cgw cgw=$CGW
  K set image deploy/txs txs=$TXS
  K set image deploy/address-resolver address-resolver=$TXS
  K set image deploy/governance-sync sync=$TXS
  K set image deploy/worker worker=$TXS
  K set image deploy/worker-live worker=$TXS
  K set image deploy/scheduler scheduler=$TXS
  for d in cfg cgw txs address-resolver; do K rollout status deploy/$d --timeout=600s; done

  # Redis is cache + Celery broker only (--save ''); drop v6 tasks and cached v1.110 responses.
  K exec deploy/redis -- redis-cli FLUSHALL
  while read -r w n; do K scale deploy/$w --replicas=$n; done < $D/replicas-$ts.txt
  for w in $WORKERS; do K rollout status deploy/$w --timeout=600s; done
  verify
}

verify() {
  K get deploy -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,IMAGE:.spec.template.spec.containers[*].image'
  K exec deploy/cgw -- sh -c 'echo "cgw $APPLICATION_VERSION"'
  K exec deploy/cfg -- sh -c 'echo "cfg $APPLICATION_VERSION"'
  K exec deploy/txs -- python manage.py migrate --check >/dev/null && echo 'txs: no unapplied migrations'
  for p in /cgw/v1/chains /cgw/v1/chains/964 /cgw/v1/chains/964/safes/0xadf60fcc63217961c931d57f1dce2c5d70af3546 \
           /cgw/v1/chains/964/safes/0xadf60fcc63217961c931d57f1dce2c5d70af3546/transactions/history /balances; do
    printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "https://safe.forevermoney.ai$p")" "$p"
  done
}

case "${1:-}" in ui|backend|verify) "$1";; *) echo 'Use: sh deploy/mit-cutover.sh ui|backend|verify' >&2; exit 2;; esac
