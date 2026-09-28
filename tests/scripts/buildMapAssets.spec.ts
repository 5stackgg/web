// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "~/scripts/build-map-assets.mjs";
import { localImports, pipelineSources } from "~/scripts/lib-fingerprint.mjs";
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
        "glb-to-tri.mjs",
        "lib-fingerprint.mjs",
        "lib-view-mesh.mjs",
        "lib-nav.mjs",
        "lib-glb.mjs",
      ]),
    );
    for (const file of files) {
      for (const specifier of localImports(readFileSync(file, "utf8"))) {
        expect(files).toContain(join(dirname(file), specifier));
      }
    }
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
  const fixtures = join(dir, "fixtures");
  const env = {
    S3_ACCESS_KEY: "key",
    S3_SECRET: "secret",
    BUCKET_NAME: "5stack",
    S3_ENDPOINT: "s3.example.test",
    CLI: installFakeSourceViewer(dir),
    FAKE_S2V_LOG: exportLog,
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
      ]).concat(Object.entries(overrides)),
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
    { vpks = v1, overrides = {}, args = [] as string[], version = "fake-1" } = {},
  ) => {
    setInstall(build, vpks);
    rmSync(exportLog, { force: true });
    bucket.puts.length = 0;
    process.env.FAKE_S2V = JSON.stringify(plan(overrides));
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
    const exportsOf = (map: string) =>
      exported.filter((f) => f.startsWith(`maps/${map}/`) || f === `maps/${map}.nav`);
    const assetPuts = bucket.puts.filter(
      (k) => !/manifest(\.r\d+)?\.json$/.test(k) && k !== "maps/latest.json",
    );
    return { code, exportsOf, exported, assetPuts, puts: [...bucket.puts] };
  };
  const manifest = (key: string) => bucket.json(`maps/${key}`);

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
    for (const key of [...Object.keys(env), "FAKE_S2V", "FAKE_S2V_VERSION"]) {
      delete process.env[key];
    }
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
    expect(second.assetPuts).toEqual(["maps/101/de_beta.view.bin.gz"]);
    expect(manifest("101/manifest.json")).not.toHaveProperty("failed_view");
  });

  it("drops maps that are no longer installed", async () => {
    await publish("100");
    const second = await publish("101", { vpks: { de_alpha: v1.de_alpha } });
    expect(second.code).toBe(0);
    expect(second.exported).toEqual([]);
    expect(Object.keys(manifest("101/manifest.json").maps)).toEqual(["de_alpha"]);
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
});
