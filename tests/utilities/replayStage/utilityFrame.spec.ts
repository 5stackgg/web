// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Vec3 } from "~/utilities/replayStage/types";
import {
  UTILITY_STILL_SECS,
  buildUtilityFrame,
  fitStageShot,
  utilityStageLevel,
  utilityStageShot,
  utilityStageThrow,
  utilityStageThrower,
} from "~/utilities/replayStage/utilityFrame";

function lineup(overrides: Record<string, unknown> = {}) {
  return {
    utility_type: "Smoke",
    side: "TERRORIST",
    technique: "Stationary",
    // Hasura sends double precision as strings.
    origin_x: "0",
    origin_y: "0",
    origin_z: "-100",
    eye_z: "-36",
    view_yaw: 90,
    view_pitch: -40,
    land_x: "0",
    land_y: "1000",
    land_z: "-120",
    flight_time_ms: 2000,
    trajectory_preview: [
      [0, 0, -36],
      [0, 250, 200],
      [0, 500, 300],
      [0, 750, 200],
      [0, 960, -110],
    ],
    ...overrides,
  } as any;
}

function smokeThrow(start = 0, overrides = {}) {
  return utilityStageThrow(lineup(overrides), { key: "a", gid: 1, start })!;
}

describe("utilityStageThrow", () => {
  it("flies the preview and finishes it at the landing", () => {
    const entry = smokeThrow();
    expect(entry.type).toBe("smoke");
    expect(entry.team).toBe("t");
    expect(entry.origin).toEqual({ x: 0, y: 0, z: -100 });
    expect(entry.flight).toBe(2);
    expect(entry.path[0]).toEqual({ x: 0, y: 0, z: -36 });
    // The preview stopped 40u short; the landing is appended.
    expect(entry.path).toHaveLength(6);
    expect(entry.path.at(-1)).toEqual({ x: 0, y: 1000, z: -120 });
  });

  it("lobs from the eye when nothing was recorded", () => {
    const entry = smokeThrow(0, { trajectory_preview: null });
    expect(entry.path[0]).toEqual({ x: 0, y: 0, z: -36 });
    expect(entry.path.at(-1)).toEqual({ x: 0, y: 1000, z: -120 });
    const apex = Math.max(...entry.path.map((point) => point.z));
    expect(apex).toBeGreaterThan(-36);
  });

  it("is null with nowhere to land", () => {
    expect(
      utilityStageThrow(
        lineup({ land_x: null, land_y: null, trajectory_preview: null }),
        { key: "a", gid: 1 },
      ),
    ).toBeNull();
  });

  it("resamples a timed flight to even steps in time", () => {
    const entry = utilityStageThrow(lineup(), {
      key: "a",
      gid: 1,
      points: [
        { x: 0, y: 0, z: 0, t: 0 },
        { x: 100, y: 0, z: 0, t: 0.1 },
        { x: 1000, y: 1000, z: -120, t: 1 },
      ],
    })!;
    expect(entry.path[1].x).toBeCloseTo(500);
    expect(entry.path[1].y).toBeCloseTo(1000 * (0.4 / 0.9));
  });

  it("makes a CT molotov an incendiary", () => {
    expect(smokeThrow(0, { utility_type: "Molotov", side: "CT" }).type).toBe(
      "incendiary",
    );
    expect(smokeThrow(0, { utility_type: "Molotov" }).type).toBe("molotov");
    expect(smokeThrow(0, { utility_type: "HighExplosive" }).type).toBe("he");
  });
});

describe("utilityStageThrower", () => {
  it("stands where the lineup is thrown from, grenade in hand", () => {
    const player = utilityStageThrower(lineup({ technique: "CrouchJump" }), {
      id: "p",
      name: "Window",
    });
    expect(player).toMatchObject({
      id: "p",
      name: "Window",
      team: "t",
      x: 0,
      y: 0,
      z: -100,
      yaw: 90,
      pitch: -40,
      weapon: "smokegrenade",
      ducked: true,
      alive: true,
    });
  });
});

