// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { lineupSmokeVoxels } from "~/utilities/lineupSmokeVoxels";

const row = {
  gid: 0,
  round: 0,
  start_tick: 0,
  ox: -100,
  oy: -200,
  oz: -40,
  vs: 20,
  dx: 2,
  dy: 1,
  dz: 1,
  arr: Buffer.from([0, 7]).toString("base64"),
};

afterEach(() => vi.unstubAllGlobals());

describe("lineupSmokeVoxels", () => {
  it("decodes the recorded grid, fetching each url once", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(row)));
    vi.stubGlobal("fetch", fetch);
    const url = "https://clips.test/clips/utility/a.smoke.json?v=1";
    const voxels = await lineupSmokeVoxels(url);
    expect(voxels).toMatchObject({ ox: -100, vs: 20, dx: 2, dy: 1, dz: 1 });
    expect([...voxels!.arrival]).toEqual([0, 7]);
    await lineupSmokeVoxels(url);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("is null without a url or when the file is not there", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    expect(await lineupSmokeVoxels(null)).toBe(null);
    expect(
      await lineupSmokeVoxels("https://clips.test/clips/utility/b.smoke.json"),
    ).toBe(null);
  });
});
