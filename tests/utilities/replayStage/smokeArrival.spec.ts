// @vitest-environment node
import { describe, expect, it } from "vitest";
import { smokeReachedBy } from "~/utilities/replayStage/smokeArrival";

describe("smokeReachedBy", () => {
  it("bursts out of the grenade instead of appearing half grown", () => {
    expect(smokeReachedBy(0)).toBe(0);
    expect(smokeReachedBy(0.05)).toBeLessThan(0.15);
    expect(smokeReachedBy(0.4)).toBeGreaterThan(0.55);
    expect(smokeReachedBy(1.2)).toBeCloseTo(0.86);
    expect(smokeReachedBy(4)).toBe(1);
  });

  it("only ever grows", () => {
    let last = -1;
    for (let t = 0; t <= 5; t += 0.01) {
      const share = smokeReachedBy(t);
      expect(share).toBeGreaterThanOrEqual(last);
      last = share;
    }
  });
});
