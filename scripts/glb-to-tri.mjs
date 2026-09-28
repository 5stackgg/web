#!/usr/bin/env node
// Convert a Source 2 physics glTF (.glb) — e.g. exported from Source 2 Viewer /
// ValveResourceFormat — into our raw .tri collision format (non-indexed float32,
// 9 floats per triangle, CS2 source units).
//
// Only vertex POSITIONs are read; embedded textures/materials are ignored, which
// is why the .tri is tiny next to the .glb.
//
// VRF exports *_world_physics as a single baked model whose node transforms are
// all identical (a 0.0254 inch→meter scale + Z-up→Y-up axis remap, zero
// translation) purely for glTF viewers. The underlying accessor data is already
// in CS2 source units / source frame — what we want — so we emit the mesh-local
// positions and SKIP the node transforms. A correct result has a bbox in the
// thousands (map-sized), not tens.
//
// Usable as a CLI or imported: `import { glbToTri, mapNameFromGlb } from ...`.
//
// CLI:
//   node scripts/glb-to-tri.mjs <input.glb> [output.tri]

import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { openGlb } from "./lib-glb.mjs";

// Derive a map name from a VRF export filename, e.g.
// "de_cache_world_physics_physics.glb" → "de_cache", "de_nuke.glb" → "de_nuke".
export function mapNameFromGlb(file) {
  return basename(file)
    .replace(/\.glb$/i, "")
    .replace(/_world_physics.*$/i, "")
    .replace(/_physics$/i, "");
}

// Material names whose triangles are INVISIBLE collision volumes, not world
// geometry — they must be dropped or the map renders as solid boxes (the skybox
// brush encloses everything; player/grenade clips form phantom roofs & walls).
// CS2 physics materials are named e.g. physics_npcclip_playerclip_material,
// physics_csgo_grenadeclip_wood_material, physics_sky_material. Real surfaces are
// physics_group_* / physics_passbullets_* / physics_window_* and pass through.
const SKIP_MATERIAL = /clip|sky|nodraw|invisible|trigger|occluder|\bhint\b/i;

// Grenade clips block grenades and nothing else, so they are the one clip the
// grenade flight simulation needs back. Only these: a playerclip or npcclip
// (`physics_npcclip_playerclip_*`, `physics_playerclip`) lets a grenade through.
const GRENADE_CLIP = /grenadeclip/i;
const PLAYER_CLIP = /playerclip|npcclip/i;