describe("buildUtilityFrame", () => {
  const thrower = utilityStageThrower(lineup(), { id: "p", name: "Window" });

  it("throws nothing before the clock reaches the throw", () => {
    const frame = buildUtilityFrame([smokeThrow(1)], [thrower], 0.5);
    expect(frame.players).toEqual([thrower]);
    expect(frame.projectiles).toEqual([]);
    expect(frame.smokes).toEqual([]);
    expect(frame.throws).toEqual([]);
  });

  it("flies the grenade along its flight", () => {
    const frame = buildUtilityFrame([smokeThrow(1)], [thrower], 2);
    expect(frame.projectiles).toHaveLength(1);
    expect(frame.projectiles[0].progress).toBeCloseTo(0.5);
    expect(frame.projectiles[0].age).toBeCloseTo(1);
    expect(frame.smokes).toEqual([]);
  });

  it("blooms the smoke where it lands, with its timer", () => {
    const frame = buildUtilityFrame([smokeThrow(1)], [thrower], 8);
    expect(frame.projectiles).toEqual([]);
    expect(frame.smokes).toHaveLength(1);
    expect(frame.smokes[0]).toMatchObject({
      at: { x: 0, y: 1000, z: -120 },
      age: 5,
      remaining: 15,
      voxels: null,
    });
    // The flight it took stays drawn.
    expect(frame.throws).toHaveLength(1);
  });

  it("puts the smoke out when it expires", () => {
    const frame = buildUtilityFrame([smokeThrow(0)], [thrower], 23);
    expect(frame.smokes).toEqual([]);
  });

  it("rings a landing only where nothing stands on it", () => {
    const smoke = smokeThrow(0);
    const flash = smokeThrow(0, { utility_type: "Flash" });
    const landing = (time: number | null) =>
      buildUtilityFrame([smoke, flash], [thrower], time).throws!.map(
        (entry) => entry.landing,
      );
    expect(landing(5)).toEqual([false, true]);
    expect(landing(23)).toEqual([true, true]);
    expect(landing(null)).toEqual([false, true]);
  });

  it("spreads a molotov's fire out from the landing", () => {
    const entry = smokeThrow(0, { utility_type: "Molotov" });
    const early = buildUtilityFrame([entry], [thrower], 2.2);
    const late = buildUtilityFrame([entry], [thrower], 4.5);
    expect(early.infernos).toHaveLength(1);
    expect(late.infernos[0].flames.length).toBeGreaterThan(
      early.infernos[0].flames.length,
    );
    expect(late.infernos[0].remaining).toBeCloseTo(7.03 - 2.5);
    expect(buildUtilityFrame([entry], [thrower], 9.1).infernos).toEqual([]);
  });

  it("goes off once for a flash or HE, and an HE pushes smoke aside", () => {
    const he = smokeThrow(0, { utility_type: "HighExplosive" });
    const frame = buildUtilityFrame([he], [thrower], 2.5);
    expect(frame.detonations).toMatchObject([{ type: "he", age: 0.5 }]);
    expect(frame.blasts).toHaveLength(1);
    expect(buildUtilityFrame([he], [thrower], 6).detonations).toEqual([]);
  });

  it("holds a still of the finished picture, with no timers", () => {
    const frame = buildUtilityFrame(
      [
        smokeThrow(0),
        smokeThrow(30, { utility_type: "Flash" }),
        smokeThrow(0, { utility_type: "Molotov" }),
      ],
      [thrower],
      null,
    );
    expect(frame.projectiles).toEqual([]);
    expect(frame.smokes).toMatchObject([
      { age: UTILITY_STILL_SECS, remaining: null },
    ]);
    expect(frame.infernos).toMatchObject([
      { age: UTILITY_STILL_SECS, remaining: null },
    ]);
    expect(frame.detonations).toEqual([]);
    expect(frame.throws).toHaveLength(3);
  });
});

