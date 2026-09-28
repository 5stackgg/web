// A glTF reader that never holds the whole file.
//
// A render-world export is big -- rush_001's world.glb is 1.2 GB, almost all of
// it UVs, normals and tangents nothing here reads -- so only the JSON is
// parsed up front and each accessor is read on demand from its own byte range.
// A .glb carries one BIN chunk; a .gltf names its buffers as files beside it,
// which is how a world over the .glb's 2 GiB cap comes out (see
// extract-map-meshes.mjs).
import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import { dirname, join } from "node:path";

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function readBytes(path, fd, position, length) {
  const out = Buffer.allocUnsafe(length);
  let done = 0;
  while (done < length) {
    const n = readSync(fd, out, done, length - done, position + done);
    if (n <= 0) {
      throw new Error(`${path}: short read at ${position + done}`);
    }
    done += n;
  }
  return out;
}

/**
 * Float accessors come back as Float32Array, integer ones as Uint32Array,
 * tightly packed whatever the bufferView's stride was. `locate(buffer, index)`
 * says which file holds a buffer and at which byte of it the buffer starts.
 */
function accessorReader(gltf, locate) {
  return (index) => {
    const accessor = gltf.accessors[index];
    const width = TYPE_WIDTH[accessor.type];
    const size = COMPONENT_BYTES[accessor.componentType];
    const isFloat = accessor.componentType === 5126;
    const count = accessor.count * width;
    const out = isFloat ? new Float32Array(count) : new Uint32Array(count);
    if (accessor.bufferView == null || accessor.count === 0) {
      return out;
    }
    const view = gltf.bufferViews[accessor.bufferView];
    const { path, fd, origin } = locate(view.buffer ?? 0, index);
    const element = size * width;
    const stride = view.byteStride || element;
    const start = origin + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const bytes = readBytes(path, fd, start, stride * (accessor.count - 1) + element);
    if (stride === element && size === 4) {
      const packed = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + count * 4);
      return isFloat ? new Float32Array(packed) : new Uint32Array(packed);
    }
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    for (let i = 0; i < accessor.count; i++) {
      const base = i * stride;
      for (let c = 0; c < width; c++) {
        const o = base + c * size;
        out[i * width + c] = isFloat
          ? dv.getFloat32(o, true)
          : size === 4
            ? dv.getUint32(o, true)
            : size === 2
              ? dv.getUint16(o, true)
              : dv.getUint8(o);
      }
    }
    return out;
  };
}

export function openGlb(path) {
  const fd = openSync(path, "r");
  const head = Buffer.alloc(12);
  readSync(fd, head, 0, 12, 0);
  if (head.readUInt32LE(0) !== 0x46546c67) {
    closeSync(fd);
    throw new Error(`${path} is not a glb`);
  }
  const total = head.readUInt32LE(8);

  let gltf = null;
  let binOffset = -1;
  let offset = 12;
  const chunk = Buffer.alloc(8);
  while (offset < total) {
    readSync(fd, chunk, 0, 8, offset);
    const length = chunk.readUInt32LE(0);
    const type = chunk.readUInt32LE(4);
    if (type === 0x4e4f534a) {
      const json = Buffer.alloc(length);
      readSync(fd, json, 0, length, offset + 8);
      gltf = JSON.parse(json.toString("utf8"));
    } else if (type === 0x004e4942) {
      binOffset = offset + 8;
    }
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  if (!gltf) {
    closeSync(fd);
    throw new Error(`${path} has no JSON chunk`);
  }

  const read = accessorReader(gltf, (_buffer, index) => {
    if (binOffset < 0) {
      throw new Error(`${path}: accessor ${index} points at a missing BIN chunk`);
    }
    return { path, fd, origin: binOffset };
  });
  return { gltf, read, close: () => closeSync(fd) };
}

/**
 * A .glb, or a .gltf whose buffers are files beside it; either way the same
 * `{ gltf, read, close }` as openGlb. A buffer file is only opened once an
 * accessor in it is read.
 */
export function openGltf(path) {
  if (!path.endsWith(".gltf")) {
    return openGlb(path);
  }
  const gltf = JSON.parse(readFileSync(path, "utf8"));
  const files = new Map();
  const read = accessorReader(gltf, (buffer, index) => {
    if (!files.has(buffer)) {
      const uri = gltf.buffers?.[buffer]?.uri;
      if (!uri || uri.startsWith("data:")) {
        throw new Error(
          `${path}: accessor ${index} points at buffer ${buffer}, which is not a file`,
        );
      }
      const file = join(dirname(path), decodeURIComponent(uri));
      files.set(buffer, { path: file, fd: openSync(file, "r"), origin: 0 });
    }
    return files.get(buffer);
  });
  const close = () => {
    for (const { fd } of files.values()) {
      closeSync(fd);
    }
    files.clear();
  };
  return { gltf, read, close };
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function localMatrix(node) {
  if (node.matrix) {
    return node.matrix;
  }
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const xx = qx * qx;
  const yy = qy * qy;
  const zz = qz * qz;
  const xy = qx * qy;
  const xz = qx * qz;
  const yz = qy * qz;
  const wx = qw * qx;
  const wy = qw * qy;
  const wz = qw * qz;
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

/**
 * Every node that carries a mesh, with its world matrix (column-major), in
 * scene order: depth first, children in the order the file lists them.
 */
export function meshNodes(gltf) {
  const out = [];
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  const roots = scene?.nodes ?? gltf.nodes.map((_, i) => i);
  const visit = (index, parent) => {
    const node = gltf.nodes[index];
    const world = multiply(parent, localMatrix(node));
    if (node.mesh != null) {
      out.push({
        index,
        name: node.name ?? gltf.meshes[node.mesh].name ?? "",
        mesh: node.mesh,
        matrix: world,
      });
    }
    for (const child of node.children ?? []) {
      visit(child, world);
    }
  };
  for (const root of roots) {
    visit(root, IDENTITY);
  }
  return out;
}
