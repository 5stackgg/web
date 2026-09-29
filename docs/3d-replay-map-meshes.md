# Map assets: collision, grenade clips, view meshes and callouts

Every map the game-server nodes run gets four files, built straight from the
CS2 install and served by the panel's own Cloudflare worker
(`cloudflare-workers/backblaze-proxy` in 5stack-panel) out of the B2 bucket
`5stack`:

| asset | file | read by |
| --- | --- | --- |
| collision | `<map>.tri.gz` | demo parser (line of sight, smoke flood fill, grenade sim), 3D viewer fallback |
| grenade clips | `<map>.grenadeclip.tri.gz` (absent when the map has none) | demo parser grenade flight/drift sim |
| view mesh | `<map>.view.bin.gz` | 3D viewer (`components/match/Replay3DLite.vue`) |
| callouts | `<map>.callouts.json` | API (`public.map_callouts`), radar overlay, utility naming |

Nothing is pinned by hand any more: a job rebuilds all of it when a new CS2
build lands, and a pointer file tells every consumer where the newest files are.

## Layout on B2

```
https://demo-dl.5stack.gg/maps/latest.json                  mutable, cached 60 s
https://demo-dl.5stack.gg/maps/<build>/manifest.json        immutable (revision 1)
https://demo-dl.5stack.gg/maps/<build>/manifest.r<N>.json   immutable (a retry, N = 2, 3, …)
https://demo-dl.5stack.gg/maps/<build>/<map>.tri.gz
https://demo-dl.5stack.gg/maps/<build>/<map>.grenadeclip.tri.gz
https://demo-dl.5stack.gg/maps/<build>/<map>.view.bin.gz
https://demo-dl.5stack.gg/maps/<build>/<map>.callouts.json
https://demo-dl.5stack.gg/maps/<build>/r<N>/<map>.…         files first published by revision N
```

`latest.json` is `{ "version": 1, "build": "<build>", "manifest": "<build>/manifest.json" }`
(or `"<build>/manifest.r<N>.json"`). **Always follow its `manifest` field** —
never assume `<build>/manifest.json` is the newest word on a build.

The manifest names the key that holds each asset of each map — paths are
relative to `maps/` — plus the sha256 of each file's **uncompressed** bytes, and
which maps did not fully build:

```json
{ "version": 1, "build": "25537370", "revision": 2, "created_at": "...",
  "pipeline": { "sha256": "…", "source_viewer": "20.0.6980+a06886f…", "meshoptimizer": "1.1.1" },
  "failed": ["de_brand_new"],
  "failed_view": ["rush_001"],
  "maps": { "de_mirage": {
    "tri": "25537370/de_mirage.tri.gz",
    "grenadeclip": "25537370/de_mirage.grenadeclip.tri.gz",
    "view": "24957633/de_mirage.view.bin.gz",
    "callouts": "25537370/de_mirage.callouts.json",
    "sha256": { "tri": "…", "grenadeclip": "…", "view": "…", "callouts": "…" },
    "source": { "vpk_sha256": "…", "pipeline": "…" } } } }
```

- `revision` is only present from 2 up.
- `source` is what the entry was built from (see *Unchanged maps are not
  rebuilt* below); `pipeline` at the top is the run's own, with the versions
  spelled out.
- `failed`: maps whose collision or callouts failed to build. A map whose
  collision failed keeps its previous build's entry (or has none at all); one
  whose callouts failed ships new collision and its previous callouts.
- `failed_view`: maps whose view mesh failed. They ship collision, grenade
  clips and callouts as usual, with no `view` key, so the viewer falls back to
  the collision `.tri` for them.
- Both lists are left out when empty.

A key can point at an **older** build: a map Valve did not touch keeps the
entry it already has, and a rebuilt file identical to the one before keeps the
old key. A map missing an asset simply has no key for it. A map that is no
longer in the install is dropped from the next manifest.

`<build>` is the CS2 build id (`buildid` in `steamapps/appmanifest_730.acf`).
Everything under `maps/<build>/` — every manifest revision included — is
immutable: the worker serves it with `Cache-Control: public, max-age=2592000,
immutable` and caches it at the edge as long, and nothing ever overwrites it.
Only `maps/latest.json` moves; the worker gives it `public, max-age=60`, at the
edge and in the browser, and the publisher only ever moves it forwards.

> **⚠ Deploy the worker BEFORE the first publish.** A worker from before this
> change caches `latest.json` at the edge and in browsers as immutable for 30
> days the first time anybody reads it, and every later build would be
> invisible for a month. `./backblaze-proxy.sh` from `5stack-panel/`, then publish.

