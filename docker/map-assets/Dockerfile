# The map-assets job: builds every map's collision mesh, grenade clips, view
# mesh and callouts from a CS2 install and publishes them to B2 (see
# docs/3d-replay-map-meshes.md). Build from the web/ root:
#
#   docker build -f docker/map-assets/Dockerfile .
#
# The API runs it with only arguments, e.g.
#   --cs2 /serverdata/serverfiles --build <id> --out /work --publish
# with S3_ACCESS_KEY / S3_SECRET in the environment and emptyDirs at /work
# and /tmp: every file the run writes lands in one or the other, so the root
# filesystem can be read-only.
FROM node:24-bookworm-slim

# Pinned: a new Source2Viewer can change the glTF export (it already moved the
# physics group names from materials to meshes once), so the version moves by
# hand, with the checksum.
ARG S2V_VERSION=20.0
ARG S2V_SHA256=3e8af47cd6ce52e8068904f2aa1dda23c56a6b96a8310b25090f0711cda76a8a

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl unzip libicu72 \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/cli.zip \
    "https://github.com/ValveResourceFormat/ValveResourceFormat/releases/download/${S2V_VERSION}/cli-linux-x64.zip" \
  && echo "${S2V_SHA256}  /tmp/cli.zip" | sha256sum -c - \
  && mkdir -p /opt/s2v \
  && unzip -q /tmp/cli.zip -d /opt/s2v \
  && rm /tmp/cli.zip \
  && chmod +x /opt/s2v/Source2Viewer-CLI \
  && /opt/s2v/Source2Viewer-CLI --version

ENV CLI=/opt/s2v/Source2Viewer-CLI \
  MAP_ASSETS_OUT=/work \
  DOTNET_BUNDLE_EXTRACT_BASE_DIR=/tmp/dotnet-bundle

WORKDIR /opt/5stack

COPY docker/map-assets/package.json docker/map-assets/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY scripts/ ./scripts/

RUN node -e "import('./scripts/build-map-assets.mjs').then(() => import('./scripts/lib-fingerprint.mjs')).then((f) => console.log('meshoptimizer', f.meshoptimizerVersion(), 'Source2Viewer', f.sourceViewerVersion(process.env.CLI)))"

ENTRYPOINT ["node", "scripts/build-map-assets.mjs"]
