// @vitest-environment node
import { describe, expect, it } from "vitest";
import { drawnBounds, levelSplits } from "~/utilities/replayStage/mapFrame";
import type { StageMap } from "~/utilities/replayStage/types";

function map(name: string): StageMap {
  return {
    name,
    tri: null,
    view: null,
    min: { x: -1000, y: -1000, z: -100 },
    max: { x: 1000, y: 1000, z: 300 },
    callouts: [],
    colliders: [],
  };
}

describe("mapFrame on a one-storey map", () => {
  it("has no storeys to lay side by side, and frames the map itself", () => {
    const mirage = map("de_mirage");
    expect(levelSplits(mirage)).toEqual([]);
    expect(() => drawnBounds(mirage)).not.toThrow();
  });
});
