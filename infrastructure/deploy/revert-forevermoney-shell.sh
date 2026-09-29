#!/bin/sh
# Restore the exact HTML/assets referenced immediately before the brand-shell trial.
set -eu
cd "$(dirname "$0")/.."
archive=artifacts/ui-before-forevermoney-shell-html.tar.gz
test -s "$archive"
# Existing immutable hashed assets are deliberately retained on the UI volume.
kubectl --kubeconfig="$HOME/.kube/bg-staging.yaml" -n bittensor-safe exec -i deploy/ui -- tar -xzf - -C /usr/share/nginx/html < "$archive"
printf '%s\n' 'Previous Safe UI restored. Refresh the browser.'
