// The 3D viewer's render mesh: `<map>.view.bin`, built from the map's RENDER
// world rather than its collision hull.
//
// The collision hull is still what the demo parser raycasts (`<map>.tri`), but
// it is a poor thing to look at: invisible blocker hulls rise far above
// anything drawn, and it has no idea which floor a wall belongs to. This mesh
// is what the level actually draws, simplified, with every vertex carrying the
// height of the floor it stands over so the viewer can trim walls and roofs to
// a height above the LOCAL floor instead of one global clip plane.
//
// FORMAT (version 1, little-endian, source units, Z up):
//
//   header, 32 bytes:  char[4] "5SVM", u16 version, u16 chunkCount,
//                      f32[3] bboxMin, f32[3] bboxMax
//   chunkCount x 32:   char[16] name (NUL-padded), u32 vertexCount,
//                      u32 indexCount, u32 dataOffset, u32 reserved
//   per chunk, each section 4-byte aligned:
//     f32[v*3] position, f32[v] floorZ (NaN = no floor), u8[v] flags,
//     u32[i] indices (triangle list, winding not guaranteed)
//
//   flags bits 0-1: 0 solid, 1 foliage, 2 see-through; bit 2: the floor was
//   only found in the wide search (outside playable space)
import { createHash } from "node:crypto";
import { MeshoptSimplifier } from "meshoptimizer";
import { meshNodes, openGltf } from "./lib-glb.mjs";

export const VIEW_MAGIC = "5SVM";
export const VIEW_VERSION = 1;
export const SURFACE_SOLID = 0;
export const SURFACE_FOLIAGE = 1;
export const SURFACE_SEE_THROUGH = 2;
export const FLAG_OUTSIDE = 4;

const HEADER_BYTES = 32;
const CHUNK_BYTES = 32;
const NAME_BYTES = 16;
const METERS_PER_UNIT = 0.0254;

// Effect cards are drawn translucent in game and as huge opaque slabs here:
// mirage's `nomerge<N>_dust_002` light shafts are 700-1700u slanted sheets
// across the whole map. `dust_<digits>` is the effect; `dust_arch_small` and
// friends are ordinary props and do not match.
const DROP = new RegExp(
  [
    "blocklight",
    "(^|_)bl_mesh",
    "^retake_",
    "overlay",
    "decal",
    "additive",
    "blocker",
    "fog_card",
    "tools[a-z]",
    "nodraw",
    "occluder",
    "(^|_)sky(box)?(_|\\.|\\d|$)",
    "(^|_)clip(_|\\.|$)",
    "playerclip",
    "npcclip",
    "grenadeclip",
    "(^|_)dust_\\d",
    "light_?shaft",
    "god_?ray",
    "sun_?(beam|ray)",
    "volumetric",
    "(^|_)(fog|haze|mist|smoke|steam)(_|\\.|\\d|$)",
  ].join("|"),
  "i",
);
const FOLIAGE = /tree|branch|foliage|leaf|leaves|palm|bush|grass|ivy|vine|hedge|shrub|sumac/i;
const NOT_FOLIAGE = /bark|trunk|blend|ground|dirt|terrain/i;
const SEE_THROUGH = new RegExp(
  [
    "fence",
    "grate",
    "grating",
    "wire",
    "chainlink",
    "glass",
    "(^|_)nets?(_|\\d|\\.|$)",
    "netting",
    "window",
    "water",
    "railing_\\d+_card",
  ].join("|"),
  "i",
);
const NOT_SEE_THROUGH = /shutter|sill|backing|frame/i;

/**
 * What a render-world node is, from its name alone -- materials are not
 * exported, and the aggregate names carry the material anyway
 * (`n0_lr0_agg_merge_<material>_N`). null means the node is not drawn by the
 * game in a normal match: light blockers, decals, game-mode-only entity
 * meshes, tool textures.
 */
