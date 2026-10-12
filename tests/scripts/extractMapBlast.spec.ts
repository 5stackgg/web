// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  bakeSite,
  blastSites,
  extractBlast,
  latticeStep,
  NEVER,
  packBlastFile,
  parseBombDamage,
  siteLetters,
  unpackBlastFile,
  valveDamage,
} from "~/scripts/extract-map-blast.mjs";
import { bombDamageKv3 } from "../helpers/bombDamageFixture";
import { installFakeSourceViewer } from "../helpers/fakeMapTools";

// Two sites, the FIRST of them B: the baked data carries no letters.
const SITE_B = { min: [900, -100, 0], max: [1100, 100, 64], power: 500 };
const SITE_A = { min: [-1100, -100, 0], max: [-900, 100, 64], power: 400 };
// A 4 x 2 patch of a 32u lattice, at z 16.
const POINTS = [0, 32].flatMap((y) => [0, 32, 64, 96].map((x) => [x, y, 16]));
const PHASES = [
  // Site B: the last point is past 1800 + 500, so it takes no damage.
  [1000, 1032, 1064, 1096, 1010, 1040, 1070, 2400],
  // Site A: a phase of exactly 0, and two points that take nothing.
  [0, 300, 2300, 2200, 600, 700, 800, 900],
];
const fixture = () =>
  bombDamageKv3({ sites: [SITE_B, SITE_A], positions: POINTS, phases: PHASES });

/** The value at voxel (i, j, k) of a baked field. */
const at = (field: any, i: number, j: number, k: number) =>
  field.values[(k * field.dy + j) * field.dx + i];

describe("valveDamage", () => {
  it("replicates VRF's CalculateDamage", () => {
    expect(valveDamage(0, 500)).toBe(100);
    expect(valveDamage(0, 0)).toBe(0);
    expect(valveDamage(500, 500)).toBe(100);
    expect(valveDamage(250, 500)).toBe(200);
    expect(valveDamage(100, 500)).toBe(255);
    // Past 1800 the fall is linear, to nothing at 1800 + power.
    expect(valveDamage(2000, 500)).toBeCloseTo(100 - (100 * 1500) / 1800, 5);
    expect(valveDamage(2300, 500)).toBe(0);
    expect(valveDamage(2400, 500)).toBe(0);
  });
});

describe("parseBombDamage", () => {
  it("reads the three blobs of a decompiled baked_bomb_damage.vdata", () => {
    const data = parseBombDamage(fixture());
    expect(data.version).toBe(2);
    expect(data.sites).toEqual([SITE_B, SITE_A]);
    expect([...data.positions]).toEqual(POINTS.flat());
    expect([...data.phases]).toEqual(PHASES.flat());
    expect(data.yaw[0]).toBe(64);
    expect(data.pitch[0]).toBe(0);
  });

  it("refuses anything that is not baked bomb damage", () => {
    expect(() =>
      parseBombDamage(bombDamageKv3({ type: "OTHER", sites: [], positions: [], phases: [] })),
    ).toThrow('not baked bomb damage (generic_data_type "OTHER")');
    expect(() =>
      parseBombDamage(
        bombDamageKv3({ version: 3, sites: [SITE_A], positions: POINTS, phases: [PHASES[1]] }),
      ),
    ).toThrow("unknown baked bomb damage version 3");
    expect(() =>
      parseBombDamage(
        bombDamageKv3({ sites: [SITE_B, SITE_A], positions: POINTS, phases: [PHASES[0]] }),
      ),
    ).toThrow("8 damage values for 2 site(s) x 8 point(s)");
  });
});

describe("latticeStep", () => {
  it("finds the spacing the points sit on, or falls back to 32", () => {
    expect(latticeStep(new Int16Array(POINTS.flat()))).toBe(32);
    expect(latticeStep(new Int16Array([0, 0, 0, 24, 48, 0, 72, 24, 9]))).toBe(24);
    expect(latticeStep(new Int16Array([0, 0, 0, 7, 3, 0, 13, 5, 0]))).toBe(32);
    expect(latticeStep(new Int16Array([0, 0, 0]))).toBe(32);
  });
});

