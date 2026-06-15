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

// Parse a .glb and return { tris: Float32 buffer of source-unit triangles, count, bbox }.
export function glbToTri(inPath, { skipClips = true } = {}) {
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

  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i += 3)
    for (let c = 0; c < 3; c++) {
      mn[c] = Math.min(mn[c], tris[i + c]);
      mx[c] = Math.max(mx[c], tris[i + c]);
    }
  return {
    buf: Buffer.from(new Float32Array(tris).buffer),
    count: tris.length / 9,
    skipped,
    skippedMats: [...skippedMats],
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
  const { buf, count, skipped, skippedMats, bbox } = glbToTri(inPath);
  writeFileSync(outPath, buf);
  console.log(`✓ ${basename(outPath)}: ${count.toLocaleString()} triangles, ${(buf.length / 1e6).toFixed(1)} MB`);
  if (skipped)
    console.log(`  dropped ${skipped.toLocaleString()} clip/sky triangles (${skippedMats.length} materials)`);
  console.log(`  bbox min ${bbox.min.map((v) => v.toFixed(0))}  max ${bbox.max.map((v) => v.toFixed(0))} (source units)`);
  if (Math.max(...bbox.max.map(Math.abs)) < 500)
    console.warn("  ⚠ bbox looks tiny (meters?) — expected thousands. Check the export.");
}
