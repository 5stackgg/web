export type Vec3 = [number, number, number];

class Writer {
  bytes: number[] = [];

  u8(v: number) {
    this.bytes.push(v & 0xff);
  }

  u32(v: number) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v >>> 0);
    this.bytes.push(...b);
  }

  f32(v: number) {
    const b = Buffer.alloc(4);
    b.writeFloatLE(v);
    this.bytes.push(...b);
  }

  raw(values: number[]) {
    this.bytes.push(...values);
  }

  buffer() {
    return Buffer.from(this.bytes);
  }
}

// Stand-in for the KV3 blobs a real nav carries: the parser must find the
// corner array and area list by shape, never by decoding these.
function kv3Blob(length: number) {
  const out = [0x05, 0x33, 0x56, 0x4b];
  for (let i = 0; out.length < length; i++) {
    out.push((i * 37 + 11) & 0xff);
  }
  return out;
}

/**
 * A nav in the v36 layout. `ids` names one area per polygon unless given
 * shorter; `gap` is the filler between the polygons and the area list.
 */
export function buildNav(
  polygons: Vec3[][],
  ids: number[] = polygons.map((_, i) => i + 1),
  { version = 36, gap = 32 }: { version?: number; gap?: number } = {},
) {
  const corners: Vec3[] = [];
  const indexOf = (c: Vec3) => {
    const found = corners.findIndex((k) => k.every((v, i) => v === c[i]));
    if (found >= 0) {
      return found;
    }
    corners.push(c);
    return corners.length - 1;
  };
  const polygonIndices = polygons.map((p) => p.map(indexOf));

  const w = new Writer();
  w.u32(0xfeedface);
  w.u32(version);
  w.u32(1);
  w.raw(kv3Blob(53));
  w.u32(corners.length);
  for (const c of corners) {
    c.forEach((v) => w.f32(v));
  }
  w.u32(polygonIndices.length);
  for (const p of polygonIndices) {
    w.u8(p.length);
    p.forEach((i) => w.u32(i));
    w.u32(0xffffffff);
  }
  w.raw([0, 0, 0]);
  w.raw(kv3Blob(gap));
  w.u32(ids.length);
  ids.forEach((id, a) => {
    w.u32(id);
    w.u32(0);
    w.u32(0);
    w.u8(0);
    w.u32(a);
    w.u32(0);
    for (let edge = 0; edge < polygonIndices[a].length; edge++) {
      const connected = edge === 0 && a + 1 < ids.length;
      w.u32(connected ? 1 : 0);
      if (connected) {
        w.u32(ids[a + 1]);
        w.u32(2);
      }
    }
    w.raw([0, 0, 0, 0, 0]);
    w.u32(0);
    w.u32(0);
  });
  w.raw([1, 2, 3, 4]);
  return w.buffer();
}

const METERS_PER_UNIT = 0.0254;

/**
 * A glb with one mesh node per entry. `render` writes it the way
 * Source2Viewer exports a render world -- metres, source (x, y, z) stored as
 * glTF (y, z, x) -- otherwise positions stay in source units, as in a physics
 * export.
 */
export function buildGlb(
  nodes: { name: string; triangles: Vec3[][] }[],
  { render = true }: { render?: boolean } = {},
) {
  const chunks: Buffer[] = [];
  const accessors: object[] = [];
  const bufferViews: object[] = [];
  let offset = 0;
  const push = (data: Buffer, accessor: object) => {
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
    accessors.push({ bufferView: bufferViews.length - 1, ...accessor });
    chunks.push(data);
    offset += data.length;
    return accessors.length - 1;
  };

  const meshes = nodes.map(({ name, triangles }) => {
    const points = triangles.flat();
    const positions = Buffer.alloc(points.length * 12);
    points.forEach(([x, y, z], i) => {
      const stored = render
        ? [y * METERS_PER_UNIT, z * METERS_PER_UNIT, x * METERS_PER_UNIT]
        : [x, y, z];
      stored.forEach((v, c) => positions.writeFloatLE(v, i * 12 + c * 4));
    });
    const indices = Buffer.alloc(points.length * 4);
    points.forEach((_, i) => indices.writeUInt32LE(i, i * 4));
    const position = push(positions, {
      componentType: 5126,
      count: points.length,
      type: "VEC3",
    });
    const index = push(indices, {
      componentType: 5125,
      count: points.length,
      type: "SCALAR",
    });
    return { name, primitives: [{ attributes: { POSITION: position }, indices: index }] };
  });

  const bin = Buffer.concat(chunks);
  const json = Buffer.from(
    JSON.stringify({
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: nodes.map((_, i) => i) }],
      nodes: nodes.map(({ name }, i) => ({ name, mesh: i })),
      meshes,
      accessors,
      bufferViews,
      buffers: [{ byteLength: bin.length }],
    }),
  );
  const pad = (b: Buffer, fill: number) =>
    Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
  const jsonChunk = pad(json, 0x20);
  const binChunk = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunkHeader = (length: number, type: number) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(length, 0);
    b.writeUInt32LE(type, 4);
    return b;
  };
  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, 0x4e4f534a),
    jsonChunk,
    chunkHeader(binChunk.length, 0x004e4942),
    binChunk,
  ]);
}

export const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): Vec3[][] => [
  [a, b, c],
  [a, c, d],
];
