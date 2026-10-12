import {
  analyseMap,
  expandPrep,
  type GroundFill,
  type PrepArea,
  type PrepChunk,
  type PrepCore,
  type PrepResult,
} from "./mapPrep";

/**
 * A `PrepCore` as one buffer, for the browser's cache and for publishing
 * next to a map's meshes (`<map>.prep.bin.gz`, scripts/replay-stage/
 * build-prep.mjs). Bump PREP_VERSION whenever prep's output changes: a
 * stored core of another version, or made from another mesh, is ignored and
 * the map is prepped again.
 *
 * Layout: "5SPC", u32 version, u32 header length, the header (JSON: the
 * fingerprint, the scalars, and where each array is), then the arrays, each
 * 8-byte aligned.
 */
import { PREP_VERSION } from "./assetVersions";

export { PREP_VERSION };

const MAGIC = "5SPC";

type ArrayKind = "u8" | "i8" | "u16" | "i16" | "u32" | "f32";

const CTORS = {
  u8: Uint8Array,
  i8: Int8Array,
  u16: Uint16Array,
  i16: Int16Array,
  u32: Uint32Array,
  f32: Float32Array,
} as const;

type Entry = { name: string; kind: ArrayKind; offset: number; length: number };

type Header = {
  version: number;
  fingerprint: string;
  scalars: {
    solidCuttable: number;
    solidGhost: number;
    seeCuttable: number;
    seeGhost: number;
    ms: number;
    ground: Omit<GroundFill, "z" | "enclosed" | "open">;
  };
  arrays: Entry[];
};

function kindOf(array: ArrayBufferView): ArrayKind {
  if (array instanceof Uint8Array) return "u8";
  if (array instanceof Int8Array) return "i8";
  if (array instanceof Uint16Array) return "u16";
  if (array instanceof Int16Array) return "i16";
  if (array instanceof Uint32Array) return "u32";
  return "f32";
}

/**
 * Identifies the mesh and callouts a core was made from: sizes, bounds and
 * a hash over a sample of the data, so a different build of the map (or a
 * different prep) never reuses it.
 */
export function prepFingerprint(chunks: PrepChunk[], areas: PrepArea): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h ^= n;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  let vertices = 0;
  let indices = 0;
  for (const chunk of chunks) {
    vertices += chunk.floorZ.length;
    indices += chunk.indices.length;
    const bits = new Uint32Array(
      chunk.positions.buffer,
      chunk.positions.byteOffset,
      chunk.positions.length,
    );
    for (let i = 0; i < bits.length; i += 1009) {
      mix(bits[i]);
    }
    for (let i = 0; i < chunk.indices.length; i += 1013) {
      mix(chunk.indices[i]);
    }
    for (let i = 0; i < chunk.flags.length; i += 1019) {
      mix(chunk.flags[i]);
    }
  }
  for (const box of areas) {
    for (const v of [...box.min, ...box.max]) {
      mix(Math.round(v * 16) | 0);
    }
  }
  return `${PREP_VERSION}:${vertices}:${indices}:${areas.length}:${h.toString(16)}`;
}

export function packPrep(core: PrepCore, fingerprint: string): ArrayBuffer {
  const named: Array<[string, ArrayBufferView & { length: number }]> = [
    ["solidOrder", core.solidOrder],
    ["seeOrder", core.seeOrder],
    ["info", core.info],
    ["cut", core.cut],
    ["remote", core.remote],
    ["canopy", core.canopy],
    ["ground.z", core.ground.z],
    ["ground.enclosed", core.ground.enclosed],
    ["ground.open", core.ground.open],
  ];
  const arrays: Entry[] = [];
  let offset = 0;
  for (const [name, array] of named) {
    arrays.push({ name, kind: kindOf(array), offset, length: array.length });
    offset += Math.ceil(array.byteLength / 8) * 8;
  }
  const { z: _z, enclosed: _e, open: _o, ...ground } = core.ground;
  const header: Header = {
    version: PREP_VERSION,
    fingerprint,
    scalars: {
      solidCuttable: core.solidCuttable,
      solidGhost: core.solidGhost,
      seeCuttable: core.seeCuttable,
      seeGhost: core.seeGhost,
      ms: core.ms,
      ground,
    },
    arrays,
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const start = Math.ceil((12 + json.length) / 8) * 8;
  const buffer = new ArrayBuffer(start + offset);
  const bytes = new Uint8Array(buffer);
  bytes.set(new TextEncoder().encode(MAGIC), 0);
  const view = new DataView(buffer);
  view.setUint32(4, PREP_VERSION, true);
  view.setUint32(8, json.length, true);
  bytes.set(json, 12);
  named.forEach(([, array], i) => {
    bytes.set(
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
      start + arrays[i].offset,
    );
  });
  return buffer;
}

/** Views into `buffer`, or null when it is not a core for this mesh and version. */
export function unpackPrep(
  buffer: ArrayBuffer,
  fingerprint: string,
): PrepCore | null {
  if (buffer.byteLength < 12) {
    return null;
  }
  const bytes = new Uint8Array(buffer);
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== MAGIC) {
    return null;
  }
  const view = new DataView(buffer);
  if (view.getUint32(4, true) !== PREP_VERSION) {
    return null;
  }
  const length = view.getUint32(8, true);
  if (12 + length > buffer.byteLength) {
    return null;
  }
  const header = JSON.parse(
    new TextDecoder().decode(bytes.subarray(12, 12 + length)),
  ) as Header;
  if (header.version !== PREP_VERSION || header.fingerprint !== fingerprint) {
    return null;
  }
  const start = Math.ceil((12 + length) / 8) * 8;
  const get = (name: string) => {
    const entry = header.arrays.find((a) => a.name === name);
    if (!entry) {
      throw new Error(`prep core is missing ${name}`);
    }
    const ctor = CTORS[entry.kind];
    return new ctor(buffer, start + entry.offset, entry.length);
  };
  const { scalars } = header;
  return {
    solidOrder: get("solidOrder") as Uint32Array,
    seeOrder: get("seeOrder") as Uint32Array,
    solidCuttable: scalars.solidCuttable,
    solidGhost: scalars.solidGhost,
    seeCuttable: scalars.seeCuttable,
    seeGhost: scalars.seeGhost,
    info: get("info") as Uint16Array,
    cut: get("cut") as Int16Array,
    remote: get("remote") as Uint8Array,
    canopy: get("canopy") as Int8Array,
    ground: {
      ...scalars.ground,
      z: get("ground.z") as Float32Array,
      enclosed: get("ground.enclosed") as Uint8Array,
      open: get("ground.open") as Uint8Array,
    },
    ms: scalars.ms,
  };
}

export type PrepRequest = {
  chunks: PrepChunk[];
  areas: PrepArea;
  fingerprint: string;
  /** A packed core from the cache or the CDN, when there is one. */
  core: ArrayBuffer | null;
};

export type PrepReply = {
  result: PrepResult;
  /** The core packed, when it was made here (for the cache). */
  packed: ArrayBuffer | null;
};

/** Expands a usable core, or preps from scratch and packs the core made. */
export function runPrep(request: PrepRequest): PrepReply {
  const core = request.core && unpackPrep(request.core, request.fingerprint);
  if (core) {
    return { result: expandPrep(request.chunks, core), packed: null };
  }
  const made = analyseMap(request.chunks, request.areas);
  return {
    result: expandPrep(request.chunks, made),
    packed: packPrep(made, request.fingerprint),
  };
}
