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

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

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
  const out = [];
  let dropped = 0;
  for (let i = 0; i < n; i++) {
    if (drop.has(find(tv[i * 3]))) { dropped++; continue; }
    const o = i * 9;
    for (let k = 0; k < 9; k++) out.push(tris[o + k]);
  }
  return { tris: out, dropped, walls: drop.size };
}

// Parse a .glb and return { tris: Float32 buffer of source-unit triangles, count, bbox }.
export function glbToTri(inPath, { skipClips = true, dropWalls = true } = {}) {
  const buf = readFileSync(inPath);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const total = dv.getUint32(8, true);
  let off = 12, gltf, binOff = 0;
  while (off < total) {
    const clen = dv.getUint32(off, true);
    const ctype = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (ctype === 0x4e4f534a)
      gltf = JSON.parse(Buffer.from(buf.buffer, buf.byteOffset + start, clen).toString());
    else if (ctype === 0x004e4942) binOff = buf.byteOffset + start;
    off = start + clen + (clen % 4 ? 4 - (clen % 4) : 0);
  }

  const readAccessor = (idx) => {
    const acc = gltf.accessors[idx];
    const bv = gltf.bufferViews[acc.bufferView];
    const base = binOff + (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const ncomp = acc.type === "VEC3" ? 3 : acc.type === "VEC2" ? 2 : 1;
    const stride = bv.byteStride || COMP[acc.componentType] * ncomp;
    const out = new Array(acc.count * ncomp);
    for (let i = 0; i < acc.count; i++) {
      const p = base + i * stride;
      for (let c = 0; c < ncomp; c++) {
        const o = p + c * COMP[acc.componentType] - buf.byteOffset;
        out[i * ncomp + c] =
          acc.componentType === 5126 ? dv.getFloat32(o, true)
          : acc.componentType === 5125 ? dv.getUint32(o, true)
          : acc.componentType === 5123 ? dv.getUint16(o, true)
          : dv.getUint8(o);
      }
    }
    return out;
  };

  const tris = [];
  let skipped = 0;
  const skippedMats = new Set();
  for (const mesh of gltf.meshes) {
    for (const prim of mesh.primitives) {
      if (prim.attributes.POSITION == null) continue;
      const matName =
        prim.material != null ? gltf.materials[prim.material]?.name || "" : "";
      const drop = skipClips && SKIP_MATERIAL.test(matName);
      const pos = readAccessor(prim.attributes.POSITION);
      const idx = prim.indices != null ? readAccessor(prim.indices) : null;
      const count = idx ? idx.length : pos.length / 3;
      if (drop) {
        skipped += count / 3;
        skippedMats.add(matName);
        continue;
      }
      for (let i = 0; i < count; i++) {
        const vi = idx ? idx[i] : i;
        tris.push(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]);
      }
    }
  }

  // drop isolated thin/tall/vertical "standalone walls"
  let walls = 0, wallTris = 0, kept = tris;
  if (dropWalls) {
    const r = dropStandaloneWalls(tris);
    kept = r.tris; walls = r.walls; wallTris = r.dropped;
  }

  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < kept.length; i += 3)
    for (let c = 0; c < 3; c++) {
      mn[c] = Math.min(mn[c], kept[i + c]);
      mx[c] = Math.max(mx[c], kept[i + c]);
    }
  return {
    buf: Buffer.from(new Float32Array(kept).buffer),
    count: kept.length / 9,
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