describe("bakeSite", () => {
  const data = parseBombDamage(fixture());

  it("puts each point's phase on the voxel centred on it, and nothing past the halo", () => {
    const field = bakeSite(data, 0)!;
    expect(field.vs).toBe(32);
    // Two halo voxels round the 4 x 2 x 1 patch, which lands on voxel centres.
    expect([field.dx, field.dy, field.dz]).toEqual([8, 6, 5]);
    expect([field.ox, field.oy, field.oz]).toEqual([-80, -80, -64]);
    expect(field.unit).toBe(8);
    expect(field.power).toBe(500);
    expect(field.at).toEqual({ x: 1000, y: 0, z: 0 });
    expect(field.bounds).toEqual({ min: SITE_B.min, max: SITE_B.max });
    // The points: phase / unit, rounded.
    expect([2, 3, 4, 5].map((i) => at(field, i, 2, 2))).toEqual([125, 129, 133, 137]);
    expect([2, 3, 4].map((i) => at(field, i, 3, 2))).toEqual([126, 130, 134]);
    // The point that takes no damage is not sampled; the halo gives its voxel
    // the smallest of its neighbours (1070 beside it, not its own 2400).
    expect(at(field, 5, 3, 2)).toBe(134);
    expect(field.stats.points).toBe(7);
    // Two layers out in every direction, then nothing.
    expect(at(field, 2, 2, 0)).toBe(125);
    expect(at(field, 2, 2, 4)).toBe(125);
    expect(at(field, 0, 2, 2)).toBe(125);
    expect(at(field, 1, 1, 2)).toBe(125);
    expect(at(field, 0, 0, 2)).toBe(NEVER);
    expect(at(field, 0, 0, 0)).toBe(NEVER);
  });

  it("keeps a phase of exactly 0 apart from a small one", () => {
    const field = bakeSite(data, 1)!;
    expect(at(field, 2, 2, 2)).toBe(0);
    expect(at(field, 3, 2, 2)).toBe(38);
    // 2300 and 2200 hurt nobody from a site of power 400; the halo fills
    // their voxels from the nearest point that does.
    expect(at(field, 4, 2, 2)).toBe(38);
  });

  it("widens the unit so the farthest point that still hurts fits", () => {
    const far = parseBombDamage(
      bombDamageKv3({
        sites: [{ ...SITE_A, power: 1200 }],
        positions: [
          [0, 0, 0],
          [32, 0, 0],
        ],
        phases: [[100, 2900]],
      }),
    );
    const field = bakeSite(far, 0)!;
    expect(field.unit).toBe(Math.ceil(2900 / 254));
    expect(at(field, 3, 2, 2) * field.unit).toBeGreaterThanOrEqual(2900 - field.unit);
  });

  it("is null for a site that hurts nowhere", () => {
    const none = parseBombDamage(
      bombDamageKv3({ sites: [SITE_A], positions: [[0, 0, 0]], phases: [[5000]] }),
    );
    expect(bakeSite(none, 0)).toBeNull();
  });

  it("coarsens the voxels until the grid fits, never past the halo alone", () => {
    const field = bakeSite(data, 0, { maxVoxels: 150 })!;
    expect(field.vs).toBe(72);
    expect(field.dx * field.dy * field.dz).toBe(150);
    // 5 x 5 x 5 is two halo voxels round one: it stops there.
    const floor = bakeSite(data, 0, { maxVoxels: 10 })!;
    expect(floor.dx * floor.dy * floor.dz).toBe(125);
  });
});

describe("siteLetters", () => {
  const targetB = { designation: "1", box: { min: [950, -50, 0], max: [1050, 50, 64] } };
  const targetA = { designation: "0", box: { min: [-1050, -50, 0], max: [-950, 50, 64] } };

  it("names each site from the func_bomb_target that touches it", () => {
    expect(siteLetters([SITE_B, SITE_A], { targets: [targetA, targetB] })).toEqual({
      letters: ["B", "A"],
      how: "entities",
    });
  });

  it("falls back to the BombsiteA/B callouts, then to the order", () => {
    const callouts = [
      { name: "BombsiteA", boxes: [{ min: [-1200, -200, 0], max: [-800, 200, 128] }] },
      { name: "BombsiteB", boxes: [{ min: [800, -200, 0], max: [1200, 200, 128] }] },
    ];
    expect(siteLetters([SITE_B, SITE_A], { targets: [targetB], callouts })).toEqual({
      letters: ["B", "A"],
      how: "callouts",
    });
    expect(siteLetters([SITE_B, SITE_A])).toEqual({ letters: ["A", "B"], how: "order" });
  });

  it("sorts the baked sites by letter", () => {
    const { sites, how } = blastSites(parseBombDamage(fixture()), {
      targets: [targetA, targetB],
    });
    expect(how).toBe("entities");
    expect(sites.map((s: any) => [s.site, s.field.power])).toEqual([
      ["A", 400],
      ["B", 500],
    ]);
  });
});

