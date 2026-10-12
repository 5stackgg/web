// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decodeMoment,
  encodeMoment,
  locateTick,
} from "~/utilities/replayStage/moment";

describe("replay moment links", () => {
  it("round-trips every field", () => {
    const moment = {
      round: 12,
      tick: 48210,
      view: "3d" as const,
      level: "lower",
      follow: "76561198000000000",
      camera: {
        eye: { x: -1200.4, y: 830, z: 1500.6 },
        target: { x: -400, y: -220.2, z: -160 },
      },
    };
    const hash = encodeMoment(moment);
    expect(hash).toBe(
      "r=12&t=48210&v=3d&lv=lower&f=76561198000000000&c=-1200,830,1501,-400,-220,-160",
    );
    expect(decodeMoment(`#${hash}`)).toEqual({
      ...moment,
      camera: {
        eye: { x: -1200, y: 830, z: 1501 },
        target: { x: -400, y: -220, z: -160 },
      },
    });
  });

  it("keeps the minimal link short", () => {
    expect(encodeMoment({ round: 3, tick: 1234.6 })).toBe("r=3&t=1235");
    expect(decodeMoment("r=3&t=1235")).toEqual({ round: 3, tick: 1235 });
  });

  it("needs a round and a tick", () => {
    expect(decodeMoment("")).toBeNull();
    expect(decodeMoment("#")).toBeNull();
    expect(decodeMoment("#section-2")).toBeNull();
    expect(decodeMoment("#r=3")).toBeNull();
    expect(decodeMoment("#t=100")).toBeNull();
    expect(decodeMoment("#r=-1&t=100")).toBeNull();
    expect(decodeMoment("#r=1.5&t=100")).toBeNull();
  });

  it("drops fields it cannot trust", () => {
    expect(
      decodeMoment("#r=1&t=2&v=4d&lv=<b>&f=a%20b&c=1,2,3,4,5&c=1,2,3,4,5,x"),
    ).toEqual({ round: 1, tick: 2 });
    expect(decodeMoment("#r=1&t=2&c=1,2,3,4,5,9e9")).toEqual({
      round: 1,
      tick: 2,
    });
    expect(
      encodeMoment({
        round: 1,
        tick: 2,
        level: "a b",
        follow: "x".repeat(40),
        camera: { eye: { x: NaN, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
      }),
    ).toBe("r=1&t=2");
  });

  it("finds a tick between samples", () => {
    const ticks = [100, 116, 132, 140, 172];
    expect(locateTick(ticks, 50)).toEqual({ index: 0, fraction: 0 });
    expect(locateTick(ticks, 100)).toEqual({ index: 0, fraction: 0 });
    expect(locateTick(ticks, 124)).toEqual({ index: 1, fraction: 0.5 });
    expect(locateTick(ticks, 140)).toEqual({ index: 3, fraction: 0 });
    expect(locateTick(ticks, 164)).toEqual({ index: 3, fraction: 0.75 });
    expect(locateTick(ticks, 900)).toEqual({ index: 4, fraction: 0 });
    expect(locateTick([], 10)).toEqual({ index: 0, fraction: 0 });
  });
});
