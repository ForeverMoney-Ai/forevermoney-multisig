#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
kubectl --kubeconfig="$HOME/.kube/bg-staging.yaml" -n bittensor-safe exec -i deploy/ui -- tar -xzf - -C /usr/share/nginx/html < artifacts/ui-before-frontend-rpc-html.tar.gz
