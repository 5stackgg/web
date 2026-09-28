// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  pickRadarVolume,
  projectWithCalibration,
  unprojectWithCalibration,
  type RadarMeta,
  type RadarVolume,
} from "~/composables/useRadarProjection";
import metadata from "~/public/radars/metadata.json";

const rush = (metadata as unknown as Record<string, RadarMeta>).rush_001;
const mirage = (metadata as unknown as Record<string, RadarMeta>).de_mirage;

function volume(name: string): RadarVolume {
  const found = rush.volumes?.find((v) => v.name === name);
  if (!found) {
    throw new Error(`no ${name} in rush_001 metadata`);
  }
  return found;
}

type Spawn = { room: string; ct: [number, number]; t: [number, number] };

// The map script teleports each side to `ct1room.<room>` / `t1room.<room>`
// point_teleports; these are their origins from rush_001's entity lump.
const SPAWNS: Spawn[] = [
  { room: "room101", ct: [1476, 2269], t: [3086, 2093] },
  { room: "room203", ct: [-7144, 3086], t: [-7062, 2129] },
  { room: "room204", ct: [-8183, -4170], t: [-10708.24, -4254.48] },
  { room: "room207", ct: [-10155, -1919], t: [-7776, -1828] },
  { room: "room210", ct: [-8559, 6892], t: [-7088.5, 4125] },
  { room: "room212", ct: [-5992.02, 6500], t: [-4043.98, 6300] },
  { room: "convoy", ct: [-2539, -8231.5], t: [-6270, -8170.5] },
];

const box = (
  name: string,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): RadarVolume => ({
  name,
  resolution: 1,
  offset: { x: 0, y: 0 },
  bounds: { minX, maxX, minY, maxY },
});

describe("pickRadarVolume", () => {
  const a = box("a", 0, 100, 0, 100);
  const b = box("b", 100, 300, 0, 100);
  const meta = { volumes: [a, b] };

  it("is null for a map without volumes, for no points, and outside every volume", () => {
    expect(pickRadarVolume(mirage, [{ x: 0, y: 0 }])).toBeNull();
    expect(pickRadarVolume(null, [{ x: 0, y: 0 }])).toBeNull();
    expect(pickRadarVolume(meta, [])).toBeNull();
    expect(pickRadarVolume(meta, [{ x: -50, y: 500 }])).toBeNull();
  });

  it("takes the volume most points stand in, not the first one hit", () => {
    const points = [
      { x: 10, y: 10 },
      { x: 150, y: 50 },
      { x: 200, y: 50 },
    ];
    expect(pickRadarVolume(meta, points)).toBe(b);
  });

  it("breaks a tie on the volume whose centre is nearest the points' centroid", () => {
    expect(
      pickRadarVolume(meta, [
        { x: 90, y: 50 },
        { x: 110, y: 50 },
      ]),
    ).toBe(a);
    expect(
      pickRadarVolume(meta, [
        { x: 10, y: 50 },
        { x: 290, y: 50 },
      ]),
    ).toBe(b);
  });

  it("reads Hasura's stringified doubles and skips points that are not numbers", () => {
    const points = [
      { x: "150", y: "50" },
      { x: Number.NaN, y: 10 },
    ] as unknown as { x: number; y: number }[];
    expect(pickRadarVolume(meta, points)).toBe(b);
  });

  it("puts every rush_001 spawn in its own room", () => {
    for (const { room, ct, t } of SPAWNS) {
      const points = [
        { x: ct[0], y: ct[1] },
        { x: t[0], y: t[1] },
      ];
      expect(pickRadarVolume(rush, points)?.name).toBe(room);
      expect(pickRadarVolume(rush, [points[0]])?.name).toBe(room);
    }
  });

  it("does not treat the overlap of two rooms' radar images as either room", () => {
    // Inside both the room204 and room207 radar squares, but in the corridor
    // between their cs_minimap_volume brushes.
    expect(pickRadarVolume(rush, [{ x: -9000, y: -3300 }])).toBeNull();
  });
});

describe("projection with a volume calibration", () => {
  it("lands a room's spawns on that room's radar", () => {
    for (const { room, ct, t } of SPAWNS) {
      for (const [x, y] of [ct, t]) {
        const px = projectWithCalibration({ x, y }, volume(room));
        expect(px.x).toBeGreaterThan(0);
        expect(px.x).toBeLessThan(1024);
        expect(px.y).toBeGreaterThan(0);
        expect(px.y).toBeLessThan(1024);
      }
    }
  });

  it("matches Valve's overview for the room and for the whole map", () => {
    const spawn = { x: 1476, y: 2269 };

    const room = projectWithCalibration(spawn, volume("room101"));
    expect(room.x).toBeCloseTo((1476 - 1376) / 1.78125, 3);
    expect(room.y).toBeCloseTo((3520 - 2269) / 1.78125, 3);

    const whole = projectWithCalibration(spawn, rush);
    expect(whole.x).toBeCloseTo((1476 + 11240) / 18.910156, 3);
    expect(whole.y).toBeCloseTo((9944 - 2269) / 18.910156, 3);
  });

  it("unprojects back to the same world point", () => {
    const spawn = { x: -8183, y: -4170 };
    const px = projectWithCalibration(spawn, volume("room204"));
    const back = unprojectWithCalibration(px, volume("room204"));
    expect(back.x).toBeCloseTo(spawn.x, 6);
    expect(back.y).toBeCloseTo(spawn.y, 6);
  });
});
