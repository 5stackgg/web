// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  collisionFloors,
  distanceField,
  FloorIndex,
  NavError,
  parseNav,
  walkableSurfaces,
} from "~/scripts/lib-nav.mjs";
import { buildNav, type Vec3 } from "../helpers/mapFixtures";

const ground: Vec3[] = [
  [0, 0, 0],
  [100, 0, 0],
  [100, 100, 0],
  [0, 100, 0],
];
const upstairs: Vec3[] = [
  [0, 0, 128],
  [100, 0, 128],
  [100, 100, 128],
];
const ramp: Vec3[] = [
  [200, 0, 0],
  [300, 0, 100],
  [300, 100, 100],
  [200, 100, 0],
];

describe("parseNav", () => {
  it("finds the corners and areas by shape past both KV3 blobs", () => {
    const nav = parseNav(buildNav([ground, upstairs, ramp], [7, 8, 9]));
    expect(nav.version).toBe(36);
    expect(nav.subversion).toBe(1);
    expect(nav.areas.map((a: { id: number }) => a.id)).toEqual([7, 8, 9]);
    expect(nav.areas[1].polygon).toEqual(upstairs);
    expect(nav.areas[2].polygon).toEqual(ramp);
  });

  it("rejects anything that is not a nav", () => {
    expect(() => parseNav(Buffer.alloc(64))).toThrow(NavError);
    expect(() => parseNav(Buffer.alloc(64))).toThrow(/magic/);
  });

  it("rejects any version but 36", () => {
    const nav = buildNav([ground, upstairs, ramp], [7, 8, 9], { version: 35 });
    expect(() => parseNav(nav)).toThrow(NavError);
    expect(() => parseNav(nav)).toThrow(/v35/);
  });

  it("never settles for a partial area list from a truncated file", () => {
    const polygons = Array.from({ length: 40 }, (_, i): Vec3[] => [
      [i * 100, 0, 0],
      [i * 100 + 90, 0, 0],
      [i * 100 + 90, 90, 0],
    ]);
    const nav = buildNav(polygons);
    expect(parseNav(nav).areas).toHaveLength(40);
    for (const fraction of [0.5, 0.75, 0.95]) {
      const cut = nav.subarray(0, Math.floor(nav.length * fraction));
      expect(() => parseNav(cut)).toThrow(NavError);
    }
  });

  it("requires one area per polygon", () => {
    const nav = buildNav([ground, upstairs, ramp], [7, 8]);
    expect(() => parseNav(nav)).toThrow(/no list of 3 areas/);
  });

  it("only looks for the area list just past the polygons", () => {
    const near = buildNav([ground, upstairs, ramp], [7, 8, 9], { gap: 144 });
    expect(parseNav(near).areas).toHaveLength(3);
    const far = buildNav([ground, upstairs, ramp], [7, 8, 9], { gap: 5000 });
    expect(() => parseNav(far)).toThrow(NavError);
  });
});

describe("walkableSurfaces", () => {
  const soup = new Float32Array([0, 0, 0, 100, 0, 0, 0, 100, 0]);
  const noClips = new Float32Array(0);

  it("takes the nav's areas when it validates", () => {
    const surfaces = walkableSurfaces(buildNav([ground, upstairs, ramp]), soup, noClips);
    expect(surfaces.source).toBe("nav");
    expect(surfaces.polygons).toHaveLength(3);
    expect(surfaces.rejected).toBeNull();
  });

  it("falls back to collision, saying why, when the nav does not", () => {
    const bad = buildNav([ground, upstairs, ramp], [7, 8, 9], { version: 37 });
    const surfaces = walkableSurfaces(bad, soup, noClips);
    expect(surfaces.source).toBe("collision");
    expect(surfaces.polygons).toHaveLength(1);
    expect(surfaces.rejected).toMatch(/v37/);
  });

  it("uses collision quietly when there is no nav at all", () => {
    const surfaces = walkableSurfaces(null, soup, noClips);
    expect(surfaces.source).toBe("collision");
    expect(surfaces.rejected).toBeNull();
  });
});

describe("FloorIndex", () => {
  const floors = new FloorIndex([ground, upstairs, ramp]);

  it("takes the highest floor at or below the point", () => {
    expect(floors.floorAt(50, 20, 200, 48)).toBe(128);
    expect(floors.floorAt(50, 20, 100, 48)).toBe(0);
    expect(floors.floorAt(50, 20, 124, 48)).toBe(128);
    expect(floors.floorAt(50, 20, -20, 48)).toBeNull();
  });

  it("interpolates a sloped area's height", () => {
    expect(floors.floorAt(250, 50, 500, 1)).toBeCloseTo(50, 5);
  });

  it("reaches a floor beside a wall base within the radius only", () => {
    expect(floors.floorAt(-40, 50, 60, 48)).toBe(0);
    expect(floors.floorAt(-60, 50, 60, 48)).toBeNull();
  });

  it("falls back to the nearest floor and flags it as outside", () => {
    expect(floors.floor(50, -30, 64)).toEqual({ z: 0, outside: false });
    expect(floors.floor(50, -500, 64)).toEqual({ z: 0, outside: true });
    expect(floors.floor(250, -500, 100)).toEqual({ z: 50, outside: true });
    const none = floors.floor(5000, 5000, 64);
    expect(none.outside).toBe(false);
    expect(Number.isNaN(none.z)).toBe(true);
  });
});

describe("distanceField", () => {
  const field = distanceField([ground], { cell: 16, margin: 512 });

  it("is zero over a polygon and grows with distance", () => {
    expect(field.at(50, 50)).toBe(0);
    expect(field.at(400, 50)).toBeGreaterThan(250);
    expect(field.at(400, 50)).toBeLessThan(330);
    expect(field.at(10000, 50)).toBe(Infinity);
  });
});

describe("collisionFloors", () => {
  const soup = (tris: Vec3[][]) => new Float32Array(tris.flat(2));

  it("keeps up-facing collision no player clip covers", () => {
    const open: Vec3[] = [
      [0, 0, 0],
      [100, 0, 0],
      [0, 100, 0],
    ];
    const roof: Vec3[] = [
      [500, 0, 256],
      [600, 0, 256],
      [500, 100, 256],
    ];
    const wall: Vec3[] = [
      [0, 0, 0],
      [100, 0, 0],
      [0, 0, 100],
    ];
    const clip: Vec3[] = [
      [480, -20, 280],
      [640, -20, 280],
      [480, 140, 280],
    ];
    const floors = collisionFloors(soup([open, roof, wall]), soup([clip]));
    expect(floors).toEqual([open]);
  });
});
