// @vitest-environment node
import { describe, expect, it } from "vitest";
import { blobAs, parseKv3 } from "~/scripts/lib-kv3.mjs";

describe("parseKv3", () => {
  it("reads the shapes KV3TextSerializer writes", () => {
    const text = [
      "<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->",
      "{",
      '\tname = "de_\\"quoted\\"\\tmap"',
      "\tcount = -12",
      "\tscale = 1.5e2",
      "\ton = true",
      "\toff = false",
      "\tnothing = null",
      "\t// a comment",
      "\tshort = [ 1, 2, 3 ]",
      "\tlong = ",
      "\t[",
      "\t\t{",
      '\t\t\t"quoted key" = 4',
      "\t\t},",
      "\t\t/* block */ 5,",
      "\t]",
      '\tmodel = resource_name:"maps/x.vmdl"',
      "\tchild = ",
      "\t{",
      "\t\tdeep = 0.25",
      "\t}",
      '\tnotes = """',
      "two",
      'lines"',
      '"""',
      "\tbytes = #[ 00 1F a0 FF ]",
      "\tempty = #[  ]",
      "}",
    ].join("\n");
    const kv = parseKv3(text);
    expect(kv.name).toBe('de_"quoted"\tmap');
    expect(kv.count).toBe(-12);
    expect(kv.scale).toBe(150);
    expect([kv.on, kv.off, kv.nothing]).toEqual([true, false, null]);
    expect(kv.short).toEqual([1, 2, 3]);
    expect(kv.long[0]["quoted key"]).toBe(4);
    expect(kv.long[1]).toBe(5);
    expect(kv.model).toBe("maps/x.vmdl");
    expect(kv.child.deep).toBe(0.25);
    expect(kv.notes).toBe('two\nlines"');
    expect([...kv.bytes]).toEqual([0x00, 0x1f, 0xa0, 0xff]);
    expect(kv.empty.length).toBe(0);
  });

  it("reads a multi-line blob", () => {
    const bytes = Array.from({ length: 40 }, (_, i) => i);
    const hex = bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase());
    const text = `{\n\tdata = \n\t#[\n\t\t${hex.slice(0, 32).join(" ")}\n\t\t${hex.slice(32).join(" ")}\n\t]\n}`;
    expect([...parseKv3(text).data]).toEqual(bytes);
  });

  it("names the line a syntax error is on", () => {
    expect(() => parseKv3("{\n\ta = 1\n\tb 2\n}")).toThrow("KV3 line 3: expected = after b");
    expect(() => parseKv3("{\n\ta = #[ 0G ]\n}")).toThrow('KV3 line 2: bad blob byte "0G"');
    expect(() => parseKv3('{\n\ta = "open\n}')).toThrow("unterminated string");
  });
});

describe("blobAs", () => {
  it("reads a blob as little-endian typed values, dropping a ragged tail", () => {
    const bytes = new Uint8Array([0x01, 0x00, 0xff, 0xff, 0x07]);
    expect([...blobAs(Int16Array, bytes)]).toEqual([1, -1]);
    expect(() => blobAs(Int16Array, [1, 2])).toThrow("expected a binary blob");
  });
});
