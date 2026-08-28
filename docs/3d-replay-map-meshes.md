# Map assets: collision meshes (`.tri.gz`) and callouts (`.callouts.json`)

Both are built from the CS2 install the game-server nodes already run, and both
are served by the panel's own Cloudflare worker
(`cloudflare-workers/backblaze-proxy`) out of B2:

```
https://demo-dl.5stack.gg/maps/<cs2 build>/<map>.tri.gz
https://demo-dl.5stack.gg/maps/<cs2 build>/<map>.callouts.json
```

## Building them (in-cluster — nothing to install locally)

The `inventory-backend` pod already mounts the dedicated-server install at
`/cs2-game` and already has Source2Viewer-CLI and Node:

```bash
export KUBECONFIG=~/.kube/5stackgg
P=$(kubectl -n 5stack get pod -l app=inventory-backend -o name | head -1)
kubectl -n 5stack cp scripts/ 5stack/${P#pod/}:/cs2-models/.work/callouts/scripts

kubectl -n 5stack exec ${P#pod/} -- sh -c '
  cd /cs2-models/.work/callouts
  export CLI=/cs2-models/.work/cs2-model-extract/cli/Source2Viewer-CLI CS2_DIR=/cs2-game
  node scripts/extract-map-meshes.mjs
  node scripts/extract-map-callouts.mjs'
```

Stream the results back (`kubectl cp` truncates on directories this size — it
gave a silent short read once already, so tar and verify):

```bash
kubectl -n 5stack exec ${P#pod/} -- tar cf - -C /cs2-models/.work/callouts/.cache/meshes . > /tmp/m.tar
rm -rf .cache/meshes && mkdir -p .cache/meshes && tar xf /tmp/m.tar -C .cache/meshes
```

## Publishing

```bash
export S3_ACCESS_KEY=$(kubectl -n 5stack get secret s3-secrets -o jsonpath='{.data.S3_ACCESS_KEY}' | base64 -d)
export S3_SECRET=$(kubectl -n 5stack get secret s3-secrets -o jsonpath='{.data.S3_SECRET}' | base64 -d)
node scripts/publish-map-assets.mjs --build <cs2 build> --dry-run
node scripts/publish-map-assets.mjs --build <cs2 build>
```

The CS2 build id is `buildid` in `/cs2-game/steamapps/appmanifest_730.acf`. It is
the cache-buster: every URL under a build is immutable, which is what the
worker's `max-age=2592000, immutable` assumes. **Never overwrite a published
build in place.** Then move all three pins together:

- `web/nuxt.config.ts` → `runtimeConfig.public.mapMeshCdn`
- `demo-parser/internal/geometry/load.go` → `defaultMeshHost` / `defaultMeshCDN`
- `api/src/utility/utility-callouts.service.ts` → `DEFAULT_CDN`

(or set `MAP_MESH_CDN` / `NUXT_PUBLIC_MAP_MESH_CDN` in the deployment — all three
read it).

## Two things that are easy to get wrong

> **⚠ Meshes carry their own gzip; callouts do not.** A mesh is published as
> `<map>.tri.gz` and decompressed by the consumer (`fetchMeshBuffer` in
> `utilities/mapAssets.ts`, `compress/gzip` in the Go loader). Relying on
> `Content-Encoding` does NOT survive the path: a Worker's `fetch`
> auto-decompresses a gzip subresponse and strips the header, and Cloudflare's
> edge only re-compresses MIME types on its compressible list, which
> `application/octet-stream` is not — inferno came back 18.6 MB instead of
> 2.4 MB. Callouts are `application/json`, which the edge *does* compress, so
> they ship plain and gzip on the wire anyway (8,971 → 1,295 bytes).

> **⚠ The size cap is the CONSUMER's, not the CDN's.** Moving off jsDelivr
> removed the ~20MiB per-file limit, but the demo parser drops any mesh over
> 1.5M triangles or 96 MB and the 3D viewer over 96 MB — both silently, and line
> of sight then answers "visible" for everything. `MESH_MAX_MB` defaults to 40
> (~1.1M triangles). At that budget most of the active pool needs no decimation
> at all; full fidelity would be 1.4 GB across 27 maps and inferno alone would
> be rejected.

---

## What the files are

