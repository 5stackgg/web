// A reader for KeyValues3 TEXT, the form Source2Viewer-CLI decompiles a
// compiled KV3 resource (a `.vdata_c`, for one) into. It is the shape
// ValveKeyValue's KV3TextSerializer writes:
//
//   <!-- kv3 encoding:text:version{…} format:generic:version{…} -->
//   {
//     key = "string"
//     n = 12
//     f = 1.5
//     on = true
//     nothing = null
//     list = [ 1, 2, 3 ]
//     asset = resource_name:"maps/x.vmdl"
//     bytes = #[ 00 1F A0 ]
//     child = { … }
//   }
//
// Objects come back as null-prototype objects, arrays as arrays, a binary
// blob as a Uint8Array, and a flagged value (`resource_name:"…"`) as the
// value alone. `//` and `/* */` comments and `"""` multi-line strings are
// understood; anything else is a syntax error with the line it is on.

const IDENT = /[A-Za-z0-9_.\-]/;

export class Kv3Error extends Error {}

export function parseKv3(text) {
  let i = 0;
  const n = text.length;

  const fail = (what) => {
    const line = text.slice(0, i).split("\n").length;
    throw new Kv3Error(`KV3 line ${line}: ${what}`);
  };

  const skip = () => {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++;
      if (text.startsWith("<!--", i)) {
        const end = text.indexOf("-->", i);
        if (end < 0) fail("unterminated header");
        i = end + 3;
      } else if (text.startsWith("//", i)) {
        const end = text.indexOf("\n", i);
        i = end < 0 ? n : end + 1;
      } else if (text.startsWith("/*", i)) {
        const end = text.indexOf("*/", i);
        if (end < 0) fail("unterminated comment");
        i = end + 2;
      } else {
        return;
      }
    }
  };

  const identifier = () => {
    const start = i;
    while (i < n && IDENT.test(text[i])) i++;
    return text.slice(start, i);
  };

  const string = () => {
    if (text.startsWith('"""', i)) {
      const end = text.indexOf('"""', i + 3);
      if (end < 0) fail("unterminated multi-line string");
      const body = text.slice(i + 3, end).replace(/^\r?\n/, "").replace(/\r?\n$/, "");
      i = end + 3;
      return body;
    }
    i++;
    let out = "";
    while (i < n && text[i] !== '"') {
      if (text[i] === "\\" && i + 1 < n) {
        const c = text[i + 1];
        out += c === "n" ? "\n" : c === "t" ? "\t" : c;
        i += 2;
      } else {
        out += text[i++];
      }
    }
    if (i >= n) fail("unterminated string");
    i++;
    return out;
  };

  const blob = () => {
    i += 2;
    const bytes = [];
    for (;;) {
      skip();
      if (text[i] === "]") {
        i++;
        return Uint8Array.from(bytes);
      }
      const hex = text.slice(i, i + 2);
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) fail(`bad blob byte "${hex}"`);
      bytes.push(parseInt(hex, 16));
      i += 2;
    }
  };

  const object = () => {
    i++;
    const out = Object.create(null);
    for (;;) {
      skip();
      if (i >= n) fail("unterminated object");
      if (text[i] === "}") {
        i++;
        return out;
      }
      const key = text[i] === '"' ? string() : identifier();
      if (!key) fail(`expected a key, found "${text[i]}"`);
      skip();
      if (text[i] !== "=") fail(`expected = after ${key}`);
      i++;
      out[key] = value();
    }
  };

  const array = () => {
    i++;
    const out = [];
    for (;;) {
      skip();
      if (i >= n) fail("unterminated array");
      if (text[i] === "]") {
        i++;
        return out;
      }
      out.push(value());
      skip();
      if (text[i] === ",") i++;
    }
  };

  function value() {
    skip();
    const c = text[i];
    if (c === "{") return object();
    if (c === "[") return array();
    if (c === '"') return string();
    if (c === "#" && text[i + 1] === "[") return blob();
    const word = identifier();
    if (!word) fail(`unexpected "${c}"`);
    // A flag: `resource_name:"…"`, `subclass:{…}`.
    if (text[i] === ":" && /^[A-Za-z_]/.test(word)) {
      i++;
      return value();
    }
    if (word === "true") return true;
    if (word === "false") return false;
    if (word === "null") return null;
    if (word === "nan") return NaN;
    if (word === "inf") return Infinity;
    if (word === "-inf") return -Infinity;
    const number = Number(word);
    if (!Number.isNaN(number)) return number;
    fail(`unexpected "${word}"`);
  }

  const root = value();
  skip();
  if (i < n) fail("trailing content after the root");
  return root;
}

/** The bytes of a blob, as a little-endian typed array of `Type`. */
export function blobAs(Type, bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Kv3Error("expected a binary blob");
  }
  const width = Type.BYTES_PER_ELEMENT;
  const copy = new Uint8Array(bytes.length - (bytes.length % width));
  copy.set(bytes.subarray(0, copy.length));
  return new Type(copy.buffer);
}