export function classifyNode(name) {
  if (DROP.test(name)) {
    return null;
  }
  if (FOLIAGE.test(name) && !NOT_FOLIAGE.test(name)) {
    return SURFACE_FOLIAGE;
  }
  if (SEE_THROUGH.test(name) && !NOT_SEE_THROUGH.test(name)) {
    return SURFACE_SEE_THROUGH;
  }
  return SURFACE_SOLID;
}

/**
 * Positions and triangles of one node, welded by exact position, in source
 * units. Render worlds are metres with source (x, y, z) stored as glTF
 * (y, z, x) once node matrices are applied -- NOT the physics export's
 * convention, which keeps mesh-local source units.
 */
function readNode(glb, node) {
  const mesh = glb.gltf.meshes[node.mesh];
  const parts = [];
  let vertexTotal = 0;
  let indexTotal = 0;
  for (const primitive of mesh.primitives) {
    if ((primitive.mode ?? 4) !== 4 || primitive.attributes.POSITION == null) {
      continue;
    }
    const local = glb.read(primitive.attributes.POSITION);
    const count = local.length / 3;
    const indices =
      primitive.indices != null
        ? glb.read(primitive.indices)
        : Uint32Array.from({ length: count }, (_, i) => i);
    parts.push({ local, indices, base: vertexTotal });
    vertexTotal += count;
    indexTotal += indices.length - (indices.length % 3);
  }
  if (!indexTotal) {
    return null;
  }

  const m = node.matrix;
  const positions = new Float32Array(vertexTotal * 3);
  const indices = new Uint32Array(indexTotal);
  let w = 0;
  for (const part of parts) {
    const { local, base } = part;
    for (let v = 0; v < local.length / 3; v++) {
      const x = local[v * 3];
      const y = local[v * 3 + 1];
      const z = local[v * 3 + 2];
      const gx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const gy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const gz = m[2] * x + m[6] * y + m[10] * z + m[14];
      const o = (base + v) * 3;
      positions[o] = gz / METERS_PER_UNIT;
      positions[o + 1] = gx / METERS_PER_UNIT;
      positions[o + 2] = gy / METERS_PER_UNIT;
    }
    const n = part.indices.length - (part.indices.length % 3);
    for (let i = 0; i < n; i++) {
      indices[w++] = part.indices[i] + base;
    }
  }
  return weld(positions, indices);
}

function weld(positions, indices) {
  const remap = MeshoptSimplifier.generatePositionRemap(positions, 3);
  const out = new Uint32Array(indices.length);
  let w = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = remap[indices[t]];
    const b = remap[indices[t + 1]];
    const c = remap[indices[t + 2]];
    if (a === b || b === c || a === c) {
      continue;
    }
    out[w++] = a;
    out[w++] = b;
    out[w++] = c;
  }
  return compact(positions, out.subarray(0, w));
}

/** Drop unreferenced vertices, renumbering in first-use order. */
function compact(positions, indices) {
  const map = new Int32Array(positions.length / 3).fill(-1);
  let next = 0;
  const out = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    let v = map[indices[i]];
    if (v < 0) {
      v = next++;
      map[indices[i]] = v;
    }
    out[i] = v;
  }
  const packed = new Float32Array(next * 3);
  for (let old = 0; old < map.length; old++) {
    const v = map[old];
    if (v >= 0) {
      packed[v * 3] = positions[old * 3];
      packed[v * 3 + 1] = positions[old * 3 + 1];
      packed[v * 3 + 2] = positions[old * 3 + 2];
    }
  }
  return { positions: packed, indices: out };
}

function keepTriangles(mesh, keep) {
  const { indices } = mesh;
  const out = new Uint32Array(indices.length);
  let w = 0;
  for (let t = 0; t < indices.length / 3; t++) {
    if (keep(t)) {
      out[w++] = indices[t * 3];
      out[w++] = indices[t * 3 + 1];
      out[w++] = indices[t * 3 + 2];
    }
  }
  if (w === indices.length) {
    return mesh;
  }
  return compact(mesh.positions, out.subarray(0, w));
}

