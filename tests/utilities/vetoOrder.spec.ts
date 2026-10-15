// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  mapVetoOrder,
  mapVetoPattern,
  regionVetoOrder,
} from "~/utilities/vetoOrder";

const compact = (bestOf: number, pool: number) =>
  mapVetoOrder(bestOf, pool)
    .map(({ type, lineup }) => `${type[0]}${lineup ?? ""}`)
    .join(" ");

describe("mapVetoPattern", () => {
  it("bans down to the decider in a best of one", () => {
    expect(mapVetoPattern(1, 7)).toEqual([
      "Ban",
      "Ban",
      "Ban",
      "Ban",
      "Ban",
      "Ban",
      "Decider",
    ]);
  });

  it("answers every pick with a side", () => {
    expect(mapVetoPattern(3, 7).join(" ")).toBe(
      "Ban Ban Pick Side Pick Side Ban Ban Decider",
    );
  });

  it("picks the rest once banning would leave too few maps", () => {
    expect(mapVetoPattern(5, 7).join(" ")).toBe(
      "Ban Ban Pick Side Pick Side Pick Side Pick Side Decider",
    );
  });

  it("spends a bigger pool's extra bans after the picks", () => {
    expect(mapVetoPattern(3, 9).join(" ")).toBe(
      "Ban Ban Pick Side Pick Side Ban Ban Ban Ban Decider",
    );
  });

  it("is empty when the pool cannot fill the series", () => {
    expect(mapVetoPattern(5, 3)).toEqual([]);
  });
});

describe("mapVetoOrder", () => {
  it("alternates bans in a best of one", () => {
    expect(compact(1, 7)).toBe("B1 B2 B1 B2 B1 B2 D");
  });

  it("snakes the picks and gives the side to the other lineup", () => {
    expect(compact(3, 7)).toBe("B1 B2 P1 S2 P2 S1 B2 B1 D");
  });

  it("keeps snaking through a best of five", () => {
    expect(compact(5, 7)).toBe("B1 B2 P1 S2 P2 S1 P2 S1 P1 S2 D");
  });
});

describe("regionVetoOrder", () => {
  it("alternates bans until one region is left", () => {
    expect(
      regionVetoOrder(5).map(({ type, lineup }) => `${type[0]}${lineup ?? ""}`),
    ).toEqual(["B1", "B2", "B1", "B2", "D"]);
  });

  it("has nothing to veto with one region", () => {
    expect(regionVetoOrder(1)).toEqual([]);
  });
});
