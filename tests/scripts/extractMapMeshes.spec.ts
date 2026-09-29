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
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractMap } from "~/scripts/extract-map-meshes.mjs";
import { readViewBin } from "~/scripts/lib-view-mesh.mjs";
import { installFakeSourceViewer } from "../helpers/fakeMapTools";
import { buildGlb, buildNav, glbToGltf, quad } from "../helpers/mapFixtures";

const MAP = "de_fixture";

describe("extractMap", () => {
  const dir = mkdtempSync(join(tmpdir(), "extract-map-"));
  const mapsDir = join(dir, "maps");
  const outDir = join(dir, "out");
  const cli = installFakeSourceViewer(dir);
  const physics = join(dir, "physics.glb");
  const world = join(dir, "world.glb");
  const nav = join(dir, "good.nav");
  const oldNav = join(dir, "v35.nav");
  let warn: ReturnType<typeof vi.spyOn>;

  mkdirSync(mapsDir);
  writeFileSync(join(mapsDir, `${MAP}.vpk`), "");

  const floor = quad([0, 0, 0], [1024, 0, 0], [1024, 1024, 0], [0, 1024, 0]);
  const wall = quad([0, 0, 0], [1024, 0, 0], [1024, 0, 256], [0, 0, 256]);
  writeFileSync(
    physics,
    buildGlb(
      [
        { name: "physics_group_concrete", triangles: [...floor, ...wall] },
        {
          name: "physics_csgo_grenadeclip",
          triangles: quad([0, 512, 0], [1024, 512, 0], [1024, 512, 400], [0, 512, 400]),
        },
      ],
      { render: false },
    ),
  );
  const worldGlb = buildGlb([
    { name: "n0_lr0_agg_merge_concrete_floor_0", triangles: floor },
    { name: "n0_lr0_agg_merge_concrete_wall_0", triangles: wall },
  ]);
  writeFileSync(world, worldGlb);
  const worldGltf = glbToGltf(worldGlb, "world");
  writeFileSync(join(dir, "world.gltf"), worldGltf.gltf);
  const gltfExport = { [`maps/${MAP}/world.gltf`]: join(dir, "world.gltf") };
  for (const [file, body] of Object.entries(worldGltf.files)) {
    writeFileSync(join(dir, file), body);
    gltfExport[`maps/${MAP}/${file}`] = join(dir, file);
  }
  // What Source2Viewer-CLI 20.0 says, and all it does, when the world is over
  // the .glb cap: it still exits 0.
  const tooBig = {
    stdout: "--- Dumping decompiled files...\n--- Writing model to file 'world.glb'...\n",
    stderr:
      `File: maps/${MAP}/world.vwrld_c (parent: ${mapsDir}/${MAP}.vpk)\n` +
      "System.NotSupportedException: VRF does not properly support big model (>=2GiB) " +
      "exports yet due to glTF limitations. Try exporting as .gltf, not .glb.\n" +
      "   at ValveResourceFormat.IO.GltfModelExporter.WriteModelFile(ModelRoot exportedModel)\n",
  };
  const area = [
    [0, 0, 0],
    [1024, 0, 0],
    [1024, 1024, 0],
    [0, 1024, 0],
  ] as [number, number, number][];
  writeFileSync(nav, buildNav([area]));
  writeFileSync(oldNav, buildNav([area], [1], { version: 35 }));

  const exports = (overrides: Record<string, unknown> = {}) => ({
    [`maps/${MAP}/world_physics.vmdl_c`]: {
      [`maps/${MAP}/world_physics_physics.glb`]: physics,
    },
    [`maps/${MAP}/world.vwrld_c`]: { [`maps/${MAP}/world.glb`]: world },
    [`maps/${MAP}.nav`]: { [`maps/${MAP}.nav`]: nav },
    ...overrides,
  });
  const run = (
    plan: Record<string, unknown>,
    viewOptions = {},
    output: Record<string, unknown> = {},
  ) => {
    process.env.FAKE_S2V = JSON.stringify(plan);
    process.env.FAKE_S2V_OUTPUT = JSON.stringify(output);
    return extractMap(MAP, { mapsDir, outDir, cli, viewOptions });
  };
  const written = (suffix: string) => existsSync(join(outDir, `${MAP}.${suffix}`));

  beforeEach(() => {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    delete process.env.FAKE_S2V;
    delete process.env.FAKE_S2V_OUTPUT;
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("builds collision, grenade clips and a view mesh floored by the nav", async () => {
    const result = await run(exports());
    expect(result.tri.triangles).toBe(4);
    expect(result.grenadeClip.triangles).toBe(2);
    expect(result.view.floors).toBe("nav (1 areas)");
    expect(result.viewError).toBeNull();
    const view = readViewBin(readFileSync(join(outDir, `${MAP}.view.bin`)));
    expect(view.chunks.map((c: { name: string }) => c.name)).toEqual(["world"]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the map when the render export fails", async () => {
    writeFileSync(join(outDir, `${MAP}.view.bin`), "stale");
    const result = await run(exports({ [`maps/${MAP}/world.vwrld_c`]: "FAIL" }));
    expect(result.tri.triangles).toBe(4);
    expect(result.view).toBeNull();
    expect(result.viewError).toMatch(/world\.vwrld_c \(exit 3\): simulated export failure/);
    expect(written("tri")).toBe(true);
    expect(written("grenadeclip.tri")).toBe(true);
    expect(written("view.bin")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/VIEW MESH FAILED/));
  });

  it("keeps the map when no world.glb comes out", async () => {
    const result = await run(exports({ [`maps/${MAP}/world.vwrld_c`]: {} }));
    expect(result.tri).not.toBeNull();
    expect(result.viewError).toMatch(/no world\.glb/);
  });

  it("says why no render world came out, in the CLI's own words", async () => {
    const result = await run(exports({ [`maps/${MAP}/world.vwrld_c`]: {} }), {}, {
      [`maps/${MAP}/world.vwrld_c#glb`]: tooBig,
    });
    expect(result.view).toBeNull();
    expect(result.viewError).toMatch(
      /^no world\.glb or world\.gltf came out of the render world \(\.glb: File: maps\/de_fixture\/world\.vwrld_c \| System\.NotSupportedException: VRF does not properly support big model \(>=2GiB\)/,
    );
    expect(result.viewError).toMatch(/-- stdout: .*Writing model to file 'world\.glb'/);
    expect(result.viewError).toMatch(/; \.gltf: the CLI printed nothing\)$/);
    expect(result.viewError).not.toMatch(/ at ValveResourceFormat/);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/VIEW MESH FAILED \(.*>=2GiB/));
  });

  it("exports a world over the .glb cap as .gltf instead", async () => {
    const result = await run(exports({ [`maps/${MAP}/world.vwrld_c`]: gltfExport }), {}, {
      [`maps/${MAP}/world.vwrld_c#glb`]: tooBig,
    });
    expect(result.viewError).toBeNull();
    expect(result.view.trianglesIn).toBe(4);
    const view = readViewBin(readFileSync(join(outDir, `${MAP}.view.bin`)));
    expect(view.chunks.map((c: { name: string }) => c.name)).toEqual(["world"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/de_fixture: render world exported as \.gltf instead \(\.glb: .*>=2GiB/),
    );
  });

  it("keeps the map when the view mesh is over budget", async () => {
    const result = await run(exports(), { targetTriangles: 0, maxTriangles: 1 });
    expect(result.tri).not.toBeNull();
    expect(result.view).toBeNull();
    expect(result.viewError).toMatch(/over the 1 \//);
    expect(written("view.bin")).toBe(false);
  });

  it("floors from collision, loudly, when the nav does not validate", async () => {
    const result = await run(exports({ [`maps/${MAP}.nav`]: { [`maps/${MAP}.nav`]: oldNav } }));
    expect(result.view.floors).toMatch(/^collision \(\d+ surfaces, nav rejected\)$/);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/NAV REJECTED \(nav v35/));
  });

  it("fails the map only when the collision export fails", async () => {
    await expect(
      run(exports({ [`maps/${MAP}/world_physics.vmdl_c`]: "FAIL" })),
    ).rejects.toThrow(/world_physics\.vmdl_c/);
  });

  it("says why no collision hull came out", async () => {
    await expect(
      run(exports({ [`maps/${MAP}/world_physics.vmdl_c`]: {} }), {}, {
        [`maps/${MAP}/world_physics.vmdl_c`]: { stderr: "System.OutOfMemoryException: boom\n" },
      }),
    ).rejects.toThrow(
      "no world_physics_physics.glb came out (Source2Viewer-CLI said: System.OutOfMemoryException: boom)",
    );
  });
});