// Remove "standalone walls": isolated, thin, tall, vertical sheets of geometry
// that aren't connected to anything (no floor/roof) — the boundary/blocker walls
// that exist for gameplay but just occlude the 3D view. We weld vertices, find
// connected components (union-find), and drop components that are a thin tall
// vertical slab on their own. Interior walls welded to floors stay (they're part
// of the big connected mesh, not thin). Operates on a flat [x,y,z,...] tri list.
function dropStandaloneWalls(tris, opts = {}) {
  const THIN = opts.thin ?? 72; // max thickness (source units) to count as a sheet
  const TALL = opts.tall ?? 160; // min height to count as a wall
  const VERT = opts.vert ?? 0.8; // min fraction of near-vertical faces
  const WELD = 2; // vertex weld grid
  const n = tris.length / 9;
  if (n < 3) return { tris, dropped: 0, walls: 0 };

  // weld vertices → ids
  const vid = new Map();
  const tv = new Int32Array(n * 3);
  let next = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    for (let v = 0; v < 3; v++) {
      const k =
        Math.round(tris[o + v * 3] / WELD) + "," +
        Math.round(tris[o + v * 3 + 1] / WELD) + "," +
        Math.round(tris[o + v * 3 + 2] / WELD);
      let id = vid.get(k);
      if (id === undefined) { id = next++; vid.set(k, id); }
      tv[i * 3 + v] = id;
    }
  }
  // union-find
  const parent = new Int32Array(next);
  for (let i = 0; i < next; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let i = 0; i < n; i++) {
    const a = find(tv[i * 3]), b = find(tv[i * 3 + 1]), c = find(tv[i * 3 + 2]);
    if (a !== b) parent[b] = a;
    if (find(c) !== a) parent[find(c)] = a;
  }
  // per-component bbox + vertical-face fraction
  const comp = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(tv[i * 3]);
    let s = comp.get(r);
    if (!s) { s = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9, n: 0, vert: 0 }; comp.set(r, s); }
    const o = i * 9;
    for (let v = 0; v < 3; v++) {
      const x = tris[o + v * 3], y = tris[o + v * 3 + 1], z = tris[o + v * 3 + 2];
      if (x < s.x0) s.x0 = x; if (x > s.x1) s.x1 = x;
      if (y < s.y0) s.y0 = y; if (y > s.y1) s.y1 = y;
      if (z < s.z0) s.z0 = z; if (z > s.z1) s.z1 = z;
    }
    s.n++;
    const ux = tris[o + 3] - tris[o], uy = tris[o + 4] - tris[o + 1], uz = tris[o + 5] - tris[o + 2];
    const vx = tris[o + 6] - tris[o], vy = tris[o + 7] - tris[o + 1], vz = tris[o + 8] - tris[o + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    if (Math.abs(nz / L) < 0.3) s.vert++; // near-vertical face
  }
  // flag standalone-wall components
  const drop = new Set();
  for (const [r, s] of comp) {
    const thin = Math.min(s.x1 - s.x0, s.y1 - s.y0);
    const dz = s.z1 - s.z0;
    if (thin <= THIN && dz >= TALL && s.vert / s.n >= VERT) drop.add(r);
  }
  if (!drop.size) return { tris, dropped: 0, walls: 0 };
  // preallocate the kept buffer (avoid a multi-million-element Array.push)
  let keep = 0;
  for (let i = 0; i < n; i++) if (!drop.has(find(tv[i * 3]))) keep++;
  const out = new Float32Array(keep * 9);
  let w = 0;
  for (let i = 0; i < n; i++) {
    if (drop.has(find(tv[i * 3]))) continue;
    const o = i * 9;
    for (let k = 0; k < 9; k++) out[w++] = tris[o + k];
  }
  return { tris: out, dropped: n - keep, walls: drop.size };
}