describe("the .blast file", () => {
  const targets = [
    { designation: "0", box: { min: [-1050, -50, 0], max: [-950, 50, 64] } },
    { designation: "1", box: { min: [950, -50, 0], max: [1050, 50, 64] } },
  ];

  it("packs version 2 with 72-byte site headers and reads back the same", () => {
    const { sites } = blastSites(parseBombDamage(fixture()), { targets });
    const buf = packBlastFile(sites, 123456);
    expect(buf.toString("latin1", 0, 4)).toBe("5SBL");
    expect(buf.readUInt16LE(4)).toBe(2);
    expect(buf.readUInt16LE(6)).toBe(2);
    expect(buf.readUInt32LE(8)).toBe(123456);
    // Site A's header: letter, model 1 (Valve), unit, then the grid.
    expect(String.fromCharCode(buf[12])).toBe("A");
    expect(buf[13]).toBe(1);
    expect(buf.readUInt16LE(14)).toBe(8);
    expect(buf.readFloatLE(12 + 28)).toBe(32);
    expect(buf.readFloatLE(12 + 44)).toBe(400);
    // 240 values, already a multiple of 4: site B starts right after.
    expect(String.fromCharCode(buf[12 + 72 + 240])).toBe("B");
    expect(buf.length).toBe(12 + 2 * (72 + 240));

    const back = unpackBlastFile(buf)!;
    expect(back.triangles).toBe(123456);
    for (const [i, { site, field }] of back.sites.entries()) {
      expect(site).toBe(sites[i].site);
      const { stats: _stats, ...want } = sites[i].field;
      expect(field).toEqual({ ...want, values: new Uint8Array(want.values) });
    }
  });

  it("is not read back as anything but version 2", () => {
    const buf = packBlastFile(blastSites(parseBombDamage(fixture())).sites, 1);
    buf.writeUInt16LE(1, 4);
    expect(unpackBlastFile(buf)).toBeNull();
    expect(unpackBlastFile(Buffer.from("nope"))).toBeNull();
  });
});

describe("extractBlast", () => {
  const dir = mkdtempSync(join(tmpdir(), "extract-blast-"));
  const cli = installFakeSourceViewer(dir);
  const vpk = join(dir, "maps", "de_fixture.vpk");
  mkdirSync(join(dir, "maps"));
  writeFileSync(vpk, "");
  const source = join(dir, "baked.vdata");
  writeFileSync(source, fixture());

  afterEach(() => {
    delete process.env.FAKE_S2V;
    delete process.env.FAKE_S2V_OUTPUT;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("decompiles maps/<map>/baked_bomb_damage.vdata_c and bakes each site", () => {
    process.env.FAKE_S2V = JSON.stringify({
      "maps/de_fixture/baked_bomb_damage.vdata_c": {
        "maps/de_fixture/baked_bomb_damage.vdata": source,
      },
    });
    const result = extractBlast("de_fixture", { vpk, cli });
    expect(result.none).toBeUndefined();
    expect(result.version).toBe(2);
    expect(result.sites.map((s: any) => s.site)).toEqual(["A", "B"]);
  });

  it("reads a VPK published under another name by the name inside it", () => {
    process.env.FAKE_S2V = JSON.stringify({
      "maps/de_inner/baked_bomb_damage.vdata_c": {
        "maps/de_inner/baked_bomb_damage.vdata": source,
      },
    });
    expect(extractBlast("3070290240", { vpk, inner: "de_inner", cli }).sites).toHaveLength(2);
  });

  it("is none, with the CLI's word for it, for a map without baked damage", () => {
    process.env.FAKE_S2V = JSON.stringify({});
    process.env.FAKE_S2V_OUTPUT = JSON.stringify({
      "maps/de_fixture/baked_bomb_damage.vdata_c": {
        stderr: "No files matched the given filters.\n",
      },
    });
    expect(extractBlast("de_fixture", { vpk, cli })).toEqual({
      none: true,
      why: "no maps/de_fixture/baked_bomb_damage.vdata_c (No files matched the given filters.)",
    });
  });
});