- One file per map, served from the CDN (see Hosting below), e.g.
  `https://cdn.jsdelivr.net/gh/5stackgg/replay-map-meshes@<tag>/<map>.tri`.
- Format: a **raw, header-less buffer of `float32`** — 9 floats per triangle
  (`p1.xyz, p2.xyz, p3.xyz`), i.e. a non-indexed triangle soup. 36 bytes/triangle.
- Coordinate space: **raw CS2 source/Hammer units** — the *same* space as the
  demo's player/grenade positions, so the mesh and the actors line up with **zero
  calibration**. The viewer just loads the buffer straight into a three.js
  `BufferGeometry` (`mesh.rotation.x = -π/2` to go source-Z-up → three-Y-up).
- **Not** shipped in this repo or the container — built by the script and
  published to the meshes repo (jsDelivr Brotli's them: inferno ~19 MB on disk →
  ~2.5 MB on the wire).

## Default: build from awpy

[awpy](https://github.com/pnxenopoulos/awpy) publishes per-build collision packs.
The script pulls + decimates them into `.cache/meshes/` (gitignored) — no CS2
install needed:

```bash
node scripts/fetch-map-meshes.mjs            # default Valve pool (+ cs_office)
node scripts/fetch-map-meshes.mjs --all      # every map in the pack
node scripts/fetch-map-meshes.mjs de_mirage  # specific map(s)
MESH_MAX_MB=16 node scripts/fetch-map-meshes.mjs    # smaller meshes (more decimation)
MESH_NO_DECIMATE=1 node scripts/fetch-map-meshes.mjs # skip oversized instead of shrinking
```

> **⚠ jsDelivr 20 MiB limit (read this).** The CDN refuses to serve any single
> file over ~20 MiB — it returns **403, not 404**. A 403 means the 3D viewer
> silently falls back to the flat radar *and* `MeshAvailability` lists the map as
> "missing", even though the `.tri` is committed and tagged. That's why the cap
> defaults to **18** (decimal MB on disk). Do **not** raise `MESH_MAX_MB` past ~19
> for anything you intend to publish. Verify a published tag with
> `curl -sI <cdn>/<map>.tri` — expect `200`, never `403`.

It downloads `https://awpycs.com/<build>/tris.zip` and writes the requested maps
to `.cache/meshes/`. Add `--publish` to push + tag them to the CDN (see Hosting).
Bump `AWPY_BUILD_ID` when awpy ships data for a newer CS2 patch.

**Auto-decimation:** maps over `MESH_MAX_MB` (default 18, under the jsDelivr limit
above) are *not* dropped — the script snaps their vertices to a grid and dedups
degenerate/duplicate triangles until they fit, so big active-duty maps still come
through (e.g. anubis 24→~12 MB, overpass 49→~9 MB, train 55→~13 MB). This is the
same idea as the "weld + simplify" step below, just built in and pure-JS.

Maps in the pack today: `de_ancient de_anubis de_basalt de_dust2 de_edin
de_inferno de_mirage de_nuke de_overpass de_palais de_train de_vertigo
de_whistle cs_italy cs_office ar_baggage ar_pool_day ar_shoots`.

---

## Fallback: generate the meshes yourself (Source 2 Viewer)

If awpy stops publishing packs, or a brand-new map isn't covered yet, generate
the `.tri` from the game's VPKs with Source 2 Viewer. You need **CS2 installed**.

[Source 2 Viewer / ValveResourceFormat](https://github.com/ValveResourceFormat/ValveResourceFormat)
(also at https://s2v.app) browses VPKs and exports Source 2 assets to glTF 2.0.

1. Open Source 2 Viewer → **File ▸ Open** the CS2 VPK
   (`.../Counter-Strike Global Offensive/game/csgo/pak01_dir.vpk`).
2. Navigate to the map: `maps/<map>.vpk` (or the loose `maps/<map>/` tree).
3. Find the **physics / collision** resource — `world_physics.vmdl_c`
   (the physics hull), **not** the textured render `world.vmdl_c`. The collision
   hull is far smaller and is what we want.
4. Right-click ▸ **Export** as **glTF (.glb)**. (Textures don't matter — the
   converter only reads positions — so the `*_world_physics_physics.glb` is what
   gets used.)
5. Convert + publish via the pipeline (`glb-to-tri.mjs` is called automatically by
   the publisher; or run it standalone):
   ```bash
   # one map
   node scripts/fetch-map-meshes.mjs --from ~/cs_exports de_cache --publish --tag <build>-1
   # or just convert to .tri
   node scripts/glb-to-tri.mjs ~/cs_exports/de_cache_world_physics_physics.glb ~/meshes/de_cache.tri
   ```

The converter reads only POSITIONs, drops clip/sky brushes by material name, and
removes isolated "standalone walls" (thin/tall/vertical sheets that aren't
connected to anything — see `dropStandaloneWalls` in `glb-to-tri.mjs`). Tune per
run with env vars: `WALL_THIN` / `WALL_TALL` / `WALL_VERT` (thresholds), or
`MESH_DROP_WALLS=1` to re-enable standalone-wall removal.

> **⚠ Standalone-wall removal is off by default, deliberately.** The heuristic
> deletes any disconnected component that is thin, tall and mostly vertical —
> which describes a wall. The roof slider in the viewer handles sky-boxes and
> stray boundary sheets properly, and meanwhile the deletions were doing real
> harm: **the demo parser raycasts this same `.tri` for line of sight**, so every
> wall dropped here became a wall smoke poured through, a sightline that should
> not have existed, and occasionally a smoke whose detonation point landed in
> the gap and collapsed to nothing. Leave it off unless you have a specific
> reason and are not using the mesh for LOS.

> **Coordinate gotcha:** the glb export bakes a `0.0254` inch→meter scale **and** a
> Z-up→Y-up axis remap into every node's transform, purely for glTF viewers. The
> underlying accessor data is already in **CS2 source units / source frame**, so
> `glb-to-tri.mjs` deliberately emits the mesh-*local* positions and **skips the
> node transforms**. Result bbox should read in the thousands (e.g. cache z
> `1524..3331`), not tens — if you see tens, the meters transform leaked in.

> **Tip:** export the `*_world_physics_physics.glb` (physics hull), never the
> textured render mesh (`world.vmdl_c`, ~100 MB+). The export also embeds surface
> textures into the glb (cache came out 175 MB) — we discard all of it, so the
> final `.tri` is tiny (cache: 58 MB raw tris → 12.5 MB decimated → 1.6 MB wire).

---

## Callouts (`<map>.callouts.json`)

The same tagged snapshot also carries each map's **callouts** — the named areas
CS2 defines as `env_cs_place` entities. The panel draws them on the radar behind
a toggle, and names a utility throw from them ("Mid Smoke from T Spawn") so
nobody has to type a name.

```
https://cdn.jsdelivr.net/gh/5stackgg/replay-map-meshes@<tag>/<map>.callouts.json
```

Shape: `{ map, generatedAt, callouts: [{ name, boxes: [{ min: [x,y,z], max: [x,y,z] }] }] }`.
One entry per **name** — a place is legitimately several disjoint volumes — in
raw CS2 source units, the same space as the `.tri` meshes.

### Extracting

Needs CS2 installed. `Source2Viewer-CLI` is downloaded into `.cache/s2v/` on
first run (override with `CLI=<path>`):

```bash
node scripts/extract-map-callouts.mjs                 # every map in the CS2 maps dir
node scripts/extract-map-callouts.mjs de_mirage       # specific map(s)
node scripts/extract-map-callouts.mjs de_mirage --print
CS2_DIR=/path/to/Counter-Strike\ Global\ Offensive node scripts/extract-map-callouts.mjs
```

It decompiles `maps/<map>/entities/default_ents.vents_c`, keeps the
`env_cs_place` blocks, and recovers each volume's box from the `.vmdl` its
`model` points at — the vertex min/max under `position$0`, translated by the
entity's `origin`. Output lands in `.cache/callouts/` (gitignored).

> **⚠ The same coordinate trap as the meshes.** The numbers in the lump and the
> vmdl are already source units; nothing here should apply the glTF `0.0254`
> inch→metre scale. The script asserts the map spans thousands of units and
> fails loudly if it reads tens.

### Publishing

Callouts ride the mesh repo and the mesh tag, because they change on the same
event a mesh does — Valve patched the map:

```bash
node scripts/fetch-map-meshes.mjs --publish --with-callouts --tag <build>-6
```

Then bump the tag in **all three** consumers, which must stay in step or the
browser, the raycaster and the API disagree about the same map:

- `web/nuxt.config.ts` → `runtimeConfig.public.mapMeshCdn`
- `demo-parser/internal/geometry/load.go` → `defaultMeshCDN`
- `api/src/utility/utility-callouts.service.ts` → `DEFAULT_CDN` (or set
  `MAP_MESH_CDN` in the deployment, which all three read)

The API pulls the JSON into `public.map_callouts` on a daily job and at boot;
force it from **Settings ▸ Application ▸ Utility ▸ Sync callouts**. A map the
extract does not cover — anything from the workshop — is filled in instead by
the practice plugin, which reports what it finds on map load. The published
extract always wins where it exists.

### Checking a map's callouts

The engine resolves the same entities itself, and writes the result into
`player_kills.attacker_location` alongside `attacker_location_coordinates`.
That is a few thousand labelled samples per hosted match, and it is the way to
verify an extract before trusting anything named from it. In a practice server,
`.callouts` dumps what the running level says its areas are.

---

## Keeping it small

- Use the **collision/physics** mesh, never the render mesh.
- The big maps (inferno, train, edin) have dense collision soups. If size/perf
  matters, run a **weld + simplify** pass (Blender, `meshoptimizer`,
  `gltf-transform simplify`) before writing the `.tri`.
- The wire is the real budget: serve `.tri` with gzip (≈5–6× smaller). Converting
  to a Draco-compressed indexed glb is the long-term win if we outgrow `.tri`.

## Hosting & distribution

Meshes are **not** shipped in the app repo or the container. They live in a
dedicated repo, [`5stackgg/replay-map-meshes`](https://github.com/5stackgg/replay-map-meshes),
and are served over a CDN so every install fetches them once.

- The app reads the CDN base from `runtimeConfig.public.mapMeshCdn`
  (`nuxt.config.ts`), default
  `https://cdn.jsdelivr.net/gh/5stackgg/replay-map-meshes@<build>`. Override with
  `NUXT_PUBLIC_MAP_MESH_CDN` to point at `cdn.5stack.gg` (Cloudflare R2) later —
  no code change.
- jsDelivr serves `.tri` Brotli-compressed and immutable (tag-pinned): inferno is
  18.9 MB on disk but ~2.5 MB on the wire. The browser decompresses transparently.
- `ReplayViewer.vue` resolves `${mapMeshCdn}/<normalizedMap>.tri`
  (`_night` stripped). If it 404s, the 3D viewer falls back to the flat radar.

### Publish flow (new map or new awpy build)

The script does build → decimate → commit → tag → push in one command. `--from`
accepts ready `.tri` **or** Source 2 Viewer `.glb` exports (auto-converted,
textures discarded); `--from-all` processes every file in the folder.

```bash
# new awpy build: rebuild everything, tag = build id
AWPY_BUILD_ID=<new> node scripts/fetch-map-meshes.mjs --all --publish

# batch ALL your Source 2 Viewer exports in one folder → one tag
node scripts/fetch-map-meshes.mjs --from ~/cs_exports --from-all --publish --tag 17595823-2

# a single map
node scripts/fetch-map-meshes.mjs --from ~/cs_exports de_cache --publish --tag 17595823-2
```

Then bump the tag in `mapMeshCdn` (`nuxt.config.ts`) or via
`NUXT_PUBLIC_MAP_MESH_CDN`. The immutable URL = instant cache bust, no asset
redeploy. The publisher refuses to reuse an existing tag for this reason.

### Recommended end-to-end for "regenerate everything"

1. In **Source 2 Viewer**, export each map's `world_physics.vmdl_c` as glTF
   (`.glb`) into one folder (e.g. `~/cs_exports/`). Materials don't matter — we
   only read positions — so the `*_world_physics_physics.glb` is what's used.
2. One command converts every glb → source-unit `.tri`, decimates oversized ones,
   commits + tags + pushes them all:
   ```bash
   node scripts/fetch-map-meshes.mjs --from ~/cs_exports --from-all --publish --tag <new>
   ```
3. Bump `mapMeshCdn` to `<new>`. Done — every map updated in one shot.
