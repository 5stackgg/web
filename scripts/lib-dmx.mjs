// A reader for Valve's binary DMX.
//
// COPIED from 5stack-inventory-plugin/tools/dmx.mjs, which wrote it to get
// weapon animations out of `.vnmclip_c`. It is here because map CALLOUTS need
// the same reader for a different asset: Source2Viewer decompiles an
// `env_cs_place` volume's `.vmdl_c` into a ModelDoc that only REFERENCES its
// geometry, and the vertices are in the companion `<model>_hull.dmx` -- the
// same `binary 9 / model 22` container. Separate repos, so this is a copy;
// keep them in step if either grows a fix.
//
// Original notes follow.
//
// A reader for Valve's binary DMX, enough of it to get animation out.
//
// WHY THIS EXISTS. CS2's per-weapon first-person animations are not in the
// weapon's `.vmdl_c` — that file declares five world-model sequences and none of
// them moves (`inventory_inspect` is a single keyframe). The real ones live in
// `animation/anims/viewmodel/<family>/<weapon>/lookat01_<weapon>.vnmclip_c`,
// 642 clips across 66 weapon families, and Source2Viewer-CLI decompiles each to
// a binary DMX. Nothing in the toolchain reads that, so this does.
//
// SCOPE IS DELIBERATELY NARROW: parse the container, hand back a graph of
// elements, and let the caller pick the animation out of it. This is not a
// general DMX library and should not grow into one — every type below is here
// because a CS2 animation clip actually contains it.
//
// FORMAT, as measured against `lookat01_ak.dmx`
// (`<!-- dmx encoding binary 9 format model 22 -->`):
//
//   "<!-- dmx encoding binary N format F -->\n\0"
//   int32   prefix element count      (0 in every clip seen)
//   int32   string count              (238)
//   char[]  that many NUL-terminated UTF-8 strings
//   int32   element count             (512)
//   element[]  { int32 typeIdx, int32 nameIdx, byte[16] guid }
//   for each element: int32 attrCount, then { int32 nameIdx, byte type, value }
//
// The v9 quirk that matters: with a string dictionary present, STRING
// attributes are an int32 index into it, but the elements of a STRING ARRAY are
// written inline as NUL-terminated bytes. Getting that backwards desynchronises
// the whole rest of the file, which is why it is called out here rather than
// discovered again later.

/** Attribute type ids. Values above ARRAY_BASE are arrays of `type - ARRAY_BASE`. */
const T = {
  ELEMENT: 1,
  INT: 2,
  FLOAT: 3,
  BOOL: 4,
  STRING: 5,
  BINARY: 6,
  TIME: 7,
  COLOR: 8,
  VECTOR2: 9,
  VECTOR3: 10,
  VECTOR4: 11,
  QANGLE: 12,
  QUATERNION: 13,
  MATRIX: 14,
  UINT64: 15,
  UINT8: 16,
};
/**
 * Arrays start after the LAST scalar, not after MATRIX.
 *
 * Measured: a clip contains attribute type 19, and 19 is not a scalar. With a
 * base of 14 that would decode as an array of QUATERNION and desync the file a
 * few bytes later; with 16 it is an array of FLOAT, which is exactly what a
 * channel's key times and values are. The two extra scalars below (UINT64,
 * UINT8) are what pushes the base from 14 to 16.
 */
const ARRAY_BASE = 32;

/** Fixed-size scalar readers, keyed by type id. */
const SCALAR = {
  [T.INT]: (r) => r.i32(),
  [T.FLOAT]: (r) => r.f32(),
  [T.BOOL]: (r) => r.u8() !== 0,
  // DMX time is stored as ten-thousandths of a second.
  [T.TIME]: (r) => r.i32() / 10000,
  [T.COLOR]: (r) => [r.u8(), r.u8(), r.u8(), r.u8()],
  [T.VECTOR2]: (r) => [r.f32(), r.f32()],
  [T.VECTOR3]: (r) => [r.f32(), r.f32(), r.f32()],
  [T.VECTOR4]: (r) => [r.f32(), r.f32(), r.f32(), r.f32()],
  [T.QANGLE]: (r) => [r.f32(), r.f32(), r.f32()],
  [T.QUATERNION]: (r) => [r.f32(), r.f32(), r.f32(), r.f32()],
  [T.MATRIX]: (r) => Array.from({ length: 16 }, () => r.f32()),
  // Read as a hex string: nothing here does arithmetic on it, and BigInt would
  // make the result unserialisable to JSON without a custom replacer.
  [T.UINT64]: (r) => r.bytes(8).toString("hex"),
  [T.UINT8]: (r) => r.u8(),
};

