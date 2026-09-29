#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
# Source is pinned. Build tools and dependencies stay inside the dedicated container.
source=artifacts/safe-react-apps
commit=e8cccfb9a1042fa2954087988bae59c3b8c81780
[ "$(git -C "$source" rev-parse HEAD)" = "$commit" ]
container=forevermoney-tx-builder-build
# patch.py is applied to a clean checkout during initial setup; do not apply twice.
docker exec -e GENERATE_SOURCEMAP=false "$container" sh -c 'cd /src && yarn workspace tx-builder build'
docker exec -e CI=true "$container" sh -c 'cd /src && PATH=/tmp/tx-builder-node18/node_modules/.bin:$PATH yarn workspace tx-builder test --watchAll=false --runInBand'
mkdir -p artifacts/tx-builder-build
docker cp "$container:/src/apps/tx-builder/build/." artifacts/tx-builder-build/
cp "$source/LICENSE.md" artifacts/tx-builder-build/LICENSE.md