## How the consumers resolve a map

All three — the web viewer (`utilities/mapAssets.ts`), the demo parser
(`internal/geometry/load.go`) and the API (`utility-callouts.service.ts`) — do
the same thing:

1. **An explicit base wins.** `NUXT_PUBLIC_MAP_MESH_CDN` (web) / `MAP_MESH_CDN`
   (parser, API), or a per-request revision, pins every map to
   `<base>/<map>.tri.gz`, `<base>/<map>.callouts.json` etc., exactly as before
   the manifest existed.
2. **Otherwise** fetch `maps/latest.json` (cached ~10 minutes), then the
   manifest it names (immutable, cached per key), and use its keys.
3. **If `latest.json` is unreachable**, fall back to the last hand-published
   build, `24957633`.

Builds from before the manifest have no view mesh and no grenade clips, and a
map listed in `failed_view` has no view mesh: the viewer then draws the
collision `.tri` the old way and the parser simulates grenades without clips.

## The automatic job

`ghcr.io/5stackgg/map-assets` (built by `.github/workflows/map-assets.yml` from
`docker/map-assets/Dockerfile`: Node 24, Source2Viewer-CLI **20.0** linux-x64
pinned with its checksum, `scripts/`, and only `meshoptimizer` + `aws4fetch`).
The API launches it as a node-pinned k8s Job with the server files mounted
read-only when a new CS2 build lands (only on the `5stack.gg` install), records
the run in `map_asset_builds`, and has a manual trigger for admins. The job is
just:

```bash
node scripts/build-map-assets.mjs --cs2 /serverdata/serverfiles --build <id> --out /work --publish --only-maps <names>
```

`--only-maps` is every `name` in the API's `maps` table: an install map 5stack
does not know is treated as not installed, so it is never built and a base
manifest's entry for it (and any failure listed for it) is dropped.

with `S3_ACCESS_KEY` / `S3_SECRET` from the `s3-secrets` secret and emptyDirs at
`/work` and `/tmp`. Everything the run writes goes to one of those two: the
built files and manifest to `--out` (`MAP_ASSETS_OUT`, `/work` in the image),
and every Source2Viewer export and scratch directory to `TMPDIR`
(`os.tmpdir()`, `/tmp`) — the image runs with a read-only root filesystem.
It needs about **6 GiB of memory**, **~3 GB in `/tmp`** (rush_001's render
export alone is a 1.2 GB glb, deleted as soon as the map is done) and a few
hundred MB in `/work`, and takes ~2 minutes for rush_001 and a few seconds to
~15 s for a pool map.

> **⚠ The B2 key needs `listFiles`** as well as `readFiles`/`writeFiles`. B2
> answers a missing key with 403 rather than 404 when the key cannot list,
> which is also what a transient denial looks like; the publisher settles a
> 403 by listing the exact key, and if the listing is refused it aborts
> rather than guess that a key is free.

What `build-map-assets.mjs` does:

