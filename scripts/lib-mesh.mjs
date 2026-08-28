// Shrinking a collision soup, shared by the mesh builders.
//
// A .tri has to fit what READS it, not what serves it: the demo parser drops a
// mesh over 1.5M triangles or 96MB (internal/geometry/load.go) and the 3D
// viewer over 96MB, and in both cases the failure is silent -- LOS quietly
// falls back to "everything is visible". That, not any CDN limit, is why this
// still exists after the move off jsDelivr.
// ── decimation ────────────────────────────────────────────────────────────────
// Shrink a non-indexed float32 triangle buffer by snapping vertices to a grid
// and dropping degenerate + duplicate triangles. Source collision soups carry a
// lot of fine, coplanar tessellation that collapses away under quantization,
// which cuts the file while preserving the rough wall/height shapes the 3D
// viewer needs. `grid` is in source units (player ~32 wide, 72 tall).
export function decimate(buf, grid) {
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const tris = f.length / 9;
  const out = [];
  const seen = new Set();
  const snap = (v) => Math.round(v / grid) * grid;
  for (let i = 0; i < tris; i++) {
    const o = i * 9;
    const ax = snap(f[o]), ay = snap(f[o + 1]), az = snap(f[o + 2]);
    const bx = snap(f[o + 3]), by = snap(f[o + 4]), bz = snap(f[o + 5]);
    const cx = snap(f[o + 6]), cy = snap(f[o + 7]), cz = snap(f[o + 8]);
    // drop zero-area triangles (snapped verts collapsed onto each other)
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-3) continue;
    // dedup identical triangles regardless of winding/vertex order
    const v = [
      [ax, ay, az],
      [bx, by, bz],
      [cx, cy, cz],
    ].sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
    const key = v[0].join() + "|" + v[1].join() + "|" + v[2].join();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  return Buffer.from(new Float32Array(out).buffer);
}

/** Bring a buffer under `maxMb` (best-effort, progressively coarser grids). */
export function fitToCap(buf, maxMb, noDecimate = false) {
  const before = buf.length / 1e6;
  if (before <= maxMb || noDecimate) {
    return { buf, note: `${before.toFixed(1)} MB`, drop: before > maxMb };
  }
  let best = buf;
  for (const grid of [8, 16, 24, 32, 48, 64, 96, 128]) {
    best = decimate(buf, grid);
    if (best.length / 1e6 <= maxMb) break;
  }
  const after = best.length / 1e6;
  const tag = after > maxMb ? "⚠ still over cap" : "decimated";
  return { buf: best, note: `${tag} ${before.toFixed(1)}→${after.toFixed(1)} MB` };
}