/** Remove connected pieces whose bounding-box diagonal is under `minSize`. */
function dropSmallComponents(mesh, minSize) {
  const { positions, indices } = mesh;
  const vertices = positions.length / 3;
  const parent = new Int32Array(vertices);
  for (let i = 0; i < vertices; i++) {
    parent[i] = i;
  }
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (let i = 0; i < indices.length; i += 3) {
    const a = find(indices[i]);
    const b = find(indices[i + 1]);
    if (a !== b) {
      parent[b] = a;
    }
    const c = find(indices[i + 2]);
    const r = find(a);
    if (c !== r) {
      parent[c] = r;
    }
  }
  const box = new Float64Array(vertices * 6);
  for (let v = 0; v < vertices; v++) {
    box[v * 6] = box[v * 6 + 1] = box[v * 6 + 2] = Infinity;
    box[v * 6 + 3] = box[v * 6 + 4] = box[v * 6 + 5] = -Infinity;
  }
  for (let v = 0; v < vertices; v++) {
    const r = find(v) * 6;
    for (let c = 0; c < 3; c++) {
      const p = positions[v * 3 + c];
      if (p < box[r + c]) {
        box[r + c] = p;
      }
      if (p > box[r + 3 + c]) {
        box[r + 3 + c] = p;
      }
    }
  }
  const min2 = minSize * minSize;
  const small = new Uint8Array(vertices);
  let any = false;
  for (let v = 0; v < vertices; v++) {
    if (find(v) !== v) {
      continue;
    }
    const r = v * 6;
    const dx = box[r + 3] - box[r];
    const dy = box[r + 4] - box[r + 1];
    const dz = box[r + 5] - box[r + 2];
    if (dx * dx + dy * dy + dz * dz < min2) {
      small[v] = 1;
      any = true;
    }
  }
  if (!any) {
    return mesh;
  }
  return keepTriangles(mesh, (t) => !small[find(indices[t * 3])]);
}

/**
 * Vertices of up-facing triangles lying on a walkable floor (within
 * `tolerance` of the floor index's height there). Once borders unlock these
 * are the ones that must not move: a floor that collapses leaves a hole under
 * the players, while a wall, roof or prop that loses detail costs nothing.
 */
function walkableLock(mesh, floors, { minNormalZ = 0.7, tolerance = 24 } = {}) {
  const { positions, indices } = mesh;
  const lock = new Uint8Array(positions.length / 3);
  if (!floors) {
    return lock;
  }
  const seen = new Uint8Array(positions.length / 3);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length === 0 || Math.abs(nz) / length < minNormalZ) {
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const v = indices[t + k];
      if (seen[v]) {
        continue;
      }
      seen[v] = 1;
      const z = positions[v * 3 + 2];
      const x = positions[v * 3];
      const y = positions[v * 3 + 1];
      const floor = floors.floorAt(x, y, z, tolerance, tolerance);
      if (floor !== null && z - floor <= tolerance) {
        lock[v] = 1;
      }
    }
  }
  return lock;
}

const NO_ATTRIBUTES = new Float32Array(0);

/** Vertex clustering to an absolute error, for foliage cards. */
function clusterMesh(mesh, error) {
  if (mesh.indices.length <= 3) {
    return mesh;
  }
  const scale = MeshoptSimplifier.getScale(mesh.positions, 3);
  if (!(scale > 0)) {
    return mesh;
  }
  const [indices] = MeshoptSimplifier.simplifySloppy(
    mesh.indices,
    mesh.positions,
    3,
    null,
    0,
    error / scale,
  );
  if (indices.length === mesh.indices.length) {
    return mesh;
  }
  return compact(mesh.positions, indices);
}

