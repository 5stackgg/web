// @vitest-environment node
import {
  chmodSync,
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
import { buildGlb, buildNav, quad } from "../helpers/mapFixtures";

const MAP = "de_fixture";

// Stands in for Source2Viewer-CLI: FAKE_S2V maps each --vpk_filepath to the
// files it "exports" (relative to -o), or to "FAIL" to exit non-zero.
const FAKE_CLI = `
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
const args = process.argv.slice(2);
const at = (flag) => args[args.indexOf(flag) + 1];
const plan = JSON.parse(process.env.FAKE_S2V)[at("--vpk_filepath")];
if (plan === "FAIL") {
  process.stderr.write("simulated export failure\\n");
  process.exit(3);
}
for (const [target, source] of Object.entries(plan ?? {})) {
  const path = join(at("-o"), target);
  mkdirSync(dirname(path), { recursive: true });
  copyFileSync(source, path);
}
`;

describe("extractMap", () => {
  const dir = mkdtempSync(join(tmpdir(), "extract-map-"));
  const mapsDir = join(dir, "maps");
  const outDir = join(dir, "out");
  const cli = join(dir, "s2v");
  const physics = join(dir, "physics.glb");
  const world = join(dir, "world.glb");
  const nav = join(dir, "good.nav");
  const oldNav = join(dir, "v35.nav");
  let warn: ReturnType<typeof vi.spyOn>;

  mkdirSync(mapsDir);
  writeFileSync(join(mapsDir, `${MAP}.vpk`), "");
  writeFileSync(join(dir, "fake-s2v.mjs"), FAKE_CLI);
  writeFileSync(cli, `#!/bin/sh\nexec "${process.execPath}" "${join(dir, "fake-s2v.mjs")}" "$@"\n`);
  chmodSync(cli, 0o755);

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
  writeFileSync(
    world,
    buildGlb([
      { name: "n0_lr0_agg_merge_concrete_floor_0", triangles: floor },
      { name: "n0_lr0_agg_merge_concrete_wall_0", triangles: wall },
    ]),
  );
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
  const run = (plan: Record<string, unknown>, viewOptions = {}) => {
    process.env.FAKE_S2V = JSON.stringify(plan);
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
});
