// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "~/scripts/build-map-assets.mjs";
import { unpackBlastFile } from "~/scripts/extract-map-blast.mjs";
import { localImports, pipelineSources, VERSIONED_APART } from "~/scripts/lib-fingerprint.mjs";
import { bombDamageKv3 } from "../helpers/bombDamageFixture";
import { fakeBucket, installFakeSourceViewer } from "../helpers/fakeMapTools";
import { buildGlb, buildNav, quad, type Vec3 } from "../helpers/mapFixtures";

const HOST = "5stack.s3.example.test";
const MAPS = ["de_alpha", "de_beta"];
const scripts = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts");

describe("pipelineSources", () => {
  it("covers the build script and every local module it reaches", () => {
    const files = pipelineSources();
    const names = files.map((f: string) => relative(scripts, f));
    expect(names).toEqual(
      expect.arrayContaining([
        "build-map-assets.mjs",
        "extract-map-meshes.mjs",
        "extract-map-callouts.mjs",
        "extract-map-blast.mjs",
        "glb-to-tri.mjs",
        "lib-fingerprint.mjs",
        "lib-kv3.mjs",
        "lib-view-mesh.mjs",
        "lib-nav.mjs",
        "lib-glb.mjs",
      ]),
    );
    for (const file of files) {
      for (const specifier of localImports(readFileSync(file, "utf8"))) {
        const target = join(dirname(file), specifier);
        if (!VERSIONED_APART.has(target)) {
          expect(files).toContain(target);
        }
      }
    }
  });

  it("leaves out the prep, which is versioned by PREP_VERSION instead", () => {
    const names = pipelineSources().map((f: string) => relative(scripts, f));
    expect(names).not.toContain("replay-stage/build-prep.mjs");
    expect([...VERSIONED_APART].map((f) => relative(scripts, f))).toEqual([
      "replay-stage/build-prep.mjs",
    ]);
  });

  it("reads every shape of local import", () => {
    const source = [
      'import { a } from "./lib-a.mjs";',
      'import {\n  b,\n} from "../x/lib-b.mjs";',
      'export { c } from "./lib-c.mjs";',
      'import "./side.mjs";',
      'const d = await import("./lazy.mjs");',
      'import { e } from "node:fs";',
      'import f from "meshoptimizer";',
    ].join("\n");
    expect(localImports(source)).toEqual([
      "./lib-a.mjs",
      "../x/lib-b.mjs",
      "./lib-c.mjs",
      "./side.mjs",
      "./lazy.mjs",
    ]);
  });
});