function simplifyMesh(mesh, error, lockBorder = true, floors = null) {
  if (mesh.indices.length <= 3) {
    return mesh;
  }
  const [indices] = lockBorder
    ? MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, 0, error, [
        "LockBorder",
        "ErrorAbsolute",
      ])
    : MeshoptSimplifier.simplifyWithAttributes(
        mesh.indices,
        mesh.positions,
        3,
        NO_ATTRIBUTES,
        0,
        [],
        walkableLock(mesh, floors),
        0,
        error,
        ["ErrorAbsolute"],
      );
  if (indices.length === mesh.indices.length) {
    return mesh;
  }
  return compact(mesh.positions, indices);
}

/**
 * Split every edge longer than `maxEdge` at its midpoint, sharing midpoints
 * between the two triangles on an edge so no T-junction opens up. Heights
 * above the local floor are interpolated per vertex, so a wall spanning two
 * floors needs vertices along it to be trimmed sensibly.
 */
function tessellate(mesh, maxEdge) {
  const max2 = maxEdge * maxEdge;
  const { indices } = mesh;
  let positions = mesh.positions;
  const edge2 = (a, b) => {
    const dx = positions[a * 3] - positions[b * 3];
    const dy = positions[a * 3 + 1] - positions[b * 3 + 1];
    const dz = positions[a * 3 + 2] - positions[b * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  };

  let needed = false;
  for (let t = 0; t < indices.length && !needed; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    needed = edge2(a, b) > max2 || edge2(b, c) > max2 || edge2(c, a) > max2;
  }
  if (!needed) {
    return mesh;
  }

  let vertexCount = positions.length / 3;
  let capacity = positions.length;
  const grow = () => {
    capacity *= 2;
    const next = new Float32Array(capacity);
    next.set(positions);
    positions = next;
  };
  const midpoints = new Map();
  const midpoint = (a, b) => {
    const key = a < b ? a * 0x4000000 + b : b * 0x4000000 + a;
    let m = midpoints.get(key);
    if (m === undefined) {
      if ((vertexCount + 1) * 3 > capacity) {
        grow();
      }
      m = vertexCount++;
      for (let c = 0; c < 3; c++) {
        positions[m * 3 + c] = (positions[a * 3 + c] + positions[b * 3 + c]) / 2;
      }
      midpoints.set(key, m);
    }
    return m;
  };

  const out = [];
  const stack = [];
  for (let t = 0; t < indices.length; t += 3) {
    stack.push(indices[t], indices[t + 1], indices[t + 2]);
    while (stack.length) {
      const c = stack.pop();
      const b = stack.pop();
      const a = stack.pop();
      const ab = edge2(a, b);
      const bc = edge2(b, c);
      const ca = edge2(c, a);
      if (ab <= max2 && bc <= max2 && ca <= max2) {
        out.push(a, b, c);
      } else if (ab >= bc && ab >= ca) {
        const m = midpoint(a, b);
        stack.push(a, m, c, m, b, c);
      } else if (bc >= ca) {
        const m = midpoint(b, c);
        stack.push(a, b, m, a, m, c);
      } else {
        const m = midpoint(c, a);
        stack.push(a, b, m, m, b, c);
      }
    }
  }
  return { positions: positions.slice(0, vertexCount * 3), indices: Uint32Array.from(out) };
}

function triangleCount(meshes) {
  return meshes.reduce((n, m) => n + m.indices.length / 3, 0);
}

function align4(n) {
  return (n + 3) & ~3;
}

function chunkBytes(vertexCount, indexCount) {
  return vertexCount * 12 + vertexCount * 4 + align4(vertexCount) + indexCount * 4;
}

/**
 * A chunk name that fits the 16-byte slot. A longer one keeps its first
 * characters up to 11 bytes (never splitting one) plus `~` and four hex digits
 * of its sha256, so two long names sharing a prefix stay distinct and the
 * same name always shortens the same way.
 */
export function chunkLabel(name) {
  const full = Buffer.from(name, "utf8");
  if (full.length <= NAME_BYTES) {
    return name;
  }
  let head = "";
  for (const char of name) {
    if (Buffer.byteLength(head + char, "utf8") > 11) {
      break;
    }
    head += char;
  }
  return `${head}~${createHash("sha256").update(full).digest("hex").slice(0, 4)}`;
}

/**
 * Serialise chunks to a `.view.bin` buffer. Each chunk is
 * `{ name, positions: Float32Array, floorZ: Float32Array, flags: Uint8Array,
 * indices: Uint32Array }`.
 */
export function writeViewBin(chunks) {
  if (chunks.length > 0xffff) {
    throw new Error(`${chunks.length} chunks do not fit a u16`);
  }
  let offset = HEADER_BYTES + chunks.length * CHUNK_BYTES;
  const layout = chunks.map((chunk) => {
    const vertexCount = chunk.positions.length / 3;
    const indexCount = chunk.indices.length;
    if (chunk.floorZ.length !== vertexCount || chunk.flags.length !== vertexCount) {
      throw new Error(`chunk ${chunk.name}: floorZ/flags do not match ${vertexCount} vertices`);
    }
    if (indexCount % 3) {
      throw new Error(`chunk ${chunk.name}: ${indexCount} indices is not a triangle list`);
    }
    const name = Buffer.from(chunkLabel(chunk.name), "utf8");
    const entry = { chunk, name, vertexCount, indexCount, offset };
    offset += chunkBytes(vertexCount, indexCount);
    return entry;
  });

  const buf = Buffer.alloc(offset);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { chunk } of layout) {
    const p = chunk.positions;
    for (let i = 0; i < p.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        if (p[i + c] < min[c]) {
          min[c] = p[i + c];
        }
        if (p[i + c] > max[c]) {
          max[c] = p[i + c];
        }
      }
    }
  }
  if (!Number.isFinite(min[0])) {
    min.fill(0);
    max.fill(0);
  }

  buf.write(VIEW_MAGIC, 0, "latin1");
  buf.writeUInt16LE(VIEW_VERSION, 4);
  buf.writeUInt16LE(chunks.length, 6);
  for (let c = 0; c < 3; c++) {
    buf.writeFloatLE(min[c], 8 + c * 4);
    buf.writeFloatLE(max[c], 20 + c * 4);
  }

  layout.forEach(({ chunk, name, vertexCount, indexCount, offset: dataOffset }, i) => {
    const row = HEADER_BYTES + i * CHUNK_BYTES;
    name.copy(buf, row);
    buf.writeUInt32LE(vertexCount, row + 16);
    buf.writeUInt32LE(indexCount, row + 20);
    buf.writeUInt32LE(dataOffset, row + 24);
    buf.writeUInt32LE(0, row + 28);

    let o = dataOffset;
    Buffer.from(chunk.positions.buffer, chunk.positions.byteOffset, vertexCount * 12).copy(buf, o);
    o += vertexCount * 12;
    Buffer.from(chunk.floorZ.buffer, chunk.floorZ.byteOffset, vertexCount * 4).copy(buf, o);
    o += vertexCount * 4;
    Buffer.from(chunk.flags.buffer, chunk.flags.byteOffset, vertexCount).copy(buf, o);
    o += align4(vertexCount);
    Buffer.from(chunk.indices.buffer, chunk.indices.byteOffset, indexCount * 4).copy(buf, o);
  });
  return buf;
}

