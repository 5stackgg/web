// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { StageHeatPoint } from "~/utilities/replayStage/types";
import { clusterHeat } from "~/utilities/replayStage/utilityOverlay";

function point(
  gid: number,
  type: StageHeatPoint["type"],
  x: number,
  y = 0,
  selected = false,
): StageHeatPoint {
  return {
    key: `g${gid}`,
    gid,
    type,
    team: "t",
    at: { x, y, z: 0 },
    selected,
  };
}

describe("clusterHeat", () => {
  it("shares a disc between same-type detonations close together", () => {
    const clusters = clusterHeat(
      [
        point(1, "smoke", 0),
        point(2, "smoke", 80, 40, true),
        point(3, "flash", 50),
        point(4, "smoke", 400),
      ],
      () => 0,
    );
    expect(
      clusters.map((c) => [c.type, c.gids, c.count, c.selected, c.x]),
    ).toEqual([
      ["smoke", [1, 2], 2, true, 40],
      ["flash", [3], 1, false, 50],
      ["smoke", [4], 1, false, 400],
    ]);
  });

  it("keeps detonations on different storeys apart", () => {
    const floors: Record<string, number> = { g1: 0, g2: -300 };
    const clusters = clusterHeat(
      [point(1, "he", 0), point(2, "he", 10)],
      (h) => floors[h.key],
    );
    expect(clusters).toHaveLength(2);
  });

  it("counts a detonation without an id but cannot pick it", () => {
    const [cluster] = clusterHeat(
      [point(5, "flash", 0), point(-1, "flash", 5)],
      () => 0,
    );
    expect(cluster.count).toBe(2);
    expect(cluster.gids).toEqual([5]);
  });
});