describe("build-map-assets", () => {
  const dir = mkdtempSync(join(tmpdir(), "build-map-assets-"));
  const install = join(dir, "install");
  const mapsDir = join(install, "game", "csgo", "maps");
  const exportLog = join(dir, "exports.log");
  const inputLog = join(dir, "inputs.log");
  const fixtures = join(dir, "fixtures");
  // Stands in for the bundled browser prep: the "core" names the view's size
  // and the callout boxes it was given, so a test can tell what it read.
  const prepStub = (version: number) => {
    const path = join(dir, `prep-v${version}.mjs`);
    writeFileSync(
      path,
      [
        `export const PREP_VERSION = ${version};`,
        "export const parseViewMesh = (buffer) => ({ chunks: [{ bytes: buffer.byteLength }] });",
        "export const analyseMap = (chunks, areas) => ({ areas: areas.length });",
        `export const prepFingerprint = (chunks, areas) => "${version}:" + chunks[0].bytes + ":" + areas.length;`,
        'export const packPrep = (core, fingerprint) => new TextEncoder().encode("prep " + fingerprint).buffer;',
      ].join("\n"),
    );
    return path;
  };
  const PREP_V1 = prepStub(1);
  const PREP_V2 = prepStub(2);
  const env = {
    S3_ACCESS_KEY: "key",
    S3_SECRET: "secret",
    BUCKET_NAME: "5stack",
    S3_ENDPOINT: "s3.example.test",
    CLI: installFakeSourceViewer(dir),
    FAKE_S2V_LOG: exportLog,
    FAKE_S2V_INPUT_LOG: inputLog,
    PREP_BUNDLE: PREP_V1,
  };
  let bucket: ReturnType<typeof fakeBucket>;

  mkdirSync(fixtures);
  const floorAt = (x: number, size = 1024) =>
    quad([x, 0, 0], [x + size, 0, 0], [x + size, size, 0], [x, size, 0]);
  const area = (x: number): Vec3[] => [
    [x, 0, 0],
    [x + 1024, 0, 0],
    [x + 1024, 1024, 0],
    [x, 1024, 0],
  ];
  MAPS.forEach((map, i) => {
    const x = i * 4096;
    writeFileSync(
      join(fixtures, `${map}.physics.glb`),
      buildGlb([{ name: "physics_group_concrete", triangles: floorAt(x) }], { render: false }),
    );
    writeFileSync(
      join(fixtures, `${map}.physics-v2.glb`),
      buildGlb([{ name: "physics_group_concrete", triangles: floorAt(x, 2048) }], {
        render: false,
      }),
    );
    writeFileSync(
      join(fixtures, `${map}.world.glb`),
      buildGlb([{ name: "n0_lr0_agg_merge_concrete_floor_0", triangles: floorAt(x) }]),
    );
    writeFileSync(join(fixtures, `${map}.nav`), buildNav([area(x)]));
  });
  writeFileSync(join(fixtures, "ents.vents"), '====0====\nclassname   "worldspawn"\n');
  writeFileSync(join(fixtures, "nested.vpk"), "a map vpk inside an addon vpk");
  // de_alpha carries Valve's baked blast; de_beta, like an old map, none.
  writeFileSync(
    join(fixtures, "de_alpha.vdata"),
    bombDamageKv3({
      sites: [
        { min: [100, 100, 0], max: [300, 300, 64], power: 500 },
        { min: [700, 700, 0], max: [900, 900, 64], power: 450 },
      ],
      positions: [
        [128, 128, 16],
        [160, 128, 16],
        [800, 800, 16],
      ],
      phases: [
        [0, 32, 1500],
        [1400, 1420, 0],
      ],
    }),
  );

  const plan = (overrides: Record<string, unknown> = {}) =>
    Object.fromEntries(
      MAPS.flatMap((map) => [
        [
          `maps/${map}/world_physics.vmdl_c`,
          { [`maps/${map}/world_physics_physics.glb`]: join(fixtures, `${map}.physics.glb`) },
        ],
        [
          `maps/${map}/world.vwrld_c`,
          { [`maps/${map}/world.glb`]: join(fixtures, `${map}.world.glb`) },
        ],
        [`maps/${map}.nav`, { [`maps/${map}.nav`]: join(fixtures, `${map}.nav`) }],
        [
          `maps/${map}/entities/`,
          { [`maps/${map}/entities/default_ents.vents`]: join(fixtures, "ents.vents") },
        ],
      ])
        .concat([
          [
            "maps/de_alpha/baked_bomb_damage.vdata_c",
            { "maps/de_alpha/baked_bomb_damage.vdata": join(fixtures, "de_alpha.vdata") },
          ],
        ])
        .concat(Object.entries(overrides)),
    );
  // A workshop map, `inner` inside its VPK, built from de_beta's fixtures.
  const workshopPlan = (inner: string) => ({
    [`maps/${inner}/world_physics.vmdl_c`]: {
      [`maps/${inner}/world_physics_physics.glb`]: join(fixtures, "de_beta.physics.glb"),
    },
    [`maps/${inner}/world.vwrld_c`]: {
      [`maps/${inner}/world.glb`]: join(fixtures, "de_beta.world.glb"),
    },
    [`maps/${inner}.nav`]: { [`maps/${inner}.nav`]: join(fixtures, "de_beta.nav") },
    [`maps/${inner}/entities/`]: {
      [`maps/${inner}/entities/default_ents.vents`]: join(fixtures, "ents.vents"),
    },
  });
  // The same, carried inside the item's addon VPK as maps/<inner>.vpk.
  const nestedPlan = (inner: string) => ({
    ...workshopPlan(inner),
    [`maps/${inner}.vpk`]: { [`maps/${inner}.vpk`]: join(fixtures, "nested.vpk") },
  });
  const workshopDir = join(
    install,
    ...["game", "bin", "linuxsteamrt64", "steamapps", "workshop", "content", "730"],
  );

  const setInstall = (build: string, vpks: Record<string, string>) => {
    rmSync(install, { recursive: true, force: true });
    mkdirSync(mapsDir, { recursive: true });
    mkdirSync(join(install, "steamapps"));
    writeFileSync(
      join(install, "steamapps", "appmanifest_730.acf"),
      `"AppState"\n{\n\t"buildid"\t\t"${build}"\n}\n`,
    );
    for (const [map, content] of Object.entries(vpks)) {
      writeFileSync(join(mapsDir, `${map}.vpk`), content);
    }
  };
  const v1 = { de_alpha: "alpha vpk 1", de_beta: "beta vpk 1" };

  const publish = async (
    build: string,
    {
      vpks = v1,
      overrides = {},
      args = [] as string[],
      version = "fake-1",
      workshop = {} as Record<string, string>,
      lists = {} as Record<string, string[]>,
    } = {},
  ) => {
    setInstall(build, vpks);
    for (const [file, content] of Object.entries(workshop)) {
      mkdirSync(dirname(join(workshopDir, file)), { recursive: true });
      writeFileSync(join(workshopDir, file), content);
    }
    rmSync(exportLog, { force: true });
    rmSync(inputLog, { force: true });
    bucket.puts.length = 0;
    process.env.FAKE_S2V = JSON.stringify(plan(overrides));
    process.env.FAKE_S2V_LIST = JSON.stringify(lists);
    process.env.FAKE_S2V_VERSION = version;
    const code = await run([
      "--cs2",
      install,
      "--out",
      join(dir, "out", build),
      "--publish",
      ...args,
    ]);
    const exported = existsSync(exportLog)
      ? readFileSync(exportLog, "utf8").trim().split("\n").filter(Boolean)
      : [];
    const inputs = existsSync(inputLog)
      ? readFileSync(inputLog, "utf8").trim().split("\n").filter(Boolean)
      : [];
    const exportsOf = (map: string) =>
      exported.filter((f) => f.startsWith(`maps/${map}/`) || f === `maps/${map}.nav`);
    const assetPuts = bucket.puts.filter(
      (k) => !/manifest(\.r\d+)?\.json$/.test(k) && k !== "maps/latest.json",
    );
    return { code, exportsOf, exported, inputs, assetPuts, puts: [...bucket.puts] };
  };
  const manifest = (key: string) => bucket.json(`maps/${key}`);
  const body = (key: string) => gunzipSync(bucket.objects.get(`maps/${key}`)!.body);
  const backfill = async (args: string[] = []) => {
    rmSync(exportLog, { force: true });
    bucket.puts.length = 0;
    const code = await run([
      "--prep-only",
      "--out",
      join(dir, "out", `prep-${Math.random()}`),
      "--publish",
      ...args,
    ]);
    const exported = existsSync(exportLog) ? readFileSync(exportLog, "utf8").trim() : "";
    return { code, exported, puts: [...bucket.puts] };
  };

  beforeEach(() => {
    Object.assign(process.env, env);
    bucket = fakeBucket(HOST);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    for (const key of [...Object.keys(env), "FAKE_S2V", "FAKE_S2V_VERSION", "FAKE_S2V_LIST"]) {
      delete process.env[key];
    }
    rmSync(workshopDir, { recursive: true, force: true });
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("publishes a first build with each map's source recorded", async () => {
    const first = await publish("100");
    expect(first.code).toBe(0);
    expect(first.exportsOf("de_alpha").length).toBeGreaterThan(0);
    const m = manifest("100/manifest.json");
    expect(m.pipeline.source_viewer).toBe("fake-1");
    expect(m.maps.de_alpha.source).toEqual({
      vpk_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      pipeline: m.pipeline.sha256,
      prep: 1,
    });
    expect(m.maps.de_alpha.tri).toBe("100/de_alpha.tri.gz");
    expect(bucket.json("maps/latest.json").manifest).toBe("100/manifest.json");
  });

  it("does no work for unchanged maps but still publishes the build", async () => {
    await publish("100");
    const second = await publish("101");
    expect(second.code).toBe(0);
    expect(second.exported).toEqual([]);
    expect(second.assetPuts).toEqual([]);
    expect(second.puts).toEqual(["maps/101/manifest.json", "maps/latest.json"]);
    expect(manifest("101/manifest.json").maps).toEqual(manifest("100/manifest.json").maps);
    expect(bucket.json("maps/latest.json").manifest).toBe("101/manifest.json");
  });

  it("rebuilds only the map whose VPK changed", async () => {
    await publish("100");
    const second = await publish("101", {
      vpks: { ...v1, de_beta: "beta vpk 2" },
      overrides: {
        "maps/de_beta/world_physics.vmdl_c": {
          "maps/de_beta/world_physics_physics.glb": join(fixtures, "de_beta.physics-v2.glb"),
        },
      },
    });
    expect(second.code).toBe(0);
    expect(second.exportsOf("de_alpha")).toEqual([]);
    expect(second.exportsOf("de_beta").length).toBeGreaterThan(0);
    expect(second.assetPuts).toEqual(["maps/101/de_beta.tri.gz"]);
    const before = manifest("100/manifest.json").maps;
    const after = manifest("101/manifest.json").maps;
    expect(after.de_alpha).toEqual(before.de_alpha);
    expect(after.de_beta.view).toBe(before.de_beta.view);
    expect(after.de_beta.source.vpk_sha256).not.toBe(before.de_beta.source.vpk_sha256);
  });

  it("rebuilds everything when the pipeline changes, reusing identical outputs", async () => {
    await publish("100");
    const second = await publish("101", { version: "fake-2" });
    expect(second.code).toBe(0);
    expect(second.exportsOf("de_alpha").length).toBeGreaterThan(0);
    expect(second.exportsOf("de_beta").length).toBeGreaterThan(0);
    expect(second.assetPuts).toEqual([]);
    const before = manifest("100/manifest.json");
    const after = manifest("101/manifest.json");
    for (const map of MAPS) {
      expect(after.maps[map].tri).toBe(before.maps[map].tri);
      expect(after.maps[map].view).toBe(before.maps[map].view);
      expect(after.maps[map].source.pipeline).toBe(after.pipeline.sha256);
    }
    expect(after.pipeline.sha256).not.toBe(before.pipeline.sha256);
  });

  it("rebuilds a map the previous manifest lists as failed, whatever its source", async () => {
    const first = await publish("100", { overrides: { "maps/de_beta/world.vwrld_c": "FAIL" } });
    expect(first.code).toBe(2);
    expect(manifest("100/manifest.json").failed_view).toEqual(["de_beta"]);

    const second = await publish("101");
    expect(second.code).toBe(0);
    expect(second.exportsOf("de_alpha")).toEqual([]);
    expect(second.exportsOf("de_beta").length).toBeGreaterThan(0);
    expect(second.assetPuts).toEqual([
      "maps/101/de_beta.view.bin.gz",
      "maps/101/de_beta.prep.v1.bin.gz",
    ]);
    expect(manifest("101/manifest.json")).not.toHaveProperty("failed_view");
  });

  it("drops maps that are no longer installed", async () => {
    await publish("100");
    const second = await publish("101", { vpks: { de_alpha: v1.de_alpha } });
    expect(second.code).toBe(0);
    expect(second.exported).toEqual([]);
    expect(Object.keys(manifest("101/manifest.json").maps)).toEqual(["de_alpha"]);
  });

  it("never builds an installed map --only-maps leaves out", async () => {
    const first = await publish("100", { args: ["--only-maps", "de_alpha,de_gamma"] });
    expect(first.code).toBe(0);
    expect(first.exportsOf("de_beta")).toEqual([]);
    expect(Object.keys(manifest("100/manifest.json").maps)).toEqual(["de_alpha"]);
  });

  it("drops maps --only-maps leaves out, failures included", async () => {
    await publish("100", { overrides: { "maps/de_beta/world.vwrld_c": "FAIL" } });
    expect(manifest("100/manifest.json").failed_view).toEqual(["de_beta"]);

    const retry = await publish("100", { args: ["--only-maps", "de_alpha"] });
    expect(retry.code).toBe(0);
    expect(retry.exported).toEqual([]);
    const m = manifest("100/manifest.r2.json");
    expect(Object.keys(m.maps)).toEqual(["de_alpha"]);
    expect(m).not.toHaveProperty("failed_view");
    expect(bucket.json("maps/latest.json").manifest).toBe("100/manifest.r2.json");
  });

  it("rebuilds regardless of fingerprints with --force or --force-maps", async () => {
    await publish("100");
    const all = await publish("101", { args: ["--force"] });
    expect(all.code).toBe(0);
    expect(all.exportsOf("de_alpha").length).toBeGreaterThan(0);
    expect(all.exportsOf("de_beta").length).toBeGreaterThan(0);
    expect(all.assetPuts).toEqual([]);

    const one = await publish("102", { args: ["--force-maps", "de_beta"] });
    expect(one.exportsOf("de_alpha")).toEqual([]);
    expect(one.exportsOf("de_beta").length).toBeGreaterThan(0);
    expect(one.puts).toEqual(["maps/102/manifest.json", "maps/latest.json"]);
  });

  it("does nothing for a build that is already published without failures", async () => {
    await publish("100");
    const again = await publish("100");
    expect(again.code).toBe(0);
    expect(again.exported).toEqual([]);
    expect(again.puts).toEqual([]);
  });

  it("publishes each map's prep and, where Valve baked one, its blast", async () => {
    const first = await publish("100");
    expect(first.code).toBe(0);
    const m = manifest("100/manifest.json");
    expect(m.pipeline.prep).toBe(1);
    expect(m.maps.de_alpha.prep).toBe("100/de_alpha.prep.v1.bin.gz");
    expect(m.maps.de_alpha.blast).toBe("100/de_alpha.blast.v2.bin.gz");
    expect(m.maps.de_beta.prep).toBe("100/de_beta.prep.v1.bin.gz");
    expect(m.maps.de_beta).not.toHaveProperty("blast");
    // Prepped from the view mesh this run built; this fixture has no callouts.
    const viewBytes = gunzipSync(bucket.objects.get(`maps/${m.maps.de_alpha.view}`)!.body).length;
    expect(body(m.maps.de_alpha.prep).toString()).toBe(`prep 1:${viewBytes}:0`);
    const blast = unpackBlastFile(body(m.maps.de_alpha.blast))!;
    // The collision .tri's triangle count, which the browser checks.
    const triangles = body(m.maps.de_alpha.tri).length / 36;
    expect(blast.triangles).toBe(triangles);
    expect(blast.sites.map((s: any) => [s.site, s.field.power])).toEqual([
      ["A", 500],
      ["B", 450],
    ]);
  });

  it("rebuilds only the prep, from what is published, for a new PREP_VERSION", async () => {
    await publish("100");
    process.env.PREP_BUNDLE = PREP_V2;
    const second = await publish("101");
    expect(second.code).toBe(0);
    expect(second.exported).toEqual([]);
    expect(second.assetPuts).toEqual([
      "maps/101/de_alpha.prep.v2.bin.gz",
      "maps/101/de_beta.prep.v2.bin.gz",
    ]);
    const before = manifest("100/manifest.json").maps;
    const after = manifest("101/manifest.json").maps;
    for (const map of MAPS) {
      expect(after[map].tri).toBe(before[map].tri);
      expect(after[map].view).toBe(before[map].view);
      expect(after[map].source).toEqual({ ...before[map].source, prep: 2 });
    }
    expect(after.de_alpha.blast).toBe(before.de_alpha.blast);
    const viewBytes = gunzipSync(bucket.objects.get(`maps/${after.de_alpha.view}`)!.body).length;
    expect(body(after.de_alpha.prep).toString()).toBe(`prep 2:${viewBytes}:0`);
  });

  it("publishes without prep when the prep code will not load", async () => {
    process.env.PREP_BUNDLE = join(dir, "missing.mjs");
    const first = await publish("100");
    expect(first.code).toBe(0);
    const m = manifest("100/manifest.json");
    expect(m.maps.de_alpha).not.toHaveProperty("prep");
    expect(m.maps.de_alpha.source).not.toHaveProperty("prep");
    expect(m.pipeline).not.toHaveProperty("prep");
  });

  it("backfills prep with --prep-only, from the CDN alone, as the build's next revision", async () => {
    await publish("100", { args: ["--no-prep"] });
    const filled = await backfill();
    expect(filled.code).toBe(0);
    expect(filled.exported).toBe("");
    expect(filled.puts).toEqual([
      "maps/100/r2/de_alpha.prep.v1.bin.gz",
      "maps/100/r2/de_beta.prep.v1.bin.gz",
      "maps/100/manifest.r2.json",
      "maps/latest.json",
    ]);
    const before = manifest("100/manifest.json");
    const after = manifest("100/manifest.r2.json");
    expect(after.revision).toBe(2);
    expect(after.pipeline).toEqual({ ...before.pipeline, prep: 1 });
    expect(after.maps.de_alpha).toEqual({
      ...before.maps.de_alpha,
      prep: "100/r2/de_alpha.prep.v1.bin.gz",
      sha256: { ...before.maps.de_alpha.sha256, prep: expect.any(String) },
      source: { ...before.maps.de_alpha.source, prep: 1 },
    });
    expect(bucket.json("maps/latest.json").manifest).toBe("100/manifest.r2.json");

    // Current everywhere: nothing to do. Forced: the same files, so nothing either.
    expect((await backfill()).puts).toEqual([]);
    const forced = await backfill(["--force"]);
    expect(forced.code).toBe(0);
    expect(forced.puts).toEqual([]);

    // A new version, for one map.
    process.env.PREP_BUNDLE = PREP_V2;
    const one = await backfill(["--maps", "de_beta"]);
    expect(one.puts).toEqual([
      "maps/100/r3/de_beta.prep.v2.bin.gz",
      "maps/100/manifest.r3.json",
      "maps/latest.json",
    ]);
    expect(manifest("100/manifest.r3.json").maps.de_alpha.prep).toBe(
      "100/r2/de_alpha.prep.v1.bin.gz",
    );
  });

  it("refuses --prep-only when the prep code will not load", async () => {
    await publish("100", { args: ["--no-prep"] });
    process.env.PREP_BUNDLE = join(dir, "missing.mjs");
    const failed = await backfill();
    expect(failed.code).toBe(1);
    expect(failed.puts).toEqual([]);
  });

  // How Steam downloads an item: an addon VPK, in one file or as _dir.vpk
  // with its chunks, carrying the map's own VPK beside its skybox's.
  const items = {
    args: [
      "--workshop-maps",
      "de_gamma=3000,4000999=4000,de_direct=9000,de_missing=5000," +
        "de_alpha=6000,de_alpha_night=7000,de_bad=x",
    ],
    overrides: {
      ...nestedPlan("de_gamma"),
      ...nestedPlan("de_inner"),
      ...workshopPlan("de_direct"),
      "maps/de_inner/baked_bomb_damage.vdata_c": {
        "maps/de_inner/baked_bomb_damage.vdata": join(fixtures, "de_alpha.vdata"),
      },
    },
    workshop: {
      "3000/3000_dir.vpk": "gamma dir",
      "3000/3000_000.vpk": "gamma chunk",
      "4000/4000.vpk": "inner addon",
      "9000/de_direct.vpk": "direct map vpk",
      "6000/6000.vpk": "workshop alpha",
      "7000/7000.vpk": "night",
    },
    lists: {
      "3000_dir.vpk": [
        "maps/de_gamma.vpk",
        "maps/de_gamma_cameras.txt",
        "maps/de_gamma_skybox.vpk",
      ],
      "4000.vpk": ["maps/de_inner.vpk", "maps/de_inner_marius_skybox.vpk"],
      "de_direct.vpk": ["maps/de_direct/world.vwrld_c", "maps/de_direct/world_physics.vmdl_c"],
    },
  };

  it("builds the workshop maps the install lacks, from the map VPK each item carries", async () => {
    const scratch = join(dir, "tmp");
    mkdirSync(scratch, { recursive: true });
    vi.stubEnv("TMPDIR", scratch);
    const first = await publish("100", items);
    expect(first.code).toBe(0);
    const m = manifest("100/manifest.json");
    expect(Object.keys(m.maps)).toEqual([
      "4000999",
      "de_alpha",
      "de_beta",
      "de_direct",
      "de_gamma",
    ]);
    expect(m.maps.de_gamma.source.workshop).toBe("3000");
    expect(m.maps.de_gamma.tri).toBe("100/de_gamma.tri.gz");
    expect(first.inputs).toEqual(
      expect.arrayContaining([
        "3000_dir.vpk maps/de_gamma.vpk",
        "de_gamma.vpk maps/de_gamma/world_physics.vmdl_c",
        "de_gamma.vpk maps/de_gamma/world.vwrld_c",
        "de_gamma.vpk maps/de_gamma/entities/",
      ]),
    );
    expect(first.inputs.filter((line) => line.startsWith("3000_dir.vpk "))).toEqual([
      "3000_dir.vpk --vpk_list maps/",
      "3000_dir.vpk maps/de_gamma.vpk",
    ]);
    // Published under its table name, read by the name inside the item.
    expect(m.maps["4000999"].tri).toBe("100/4000999.tri.gz");
    expect(m.maps["4000999"].source.workshop).toBe("4000");
    expect(first.inputs).toContain("de_inner.vpk maps/de_inner/world_physics.vmdl_c");
    expect(m.maps["4000999"].blast).toBe("100/4000999.blast.v2.bin.gz");
    expect(first.exported).not.toContain("maps/de_inner_marius_skybox.vpk");
    // An item that is itself a map VPK is read where it is.
    expect(first.inputs).toContain("de_direct.vpk maps/de_direct/world_physics.vmdl_c");
    // The install's own copy wins over a workshop one.
    expect(m.maps.de_alpha.source).not.toHaveProperty("workshop");
    expect(readdirSync(scratch).filter((f) => f.startsWith("map-"))).toEqual([]);

    // On a node that never downloaded them they keep their published entries.
    const second = await publish("101", {
      args: ["--workshop-maps", "de_gamma=3000,4000999=4000"],
    });
    expect(second.code).toBe(0);
    expect(second.exported).toEqual([]);
    expect(manifest("101/manifest.json").maps.de_gamma).toEqual(m.maps.de_gamma);
    expect(manifest("101/manifest.json").maps["4000999"]).toEqual(m.maps["4000999"]);

    // The same downloads again are unchanged: nothing is listed or unpacked.
    const third = await publish("102", items);
    expect(third.code).toBe(0);
    const unpacked = /^(3000_dir|4000|de_gamma|de_inner)\.vpk /;
    expect(third.inputs.filter((line) => unpacked.test(line))).toEqual([]);
    expect(manifest("102/manifest.json").maps.de_gamma).toEqual(m.maps.de_gamma);
    expect(manifest("102/manifest.json").maps["4000999"]).toEqual(m.maps["4000999"]);
  });

  it("picks the map an item of several is named after, failing one that names none", async () => {
    const lists = { "8000_dir.vpk": ["maps/de_one.vpk", "maps/de_two.vpk"] };
    const run = await publish("100", {
      args: ["--workshop-maps", "de_twin=8000,de_one=8100"],
      overrides: { ...nestedPlan("de_one"), ...nestedPlan("de_two") },
      workshop: { "8000/8000_dir.vpk": "two maps", "8100/8100_dir.vpk": "two maps" },
      lists: { ...lists, "8100_dir.vpk": lists["8000_dir.vpk"] },
    });
    expect(run.code).toBe(2);
    const m = manifest("100/manifest.json");
    expect(m.failed).toEqual(["de_twin"]);
    expect(m.maps.de_one.tri).toBe("100/de_one.tri.gz");
    expect(run.inputs.filter((line) => line.startsWith("8100_dir.vpk "))).toEqual([
      "8100_dir.vpk --vpk_list maps/",
      "8100_dir.vpk maps/de_one.vpk",
    ]);
    expect(run.inputs.filter((line) => line.startsWith("8000_dir.vpk "))).toEqual([
      "8000_dir.vpk --vpk_list maps/",
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("8000_dir.vpk holds de_one, de_two, none of them de_twin"),
    );
  });
});