/** Parse and validate a `.view.bin` buffer (the inverse of writeViewBin). */
export function readViewBin(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length < HEADER_BYTES || buf.toString("latin1", 0, 4) !== VIEW_MAGIC) {
    throw new Error("not a view mesh (bad magic)");
  }
  const version = buf.readUInt16LE(4);
  if (version !== VIEW_VERSION) {
    throw new Error(`view mesh version ${version} is not ${VIEW_VERSION}`);
  }
  const chunkCount = buf.readUInt16LE(6);
  const bboxMin = [0, 1, 2].map((c) => buf.readFloatLE(8 + c * 4));
  const bboxMax = [0, 1, 2].map((c) => buf.readFloatLE(20 + c * 4));
  if (buf.length < HEADER_BYTES + chunkCount * CHUNK_BYTES) {
    throw new Error("view mesh chunk table runs past the end of the file");
  }

  const copy = (Type, start, count) =>
    new Type(
      buf.buffer.slice(
        buf.byteOffset + start,
        buf.byteOffset + start + count * Type.BYTES_PER_ELEMENT,
      ),
    );

  const chunks = [];
  for (let i = 0; i < chunkCount; i++) {
    const row = HEADER_BYTES + i * CHUNK_BYTES;
    const raw = buf.subarray(row, row + NAME_BYTES);
    const end = raw.indexOf(0);
    const name = raw.subarray(0, end < 0 ? NAME_BYTES : end).toString("utf8");
    const vertexCount = buf.readUInt32LE(row + 16);
    const indexCount = buf.readUInt32LE(row + 20);
    const dataOffset = buf.readUInt32LE(row + 24);
    if (dataOffset % 4) {
      throw new Error(`chunk ${name}: data offset ${dataOffset} is not 4-byte aligned`);
    }
    if (indexCount % 3) {
      throw new Error(`chunk ${name}: ${indexCount} indices is not a triangle list`);
    }
    if (dataOffset + chunkBytes(vertexCount, indexCount) > buf.length) {
      throw new Error(`chunk ${name} runs past the end of the file`);
    }
    let o = dataOffset;
    const positions = copy(Float32Array, o, vertexCount * 3);
    o += vertexCount * 12;
    const floorZ = copy(Float32Array, o, vertexCount);
    o += vertexCount * 4;
    const flags = copy(Uint8Array, o, vertexCount);
    o += align4(vertexCount);
    const indices = copy(Uint32Array, o, indexCount);
    for (let k = 0; k < indexCount; k++) {
      if (indices[k] >= vertexCount) {
        throw new Error(`chunk ${name}: index ${indices[k]} is past ${vertexCount} vertices`);
      }
    }
    chunks.push({ name, vertexCount, indexCount, dataOffset, positions, floorZ, flags, indices });
  }
  return { version, bboxMin, bboxMax, chunks };
}

