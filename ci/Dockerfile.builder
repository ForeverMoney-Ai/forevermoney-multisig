FROM node:18-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ git && rm -rf /var/lib/apt/lists/*
WORKDIR /src
ENV HUSKY=0 CYPRESS_INSTALL_BINARY=0 GENERATE_SOURCEMAP=false
COPY transaction-builder/ ./
RUN yarn install --frozen-lockfile --non-interactive
RUN CI=true yarn workspace tx-builder test --watchAll=false --runInBand
RUN yarn workspace tx-builder build
RUN cp LICENSE.md apps/tx-builder/build/LICENSE.md
FROM scratch AS export
COPY --from=build /src/apps/tx-builder/build/ /
