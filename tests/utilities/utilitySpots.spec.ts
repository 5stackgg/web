// @vitest-environment node
import { describe, expect, it } from "vitest";
import { groupUtilitySpots } from "~/utilities/utilitySpots";
import type { UtilityLandingRow } from "~/utilities/utilitySpots";
import type { MapCallout } from "~/utilities/mapCallouts";

const callouts: MapCallout[] = [
  { name: "Temple", boxes: [{ min: [0, 0, 0], max: [100, 100, 100] }] },
  { name: "BombsiteA", boxes: [{ min: [1000, 0, 0], max: [1100, 100, 100] }] },
];

function row(
  id: string,
  x: number | null,
  y: number | null,
  utility_type: UtilityLandingRow["utility_type"] = "Smoke",
): UtilityLandingRow {
  return { id, utility_type, land_x: x, land_y: y, land_z: 50 };
}

describe("groupUtilitySpots", () => {
  it("groups throws by the callout they land in, biggest spot first", () => {
    const spots = groupUtilitySpots(
      [
        row("a", 1050, 50),
        row("b", 10, 10),
        row("c", 20, 20, "Flash"),
        row("d", 30, 30),
      ],
      callouts,
    );

    expect(spots.map((spot) => [spot.key, spot.ids])).toEqual([
      ["Temple", ["b", "c", "d"]],
      ["BombsiteA", ["a"]],
    ]);
  });

  it("labels spots the way a player says them", () => {
    const [spot] = groupUtilitySpots([row("a", 1050, 50)], callouts);
    expect(spot.label).toBe("A Site");
  });

  it("lists grenade types in the app's type order, once each", () => {
    const [spot] = groupUtilitySpots(
      [
        row("a", 10, 10, "Molotov"),
        row("b", 10, 10, "Smoke"),
        row("c", 10, 10, "Smoke"),
      ],
      callouts,
    );
    expect(spot.types).toEqual(["Smoke", "Molotov"]);
  });

  it("reads Hasura's stringified doubles", () => {
    const spots = groupUtilitySpots(
      [{ id: "a", utility_type: "Smoke", land_x: "10", land_y: "10", land_z: "50" }],
      callouts,
    );
    expect(spots[0]?.key).toBe("Temple");
  });

  it("leaves out throws with no landing or nowhere named", () => {
    const spots = groupUtilitySpots(
      [row("a", null, null), row("b", 50000, 50000)],
      callouts,
    );
    expect(spots).toEqual([]);
  });

  it("has nothing to say about a map with no callouts", () => {
    expect(groupUtilitySpots([row("a", 10, 10)], [])).toEqual([]);
  });
});
