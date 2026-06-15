# 3D replay map meshes (`.tri` collision geometry)

The 3D replay viewer (`components/match/Replay3DLite.vue`) renders a **lightweight
collision mesh** of each map as the world — not the full textured render mesh.

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
MESH_MAX_MB=60 node scripts/fetch-map-meshes.mjs    # allow bigger meshes at full detail
MESH_NO_DECIMATE=1 node scripts/fetch-map-meshes.mjs # skip oversized instead of shrinking
```

It downloads `https://awpycs.com/<build>/tris.zip` and writes the requested maps
to `.cache/meshes/`. Add `--publish` to push + tag them to the CDN (see Hosting).
Bump `AWPY_BUILD_ID` when awpy ships data for a newer CS2 patch.

**Auto-decimation:** maps over `MESH_MAX_MB` (default 30) are *not* dropped — the
script snaps their vertices to a grid and dedups degenerate/duplicate triangles
until they fit, so big active-duty maps still come through (e.g. inferno
97→~19 MB, train 55→~14 MB, ancient 35→~12 MB). This is the same idea as the
"weld + simplify" step below, just built in and pure-JS.

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
`MESH_KEEP_WALLS=1` to disable wall removal entirely.

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