1. Reads the install's build id and refuses a `--build` that does not match it.
2. Reads the current `latest.json` + manifest **from B2 directly** (not through
   the worker's cache) and finds the newest manifest of this build — the one
   `latest.json` names if it is this build's, then any higher `manifest.r<N>`
   that exists; otherwise `manifest.json`, `manifest.r2.json`, … probed in turn.
3. Decides what to look at:
   - **no manifest for this build** — every eligible map in `game/csgo/maps/`
     (`de_`, `cs_`, `ar_`, `rush_`; never `_vanity` or `_night`; only those
     in `--only-maps` when given), or `--maps`;
   - **newest manifest lists no failures, nothing forced** — nothing: the
     build is done. It only moves `latest.json` to that manifest if an earlier
     run died before doing so, and exits 0;
   - **newest manifest lists failures, or `--force`/`--force-maps` names
     maps** — only those maps (intersected with `--maps`), as the next
     revision.

   Each of them is then fingerprinted, and one whose fingerprint matches
   the base manifest's entry is carried over without any work (below).
4. Per map: collision + grenade clips + view mesh (`extract-map-meshes.mjs`)
   and callouts (`extract-map-callouts.mjs`, written without `generatedAt` so
   the hash only changes when the callouts do). Only the collision can fail a
   map; anything on the view side — no render export, a nav that does not
   validate (then the floors come from collision, logged as `NAV REJECTED`),
   a mesh over budget — lands the map in `failed_view` instead.
5. Gzips each file and hashes the uncompressed bytes. A file whose hash matches
   the base manifest's entry reuses that key; maps not built this run carry
   over from the base, failure listings included.
6. HEAD-checks every new key and the new manifest's own key. A file key that
   exists is only accepted if its `x-amz-meta-sha256` (stored on every
   upload, by both publishers) matches — an interrupted run of the same
   revision — and anything B2 will not answer aborts before uploading.
7. Uploads the files, then the manifest (`manifest.json` for revision 1,
   `manifest.r<N>.json` for a retry, never over an existing one), then
   re-reads `latest.json` and moves it **last**, and only forwards: never to
   an older build, nor to an older revision of the same build.

A retry (or forced rebuild of a published build) that changes nothing
publishes nothing. A first run in which every map that needed building failed,
and none was unchanged, publishes nothing either — that is the tooling, not
the maps. A run in which every map is unchanged still publishes the build's
(small) manifest and moves `latest.json`, so `maps/<build>/manifest.json`
exists for every build the job has seen.

### Unchanged maps are not rebuilt

Before any Source2Viewer work, every map gets a fingerprint, stored in its
manifest entry as `source`:

- `vpk_sha256` — sha256 of `game/csgo/maps/<map>.vpk`. Geometry, nav and the
  entity lump all live in the map's own VPK, so the same VPK means the same
  inputs. Hashing is streamed and cheap: mirage, nuke and rush_001 (1 GB)
  hash in 0.5 s.
- `pipeline` — sha256 over the source of `build-map-assets.mjs` and every
  local module it imports, transitively (`lib-fingerprint.mjs` follows the
  imports, so a new `lib-*.mjs` is covered the moment it is imported), plus
  the Source2Viewer-CLI version (`--version`'s `Version:` line) and the
  meshoptimizer version. The macOS CLI and the linux image report the same
  version and hash the same scripts, so a local run and the job agree.

A map whose `source` equals the entry in the base manifest (the one
`latest.json` points at) and which that manifest does not list in `failed` or
`failed_view` is carried over verbatim — same keys, same sha256s, same
`source` — with no export, no build and no upload, logged as

```
de_mirage          unchanged (vpk e66cdf1ae6a9, pipeline a6b5472a9b48) -- reused 25537370/
```

Anything else is built as before, and the content dedupe still applies: a new
pipeline that produces identical files reuses the old keys and uploads
nothing. A CS2 update that touches no map therefore costs well under a second
and one manifest upload. `--force` rebuilds every map regardless, and
`--force-maps a,b` just those; on a build that is already published they
rebuild into the next revision (which is only published if something
changed).

**Exit codes** (the API records them):

| code | meaning |
| --- | --- |
| 0 | every map fully published, unchanged ones included (or the build already was) |
| 2 | published, but the manifest lists `failed` or `failed_view` maps — run it again to retry just those |
| 1 | fatal: nothing new was published (or the manifest went up but `latest.json` could not be moved; a re-run finishes it) |

## Running it by hand

Anywhere with a CS2 install (Source2Viewer-CLI is downloaded into `.cache/s2v/`
on first use; `CLI=<path>` overrides):

```bash
# build only -> .cache/map-assets/<build>/{raw,files}/ + manifest.json (or --out <dir>)
node scripts/build-map-assets.mjs --cs2 "/path/to/Counter-Strike Global Offensive"
node scripts/build-map-assets.mjs --cs2 <install> --maps de_mirage,rush_001

# rebuild regardless of fingerprints
node scripts/build-map-assets.mjs --cs2 <install> --force
node scripts/build-map-assets.mjs --cs2 <install> --force-maps de_nuke,rush_001

# every check a publish makes, uploading nothing
S3_ACCESS_KEY=… S3_SECRET=… node scripts/build-map-assets.mjs --cs2 <install> --publish --dry-run

# publish
S3_ACCESS_KEY=… S3_SECRET=… node scripts/build-map-assets.mjs --cs2 <install> --publish
```

Or the image itself:

```bash
docker run --rm --read-only --tmpfs /tmp:rw,exec,size=4g -v "$PWD/work:/work" \
  -v <install>:/serverdata/serverfiles:ro -e S3_ACCESS_KEY -e S3_SECRET \
  ghcr.io/5stackgg/map-assets:latest --cs2 /serverdata/serverfiles --publish
```

The live B2 key is the k8s secret, not `web/.dev.vars` (that one is dead):

```bash
export KUBECONFIG=~/.kube/5stackgg
export S3_ACCESS_KEY=$(kubectl -n 5stack get secret s3-secrets -o jsonpath='{.data.S3_ACCESS_KEY}' | base64 -d)
export S3_SECRET=$(kubectl -n 5stack get secret s3-secrets -o jsonpath='{.data.S3_SECRET}' | base64 -d)
```

Lower-level pieces, for debugging one map:

```bash
node scripts/extract-map-meshes.mjs de_mirage --cs2 <install> --out /tmp/meshes   # .tri, .grenadeclip.tri, .view.bin
node scripts/extract-map-callouts.mjs de_mirage --cs2 <install>                    # -> .cache/callouts/
node scripts/glb-to-tri.mjs <world_physics_physics.glb> out.tri
node scripts/publish-map-assets.mjs --build <id> [--dry-run]   # uploads .cache/meshes + .cache/callouts as-is,
                                                              # with the same x-amz-meta-sha256; writes no
                                                              # manifest and never moves latest.json
```

## Formats

### `.tri` and `.grenadeclip.tri`

A raw, header-less `float32` triangle soup: 9 floats (`p1.xyz p2.xyz p3.xyz`)
per triangle, 36 bytes each, in **CS2 source units, Z up** — the same space as
demo positions, so nothing needs calibrating.

The collision `.tri` is the physics hull (`maps/<map>/world_physics.vmdl_c`,
exported as `world_physics_physics.glb`) with every clip, sky and tool group
dropped. Its semantics must not change: the parser raycasts it for line of
sight, and every wall removed from it becomes a sightline and a smoke leak
(standalone-wall removal, `MESH_DROP_WALLS=1`, stays off for that reason).

`.grenadeclip.tri` is only the physics groups matching `grenadeclip`
(`physics_csgo_grenadeclip`, `…_grenadeclip_wood`, `…_metal`, …). Player and NPC
clips (`physics_npcclip_playerclip*`, `physics_playerclip`) let grenades
through and are not in it.

> **⚠ The physics export keeps mesh-local source units.** Its node matrices
> carry a 0.0254 inch→metre scale and an axis swap for glTF viewers;
> `glb-to-tri.mjs` skips them. A correct hull measures thousands of units.
> The render world below is the opposite.

> **⚠ The size cap is the consumer's.** The parser drops any mesh over 1.5M
> triangles or 96 MB and the viewer over 96 MB, silently — LOS then answers
> "visible" for everything. `MESH_MAX_MB` (default 40, ~1.1M triangles) is the
> budget; over it the soup is grid-snapped and deduped (`lib-mesh.mjs`).
> rush_001 is the one map that needs it (4.4M triangles → 1.07M).

### `.view.bin` (version 1)

The render world (`maps/<map>/world.vwrld_c`), simplified, with every vertex
knowing the height of the floor it stands over. Little-endian, source units,
Z up. Written by `scripts/lib-view-mesh.mjs` (`writeViewBin` / `readViewBin`).

```
Header (32 bytes)
  0   char[4]  "5SVM"
  4   u16      version = 1
  6   u16      chunkCount
  8   f32[3]   bboxMin
  20  f32[3]   bboxMax
Chunk table: chunkCount × 32 bytes
  0   char[16] name, UTF-8, NUL-padded
  16  u32      vertexCount
  20  u32      indexCount   (triangles × 3)
  24  u32      dataOffset   (from file start, 4-byte aligned)
  28  u32      reserved (0)
Chunk data at dataOffset, each section 4-byte aligned (zero padded):
  f32[vertexCount*3]  position
  f32[vertexCount]    floorZ   (NaN = no floor found)
  u8[vertexCount]     flags    bits 0-1: 0 solid, 1 foliage, 2 see-through
                               bit 2: floor found only in the wide search (outside playable space)
  u32[indexCount]     indices  (triangle list; winding not guaranteed, render double-sided)
```

Chunks: one `"world"` chunk on a normal map. A map with `cs_minimap_volume`
brushes (rush_001) gets one chunk per volume — named by `minimap_name`,
assigned by triangle centroid in the brush's XY box — plus `"world"` for
everything outside them. Empty chunks are left out (rush_001's `roomparty`
volume has no geometry in it). A name over 16 bytes keeps its first 11 bytes
plus `~` and four hex digits of its sha256 (`a_very_long~1389`), so it never
fails the write and always shortens the same way.

The viewer computes `h = z − floorZ` per fragment and discards `h > cut`: walls
trim to a consistent height above their local floor, roofs over playable space
vanish, and multi-level maps work because each vertex has its own floor.

How it is built:

- **Render export**: `Source2Viewer-CLI -i maps/<map>.vpk --vpk_filepath maps/<map>/world.vwrld_c -d --gltf_export_format glb`.
  Positions are metres, and **source (x, y, z) = (gltf.z, gltf.x, gltf.y) / 0.0254**
  after node matrices. Only positions are read, streamed per accessor
  (`lib-glb.mjs`) — the file is mostly UVs and tangents.
- **Classification by node name** (materials are not exported; aggregate names
  carry the material, `n0_lr0_agg_merge_<material>_N`). Dropped: light
  blockers (`blocklight`, `_bl_mesh`), decals and overlays, `additive`,
  `blocker`, `fog_card`, tool textures, sky/skybox props, clips, game-mode
  entity meshes (`^retake_`), and effect cards — `dust_<digits>` light shafts
  (mirage's `nomerge<N>_dust_002` are 700–1700u slanted sheets), light shafts,
  god rays, fog/haze/mist/smoke/steam. Foliage and see-through flags come from
  the name too (`tree|branch|leaf|palm|…` minus `bark|trunk|blend|ground`;
  `fence|grate|wire|glass|window|water|…` minus `shutter|sill|frame`).
- **Cleanup**: weld by exact position (`generatePositionRemap`), drop triangles
  farther than 2048u (XY) from every nav area, drop connected pieces under 12u.
- **Simplify** with meshoptimizer at 3u absolute error, borders locked. Over
  the 1M-triangle target (only rush_001 so far) it escalates: foliage is
  vertex-clustered (leaf cards are two-triangle pieces edge collapse cannot
  touch), then borders unlock except on vertices of walkable floors, then the
  error doubles. Over 1.5M triangles or 64 MB it fails rather than ship — the
  map then lands in `failed_view`, not in `failed`.
- **Tessellate** every edge over 256u (shared midpoints, no T-junctions) so
  `h` interpolates sanely along a wall spanning two floors.
- **floorZ**: the highest nav area at or below `z + 8` within 48u (XY) of the
  vertex; failing that the nearest one within 1024u, flagged outside; failing
  that NaN. Nav is `maps/<map>.nav` (v36.1 on every official map), parsed by
  `lib-nav.mjs`, which only accepts version 36 with exactly one area per
  polygon, found within 4 KB after the polygons (every real nav: 138–144
  bytes). Anything else — a truncated file "parses" to a one-area list by
  shape alone — throws `NavError`, and the floors come from collision
  instead: up-facing collision triangles no player clip covers. That trims
  *less* than the nav would, never more; the run logs `NAV REJECTED` for it,
  and a map with no nav at all takes the same path quietly.

Measured on build 25537370 (Apple M-series; the linux image produces
byte-identical files):

| map | render triangles | view triangles | view.bin raw → gz | .tri | build |
| --- | --- | --- | --- | --- | --- |
| de_mirage | 1.22M | 256k (3u) | 7.5 → 3.2 MB | 124k tris, 0.8 MB gz | 4 s |
| de_nuke | 3.56M | 649k (3u) | 17.1 → 5.4 MB | 175k tris, 1.0 MB gz | 13 s |
| rush_001 | 14.45M | 723k (6u, 20 chunks) | 18.2 → 6.2 MB | 1.07M tris, 4.9 MB gz | 104 s |

The same three maps on a later build with unchanged VPKs: 0.66 s end to end
(0.5 s of it hashing), no exports, one manifest upload.

### `.callouts.json`

`{ map, callouts: [{ name, boxes: [{ min: [x,y,z], max: [x,y,z] }] }] }` in
source units: the map's `env_cs_place` volumes, one entry per name (a place
can be several disjoint boxes). The standalone script also writes a
`generatedAt`; the published file does not.

It is stored gzipped with `Content-Encoding: gzip` and served as
`application/json`, which the edge re-compresses on its own. The meshes carry
their gzip in the file instead (`.gz`), because a Worker's `fetch`
decompresses a gzip subresponse and strips the header, and the edge does not
re-compress `application/octet-stream` — inferno came back 18.6 MB instead of
2.4 MB when that was tried.

To check an extract against the engine: `player_kills.attacker_location` is
the engine's own answer for the same entities, and `.callouts` in a practice
server dumps what the running level defines.

## Legacy

Before build 24957633 the meshes came from awpy's per-build packs and were
served from jsDelivr (`cdn.jsdelivr.net/gh/5stackgg/replay-map-meshes@<tag>`),
capped under its 20 MiB per-file limit. That path is retired;
`scripts/fetch-map-meshes.mjs` is kept only for it, and the demo parser's tests
still read their fixtures from the old `replay-map-meshes` repo.