// Parse a .glb and return { buf: source-unit triangles, count, bbox }, plus the
// grenade-clip and player-clip triangles on their own, in the same format.
export function glbToTri(inPath, opts = {}) {
  const skipClips = opts.skipClips ?? true;
  // Standalone-wall removal is OFF by default.
  //
  // The heuristic deletes any disconnected component that is thin, tall and
  // mostly vertical — which is a description of a wall. It was meant to strip
  // sky-boxes and stray boundary sheets, but the roof slider in the 3D viewer
  // solved that properly, and meanwhile the deletions were doing real damage:
  // the demo parser raycasts this same mesh for line of sight, so every wall
  // dropped here became a wall smoke poured through and a sightline that should
  // not have existed. Set MESH_DROP_WALLS=1 to bring it back.
  const dropWalls = opts.dropWalls ?? process.env.MESH_DROP_WALLS === "1";
  const glb = openGlb(inPath);
  const { gltf } = glb;

  const solid = [];
  const clips = [];
  const playerClips = [];
  let skipped = 0;
  const skippedMats = new Set();
  try {
    for (const mesh of gltf.meshes) {
      for (const prim of mesh.primitives) {
        if (prim.attributes.POSITION == null) continue;
        // The surface name has moved. Source2Viewer used to export these hulls
        // with one MATERIAL per physics group; it now exports one MESH per group
        // and no materials at all, so a material-only test silently matched
        // nothing and every clip brush came through as world geometry. On mirage
        // that was 9,576 triangles of invisible playerclip, grenadeclip and
        // skybox -- the phantom walls and roofs this filter exists to remove.
        // Both are read so either export shape keeps working.
        const matName =
          prim.material != null ? gltf.materials?.[prim.material]?.name || "" : "";
        const groupName = mesh.name || "";
        const drop =
          skipClips && (SKIP_MATERIAL.test(matName) || SKIP_MATERIAL.test(groupName));
        const grenadeClip = GRENADE_CLIP.test(matName) || GRENADE_CLIP.test(groupName);
        const playerClip =
          !grenadeClip && (PLAYER_CLIP.test(matName) || PLAYER_CLIP.test(groupName));
        if (drop && !grenadeClip && !playerClip) {
          const count =
            prim.indices != null
              ? gltf.accessors[prim.indices].count
              : gltf.accessors[prim.attributes.POSITION].count;
          skipped += count / 3;
          skippedMats.add(matName || groupName);
          continue;
        }
        const pos = glb.read(prim.attributes.POSITION);
        const idx = prim.indices != null ? glb.read(prim.indices) : null;
        const count = idx ? idx.length : pos.length / 3;
        const soup = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const vi = idx ? idx[i] : i;
          soup[i * 3] = pos[vi * 3];
          soup[i * 3 + 1] = pos[vi * 3 + 1];
          soup[i * 3 + 2] = pos[vi * 3 + 2];
        }
        if (grenadeClip) {
          clips.push(soup);
        } else if (playerClip) {
          playerClips.push(soup);
        }
        if (drop) {
          skipped += count / 3;
          skippedMats.add(matName || groupName);
          continue;
        }
        solid.push(soup);
      }
    }
  } finally {
    glb.close();
  }

  const concat = (parts) => {
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let w = 0;
    for (const p of parts) {
      out.set(p, w);
      w += p.length;
    }
    return out;
  };
  const tris = concat(solid);
  const grenadeClip = concat(clips);
  const playerClip = concat(playerClips);

  // drop isolated thin/tall/vertical "standalone walls". Thresholds are tunable
  // per run via WALL_THIN / WALL_TALL / WALL_VERT env vars.
  let walls = 0, wallTris = 0, kept = tris;
  if (dropWalls) {
    const num = (v) => (v != null && v !== "" ? Number(v) : undefined);
    const r = dropStandaloneWalls(tris, {
      thin: num(process.env.WALL_THIN),
      tall: num(process.env.WALL_TALL),
      vert: num(process.env.WALL_VERT),
    });
    kept = r.tris; walls = r.walls; wallTris = r.dropped;
  }

  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < kept.length; i += 3)
    for (let c = 0; c < 3; c++) {
      mn[c] = Math.min(mn[c], kept[i + c]);
      mx[c] = Math.max(mx[c], kept[i + c]);
    }
  const soup = kept instanceof Float32Array ? kept : new Float32Array(kept);
  return {
    buf: Buffer.from(soup.buffer, soup.byteOffset, soup.byteLength),
    count: soup.length / 9,
    grenadeClip: Buffer.from(grenadeClip.buffer, grenadeClip.byteOffset, grenadeClip.byteLength),
    playerClip: Buffer.from(playerClip.buffer, playerClip.byteOffset, playerClip.byteLength),
    skipped,
    skippedMats: [...skippedMats],
    walls,
    wallTris,
    bbox: { min: mn, max: mx },
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const inPath = process.argv[2];
  if (!inPath) {
    console.error("usage: node scripts/glb-to-tri.mjs <input.glb> [output.tri]");
    process.exit(1);
  }
  const outPath = process.argv[3] || `${mapNameFromGlb(inPath)}.tri`;
  const { buf, count, skipped, skippedMats, walls, wallTris, bbox } = glbToTri(inPath);
  writeFileSync(outPath, buf);
  console.log(`✓ ${basename(outPath)}: ${count.toLocaleString()} triangles, ${(buf.length / 1e6).toFixed(1)} MB`);
  if (skipped)
    console.log(`  dropped ${skipped.toLocaleString()} clip/sky triangles (${skippedMats.length} materials)`);
  if (walls)
    console.log(`  dropped ${walls} standalone wall(s) (${wallTris.toLocaleString()} triangles)`);
  console.log(`  bbox min ${bbox.min.map((v) => v.toFixed(0))}  max ${bbox.max.map((v) => v.toFixed(0))} (source units)`);
  if (Math.max(...bbox.max.map(Math.abs)) < 500)
    console.warn("  ⚠ bbox looks tiny (meters?) — expected thousands. Check the export.");
}