describe("utilityStageShot", () => {
  it("keeps thrower, flight and cloud in view, looking from behind the thrower", () => {
    const shot = utilityStageShot([smokeThrow()])!;
    const ys = shot.points.map((point) => point.y);
    const zs = shot.points.map((point) => point.z);
    // The thrower, and the cloud's room past the landing.
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(1000 + 180);
    // The top of the arc.
    expect(Math.max(...zs)).toBe(300);
    expect(shot.floor).toBe(-120);
    // Thrown north, so the camera looks north (heading 0), over a shoulder.
    expect(Math.abs(shot.heading)).toBeGreaterThan(0.3);
    expect(Math.abs(shot.heading)).toBeLessThan(0.8);
  });

  it("looks east along a throw to the east", () => {
    const shot = utilityStageShot([
      smokeThrow(0, {
        land_x: "1000",
        land_y: "0",
        trajectory_preview: null,
      }),
    ])!;
    // The rig looks along (-sin h, cos h): east is h = -PI/2, give or take
    // the swing over the shoulder.
    expect(-Math.sin(shot.heading)).toBeGreaterThan(0.75);
  });

  it("is null for nothing", () => {
    expect(utilityStageShot([])).toBeNull();
  });
});

describe("fitStageShot", () => {
  // Where a point lands on screen for the rig at (target, distance), in
  // units of the lens' half-width and half-height.
  function project(
    point: Vec3,
    target: Vec3,
    distance: number,
    heading: number,
    pitch: number,
    tanV: number,
    aspect: number,
  ) {
    const [ch, sh, cp, sp] = [
      Math.cos(heading),
      Math.sin(heading),
      Math.cos(pitch),
      Math.sin(pitch),
    ];
    const d = {
      x: point.x - target.x,
      y: point.y - target.y,
      z: point.z - target.z,
    };
    const depth = distance + (-sh * cp * d.x + ch * cp * d.y - sp * d.z);
    return {
      x: (ch * d.x + sh * d.y) / depth / (tanV * aspect),
      y: (-sh * sp * d.x + ch * sp * d.y + cp * d.z) / depth / tanV,
    };
  }

  it("fits every point on screen and aims at the floor", () => {
    const shot = utilityStageShot([smokeThrow()])!;
    const pitch = (58 * Math.PI) / 180;
    const tanV = Math.tan((21 * Math.PI) / 180);
    for (const aspect of [1, 1.6]) {
      const fit = fitStageShot(
        shot.points,
        shot.heading,
        pitch,
        tanV,
        aspect,
        shot.floor,
      );
      expect(fit.target.z).toBe(shot.floor);
      const screen = shot.points.map((point) =>
        project(
          point,
          fit.target,
          fit.distance,
          shot.heading,
          pitch,
          tanV,
          aspect,
        ),
      );
      const xs = screen.map((p) => p.x);
      const ys = screen.map((p) => p.y);
      expect(Math.max(...xs.map(Math.abs), ...ys.map(Math.abs))).toBeLessThan(
        0.95,
      );
      // Tight: the picture reaches the margin on at least one side.
      expect(
        Math.max(...xs.map(Math.abs), ...ys.map(Math.abs)),
      ).toBeGreaterThan(0.75);
    }
  });

  it("keeps strips at the top and bottom clear for badges and controls", () => {
    const shot = utilityStageShot([smokeThrow()])!;
    const pitch = (58 * Math.PI) / 180;
    const tanV = Math.tan((21 * Math.PI) / 180);
    const fit = fitStageShot(
      shot.points,
      shot.heading,
      pitch,
      tanV,
      1.6,
      shot.floor,
      { top: 0.1, bottom: 0.25 },
    );
    const ys = shot.points.map(
      (point) =>
        project(point, fit.target, fit.distance, shot.heading, pitch, tanV, 1.6)
          .y,
    );
    // The bottom quarter of the screen is -1..-0.5, the top tenth 0.8..1.
    expect(Math.min(...ys)).toBeGreaterThan(-0.5);
    expect(Math.max(...ys)).toBeLessThan(0.8);
  });
});

describe("utilityStageLevel", () => {
  it("shows Nuke's lower storey when everything happens on it", () => {
    const ramp = smokeThrow(0, { origin_z: "-760", land_z: "-740" });
    const outside = smokeThrow(0, { origin_z: "-416", land_z: "-416" });
    expect(utilityStageLevel("de_nuke", [ramp])).toBe("lower");
    expect(utilityStageLevel("de_nuke", [ramp, outside])).toBeNull();
    expect(utilityStageLevel("de_mirage", [ramp])).toBeNull();
  });
});
