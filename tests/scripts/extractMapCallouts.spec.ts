// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { extractCallouts } from "~/scripts/extract-map-callouts.mjs";
import { installFakeSourceViewer } from "../helpers/fakeMapTools";

const MAP = "de_fixture";

/** A decompiled entity lump: `====n====` blocks of `key<pad>value` lines. */
function lump(entities: Record<string, string>[]) {
  return entities
    .map(
      (entity, i) =>
        `====${i}====\n${Object.entries(entity)
          .map(([key, value]) => `${key.padEnd(30)} ${value}`)
          .join("\n")}\n`,
    )
    .join("\n");
}

const place = (name: string, x: number) => ({
  classname: '"env_cs_place"',
  place_name: `"${name}"`,
  origin: `"${x}.000000 0.000000 0.000000"`,
  mins: "[ -512.0, -512.0, -64.0 ]",
  maxs: "[ 512.0, 512.0, 128.0 ]",
});

describe("extractCallouts", () => {
  const dir = mkdtempSync(join(tmpdir(), "extract-callouts-"));
  const mapsDir = join(dir, "maps");
  const cli = installFakeSourceViewer(dir);
  mkdirSync(mapsDir);
  writeFileSync(join(mapsDir, `${MAP}.vpk`), "");

  const run = (lumps: Record<string, string>, output: Record<string, unknown> = {}) => {
    const plan: Record<string, string> = {};
    for (const [file, text] of Object.entries(lumps)) {
      const source = join(dir, file.replace(/[#/]/g, "_"));
      writeFileSync(source, text);
      plan[`maps/${MAP}/entities/${file}`] = source;
    }
    process.env.FAKE_S2V = JSON.stringify({ [`maps/${MAP}/entities/`]: plan });
    process.env.FAKE_S2V_OUTPUT = JSON.stringify(output);
    return extractCallouts(MAP, { mapsDir, pak: join(dir, "pak01_dir.vpk"), cli });
  };

  afterEach(() => {
    delete process.env.FAKE_S2V;
    delete process.env.FAKE_S2V_OUTPUT;
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads the places out of default_ents", () => {
    const result = run({
      "default_ents.vents": lump([
        { classname: '"worldspawn"' },
        place("BombsiteA", 1000),
        place("BombsiteB", -1000),
      ]),
      "other_ents.vents": lump([place("Elsewhere", 0)]),
    });
    expect(result.none).toBeUndefined();
    expect(result.callouts.map((c: { name: string }) => c.name)).toEqual([
      "BombsiteA",
      "BombsiteB",
    ]);
    expect(result.callouts[0].boxes).toEqual([{ min: [488, -512, -64], max: [1512, 512, 128] }]);
  });

  it("looks in the folder's other lumps when default_ents has no places", () => {
    const result = run({
      "default_ents.vents": lump([{ classname: '"worldspawn"' }]),
      "rooms/room_ents.vents": lump([place("Room101", 1000)]),
      "3#entitylumpname.vents": lump([place("Templated", 0)]),
    });
    expect(result.callouts.map((c: { name: string }) => c.name)).toEqual(["Room101"]);
  });

  it("says what it read when a map has no places at all", () => {
    const result = run({
      "default_ents.vents": lump([
        { classname: '"worldspawn"' },
        { classname: '"info_map_region"', token: '"#Region_A"' },
        { classname: '"info_map_region"', token: '"#Region_B"' },
        { classname: '"cs_minimap_volume"' },
      ]),
      "extra_ents.vents": lump([{ classname: '"prop_dynamic"' }]),
    });
    expect(result.none).toBe(true);
    expect(result.why).toBe(
      "no env_cs_place among 5 entities in default_ents.vents + 1 more lump(s); " +
        "place-like: info_map_region x2",
    );
  });

  it("says why no entity lump came out", () => {
    expect(() =>
      run(
        {},
        {
          [`maps/${MAP}/entities/`]: {
            stderr:
              `File: maps/${MAP}/entities/default_ents.vents_c\n` +
              "ValveResourceFormat.UnexpectedMagicException: Unsupported entity data version 2\n" +
              "   at ValveResourceFormat.ResourceTypes.EntityLump.ParseEntityProperties()\n",
          },
        },
      ),
    ).toThrow(
      `no maps/${MAP}/entities/default_ents.vents came out (Source2Viewer-CLI said: ` +
        `File: maps/${MAP}/entities/default_ents.vents_c | ` +
        "ValveResourceFormat.UnexpectedMagicException: Unsupported entity data version 2)",
    );
  });
});
