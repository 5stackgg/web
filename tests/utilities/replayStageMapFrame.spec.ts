// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  drawnBounds,
  levelSplits,
  playArea,
} from "~/utilities/replayStage/mapFrame";
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

describe("mapFrame with no callouts", () => {
  it("frames where the match was played (a Rush room), else the map", () => {
    const rush = map("rush_001");
    expect(playArea(rush).min.x).toBe(-1000);
    rush.play = {
      min: { x: 200, y: 300, z: 0 },
      max: { x: 600, y: 500, z: 64 },
    };
    const area = playArea(rush);
    expect(area.min.x).toBeGreaterThan(100);
    expect(area.min.x).toBeLessThan(200);
    expect(area.max.y).toBeGreaterThan(500);
    expect(area.max.y).toBeLessThan(700);
  });

  it("keeps a map's callouts first", () => {
    const mirage = map("de_mirage");
    mirage.callouts = [
      { name: "A", boxes: [{ min: [-500, -500, 0], max: [500, 500, 64] }] },
    ];
    mirage.play = {
      min: { x: 200, y: 300, z: 0 },
      max: { x: 600, y: 500, z: 64 },
    };
    expect(playArea(mirage).min.x).toBeLessThan(-500);
  });
});