/**
 * Chunk names for a map's minimap volumes, in the order they are written:
 * volumes by name (numeric-aware), then "world" for everything outside them.
 */
function orderVolumes(volumes) {
  return [...volumes].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
}

/**
 * Build a map's view mesh from its render-world export, .glb or .gltf.
 *
 *   floors    FloorIndex over the walkable surfaces (nav areas, or collision)
 *   playable  distanceField over the same surfaces; geometry farther than
 *             `ring` from all of it is skyline and dropped
 *   volumes   [{ name, minX, maxX, minY, maxY }] -- cs_minimap_volume boxes;
 *             one chunk each, plus "world"
 */
export async function buildViewMesh(
  worldPath,
  {
    floors,
    playable = null,
    volumes = [],
    error = 3,
    lockBorder = true,
    minComponent = 12,
    maxEdge = 256,
    ring = 2048,
    targetTriangles = 1_000_000,
    maxTriangles = 1_500_000,
    maxBytes = 64 * 1024 * 1024,
  } = {},
) {
  await MeshoptSimplifier.ready;

  const stats = {
    nodes: 0,
    dropped: {},
    trianglesIn: 0,
    trianglesKept: 0,
    trianglesSimplified: 0,
    trianglesOut: 0,
    vertices: 0,
    error,
    lockBorder,
    foliageError: null,
  };
  const far = (x, y) => playable !== null && playable.at(x, y) > ring;
  const coarseRing = ring + maxEdge;

  const glb = openGltf(worldPath);
  const meshes = [];
  try {
    for (const node of meshNodes(glb.gltf)) {
      stats.nodes += 1;
      const surface = classifyNode(node.name);
      const primitives = glb.gltf.meshes[node.mesh].primitives;
      const count = primitives.reduce((n, p) => {
        const accessor = p.indices ?? p.attributes.POSITION;
        return n + Math.floor(glb.gltf.accessors[accessor].count / 3);
      }, 0);
      stats.trianglesIn += count;
      if (surface === null) {
        const kind = node.name.replace(/\d+/g, "#").replace(/^n#_lr#_(c#_)?/, "");
        stats.dropped[kind] = (stats.dropped[kind] ?? 0) + count;
        continue;
      }
      let mesh = readNode(glb, node);
      if (!mesh) {
        continue;
      }
      if (playable !== null) {
        const p = mesh.positions;
        const i = mesh.indices;
        mesh = keepTriangles(mesh, (t) => {
          let x0 = Infinity;
          let y0 = Infinity;
          let x1 = -Infinity;
          let y1 = -Infinity;
          for (let k = 0; k < 3; k++) {
            const v = i[t * 3 + k] * 3;
            if (playable.at(p[v], p[v + 1]) <= coarseRing) {
              return true;
            }
            x0 = Math.min(x0, p[v]);
            y0 = Math.min(y0, p[v + 1]);
            x1 = Math.max(x1, p[v]);
            y1 = Math.max(y1, p[v + 1]);
          }
          return x1 - x0 > coarseRing || y1 - y0 > coarseRing;
        });
      }
      mesh = dropSmallComponents(mesh, minComponent);
      if (!mesh.indices.length) {
        continue;
      }
      stats.trianglesKept += mesh.indices.length / 3;
      meshes.push({ name: node.name, surface, simplified: simplifyMesh(mesh, error, lockBorder) });
    }
  } finally {
    glb.close();
  }

  const orderedVolumes = orderVolumes(volumes);
  const chunkNames = [...orderedVolumes.map((v) => v.name), "world"];
  const assemble = () => {
    const pieces = chunkNames.map(() => []);
    for (const entry of meshes) {
      let mesh = tessellate(entry.simplified, maxEdge);
      if (playable !== null) {
        const p = mesh.positions;
        const i = mesh.indices;
        mesh = keepTriangles(mesh, (t) => {
          for (let k = 0; k < 3; k++) {
            const v = i[t * 3 + k] * 3;
            if (!far(p[v], p[v + 1])) {
              return true;
            }
          }
          return false;
        });
      }
      if (!mesh.indices.length) {
        continue;
      }

      const { positions, indices } = mesh;
      const triangles = indices.length / 3;
      const owner = new Uint16Array(triangles);
      const used = new Set();
      for (let t = 0; t < triangles; t++) {
        let chunk = orderedVolumes.length;
        if (orderedVolumes.length) {
          let cx = 0;
          let cy = 0;
          for (let k = 0; k < 3; k++) {
            cx += positions[indices[t * 3 + k] * 3] / 3;
            cy += positions[indices[t * 3 + k] * 3 + 1] / 3;
          }
          const hit = orderedVolumes.findIndex(
            (v) => cx >= v.minX && cx <= v.maxX && cy >= v.minY && cy <= v.maxY,
          );
          if (hit >= 0) {
            chunk = hit;
          }
        }
        owner[t] = chunk;
        used.add(chunk);
      }
      for (const chunk of [...used].sort((a, b) => a - b)) {
        const piece = used.size === 1 ? mesh : keepTriangles(mesh, (t) => owner[t] === chunk);
        pieces[chunk].push({ surface: entry.surface, mesh: piece });
      }
    }

    const chunks = [];
    pieces.forEach((list, c) => {
      const vertexCount = list.reduce((n, p) => n + p.mesh.positions.length / 3, 0);
      const indexCount = list.reduce((n, p) => n + p.mesh.indices.length, 0);
      if (!indexCount) {
        return;
      }
      const positions = new Float32Array(vertexCount * 3);
      const floorZ = new Float32Array(vertexCount);
      const flags = new Uint8Array(vertexCount);
      const indices = new Uint32Array(indexCount);
      let v = 0;
      let i = 0;
      for (const { surface, mesh } of list) {
        positions.set(mesh.positions, v * 3);
        for (let k = 0; k < mesh.indices.length; k++) {
          indices[i + k] = mesh.indices[k] + v;
        }
        const n = mesh.positions.length / 3;
        for (let k = 0; k < n; k++) {
          const x = mesh.positions[k * 3];
          const y = mesh.positions[k * 3 + 1];
          const z = mesh.positions[k * 3 + 2];
          const floor = floors ? floors.floor(x, y, z) : { z: NaN, outside: false };
          floorZ[v + k] = floor.z;
          flags[v + k] = surface | (floor.outside ? FLAG_OUTSIDE : 0);
        }
        v += n;
        i += mesh.indices.length;
      }
      chunks.push({ name: chunkNames[c], positions, floorZ, flags, indices });
    });
    return chunks;
  };

  let chunks = assemble();
  const size = () =>
    HEADER_BYTES +
    chunks.length * CHUNK_BYTES +
    chunks.reduce((n, c) => n + chunkBytes(c.positions.length / 3, c.indices.length), 0);
  const tris = () => chunks.reduce((n, c) => n + c.indices.length / 3, 0);
  // Over the target, foliage goes first: leaf cards are two-triangle pieces
  // the edge-collapse simplifier cannot touch (rush_001's poplars alone are
  // 280k triangles at 3u), so it is clustered instead. Then borders unlock --
  // doubling the error with them locked barely moves an aggregate, which is a
  // pile of open prop shells -- except on walkable floors, and only then does
  // the error grow.
  while ((tris() > targetTriangles || size() > maxBytes) && stats.error < 64) {
    let foliageOnly = false;
    if (stats.foliageError === null) {
      stats.foliageError = stats.error * 4;
      foliageOnly = true;
    } else if (stats.lockBorder) {
      stats.lockBorder = false;
    } else {
      stats.error *= 2;
      stats.foliageError *= 2;
    }
    for (const entry of meshes) {
      if (entry.surface === SURFACE_FOLIAGE) {
        entry.simplified = clusterMesh(entry.simplified, stats.foliageError);
      } else if (!foliageOnly) {
        entry.simplified = simplifyMesh(entry.simplified, stats.error, stats.lockBorder, floors);
      }
    }
    chunks = assemble();
  }
  if (tris() > maxTriangles || size() > maxBytes) {
    throw new Error(
      `view mesh is ${tris().toLocaleString()} triangles / ` +
        `${(size() / 1e6).toFixed(1)} MB at ${stats.error}u, over the ` +
        `${maxTriangles.toLocaleString()} / ${(maxBytes / 1e6).toFixed(0)} MB ` +
        "the viewer accepts",
    );
  }

  stats.trianglesSimplified = triangleCount(meshes.map((m) => m.simplified));
  const byName = {};
  for (const entry of meshes) {
    const kind = entry.name.replace(/^n\d+_lr\d+_(c\d+_)?/, "").replace(/\d+/g, "#");
    byName[kind] = (byName[kind] ?? 0) + entry.simplified.indices.length / 3;
  }
  stats.largest = Object.entries(byName)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([kind, triangles]) => ({ kind, triangles }));
  stats.trianglesOut = tris();
  stats.vertices = chunks.reduce((n, c) => n + c.positions.length / 3, 0);
  stats.chunks = chunks.map((c) => ({
    name: chunkLabel(c.name),
    triangles: c.indices.length / 3,
    vertices: c.positions.length / 3,
  }));
  if (!chunks.length) {
    chunks = [
      {
        name: "world",
        positions: new Float32Array(0),
        floorZ: new Float32Array(0),
        flags: new Uint8Array(0),
        indices: new Uint32Array(0),
      },
    ];
  }
  return { buf: writeViewBin(chunks), stats };
}