class Reader {
  constructor(buf) {
    this.b = buf;
    this.p = 0;
  }
  u8() {
    return this.b[this.p++];
  }
  i32() {
    const v = this.b.readInt32LE(this.p);
    this.p += 4;
    return v;
  }
  f32() {
    const v = this.b.readFloatLE(this.p);
    this.p += 4;
    return v;
  }
  /** NUL-terminated UTF-8, as written inline. */
  cstr() {
    const e = this.b.indexOf(0, this.p);
    const s = this.b.slice(this.p, e).toString("utf8");
    this.p = e + 1;
    return s;
  }
  bytes(n) {
    const s = this.b.slice(this.p, this.p + n);
    this.p += n;
    return s;
  }
}

/**
 * Parse a binary DMX buffer.
 *
 * Returns `{ encoding, version, format, elements }` where each element is
 * `{ type, name, attrs }` and any ELEMENT-typed attribute has been resolved to
 * the element object itself, so the caller can walk the graph by name rather
 * than by index. Cycles are fine — the array is built before linking.
 */
export function parseDmx(buf) {
  const r = new Reader(buf);
  /** Last attribute entered, for error messages. See the assignment below. */
  let where = "<header>";
  const header = r.cstr();
  const m = /encoding (\w+) (\d+) format (\w+) (\d+)/.exec(header);
  if (!m) throw new Error(`not a DMX header: ${JSON.stringify(header.slice(0, 80))}`);
  const [, encoding, version, format] = m;
  if (encoding !== "binary") throw new Error(`only binary DMX is supported, got ${encoding}`);
  const ver = Number(version);
  if (ver < 9) throw new Error(`DMX binary v${ver} is older than anything CS2 ships`);

  // Prefix elements carry export metadata and are not part of the graph. None of
  // the clips seen has any; skipping rather than parsing keeps this honest about
  // what it has actually been tested against.
  const prefixCount = r.i32();
  if (prefixCount !== 0) throw new Error(`prefix elements are not handled (found ${prefixCount})`);

  const strCount = r.i32();
  const strings = [];
  for (let i = 0; i < strCount; i++) strings.push(r.cstr());
  const str = (i) => strings[i] ?? "";

  const elCount = r.i32();
  const elements = [];
  for (let i = 0; i < elCount; i++) {
    const type = str(r.i32());
    const name = str(r.i32());
    r.bytes(16); // GUID — nothing here resolves by it, so it is read past.
    elements.push({ type, name, attrs: {} });
  }

  /** Read one attribute value. `link` defers ELEMENT refs until every element exists. */
  const value = (type) => {
    if (type === T.ELEMENT) {
      const idx = r.i32();
      // -1 is null; -2 means "external, identified by a GUID string that
      // follows". Neither appears inside a clip's channel graph, but a
      // silently-misread index would desync the file, so both are consumed.
      if (idx === -2) return { external: r.cstr() };
      return idx < 0 ? null : { ref: idx };
    }
    if (type === T.STRING) return str(r.i32());
    if (type === T.BINARY) return r.bytes(r.i32());
    const read = SCALAR[type];
    if (!read) throw new Error(`unknown DMX attribute type ${type} — at ${where}`);
    return read(r);
  };

  for (let i = 0; i < elCount; i++) {
    const attrCount = r.i32();
    for (let a = 0; a < attrCount; a++) {
      const name = str(r.i32());
      const type = r.u8();
      // Context on the way IN, not on the way out: an unknown type means the
      // read head has already desynced, so "type 17 at byte 91234" is useless
      // without the element and attribute that were being read when it hit.
      where = `element ${i} <${elements[i].type} "${elements[i].name}"> attr "${name}" type ${type} @${r.p}`;
      if (type > ARRAY_BASE) {
        const inner = type - ARRAY_BASE;
        const n = r.i32();
        const arr = new Array(n);
        for (let k = 0; k < n; k++) {
          // THE v9 QUIRK: array elements of STRING are inline, not indices.
          arr[k] = inner === T.STRING ? r.cstr() : value(inner);
        }
        elements[i].attrs[name] = arr;
      } else {
        elements[i].attrs[name] = value(type);
      }
    }
  }

  // Link refs now that every element exists.
  const link = (v) => {
    if (Array.isArray(v)) return v.map(link);
    if (v && typeof v === "object" && "ref" in v) return elements[v.ref] ?? null;
    return v;
  };
  for (const el of elements) {
    for (const k of Object.keys(el.attrs)) el.attrs[k] = link(el.attrs[k]);
  }

  return { encoding, version: ver, format, elements };
}
