#!/bin/sh
# Local-only build. This script deliberately has NO deployment or cluster commands.
set -eu
cd "$(dirname "$0")/.."
mode=${1:-multisig}
case "$mode" in safe|multisig) ;; *) echo 'Use: sh deploy/preview-branding.sh safe|multisig' >&2; exit 2;; esac
container=forevermoney-brand-preview
if ! docker container inspect "$container" >/dev/null 2>&1; then
  docker commit safe-finney-shield-export forevermoney-brand-baseline:local >/dev/null
  docker run -d --name "$container" --memory 5g --cpus 2 --entrypoint sh forevermoney-brand-baseline:local -c 'sleep infinity' >/dev/null
fi
docker start "$container" >/dev/null
docker cp deploy/branding/mode.cjs "$container:/tmp/branding-mode.cjs"
docker cp deploy/assets/forevermoney "$container:/tmp/forevermoney-assets"
# Restore before re-applying current functional overrides; save a fresh baseline.
docker exec "$container" node /tmp/branding-mode.cjs safe /app/apps/web /tmp/forevermoney-assets
docker exec "$container" rm -f /app/apps/web/.forevermoney-brand-baseline.json
sh deploy/apply-address-overrides.sh "$container"
docker exec "$container" node /tmp/branding-mode.cjs "$mode" /app/apps/web /tmp/forevermoney-assets
docker exec "$container" sh -c 'cd /app/apps/web && yarn tsc --noEmit --incremental false --pretty false && yarn build'
out="artifacts/branding-$mode"
mkdir -p "$out"
docker cp "$container:/app/apps/web/out/." "$out/"
python3 deploy/brand-mobile.py "$out"
python3 deploy/branding/postprocess.py "$out" "$mode"
python3 deploy/import-forevermoney-metadata.py
mkdir -p "$out/assets/metadata"
cp -R artifacts/metadata/. "$out/assets/metadata/"
# The embedded builder is a separate upstream app; copy after wallet metadata processing.
if [ -d artifacts/tx-builder-build ]; then
  mkdir -p "$out/tx-builder"
  cp -R artifacts/tx-builder-build/. "$out/tx-builder/"
fi
echo "Local $mode preview ready: $out (not deployed)"
