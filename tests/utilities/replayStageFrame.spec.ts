// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildStageFrame,
  roundTick,
  stageRounds,
} from "~/utilities/replayStage/frame";
import { joinShotsAndDamages } from "~/utilities/replayStage/frameIndex";
import type {
  DamageRow,
  ShotRow,
  StageBlob,
} from "~/utilities/replayStage/frameIndex";

const T = "76561190000000001";
const CT = "76561190000000002";

function position(
  id: string,
  team: string,
  tick: number,
  x: number,
  extra = {},
) {
  return {
    round: 1,
    tick,
    attacker_steam_id: id,
    attacker_team: team,
    alive: true,
    x,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    health: 100,
    armor: 100,
    ...extra,
  };
}

function shot(tick: number, extra: Partial<ShotRow> = {}): ShotRow {
  return {
    round: 1,
    tick,
    attacker_steam_id: T,
    attacker_team: "t",
    with: "ak47",
    yaw: 0,
    pitch: 0,
    eye_x: 0,
    eye_y: 0,
    eye_z: 64,
    result: null,
    miss_x: 1000,
    miss_y: tick,
    miss_z: 64,
    ...extra,
  };
}

function damage(tick: number, extra: Partial<DamageRow> = {}): DamageRow {
  return {
    round: 1,
    time: String(tick),
    attacker_steam_id: T,
    attacked_steam_id: CT,
    damage: 27,
    health: 73,
    ...extra,
  };
}

function blob(extra: Partial<StageBlob> = {}): StageBlob {
  return {
    schema_version: 11,
    match_map_id: "m",
    tick_rate: 64,
    total_ticks: 10000,
    map_name: "de_mirage",
    round_ticks: [
      { round: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 5000 },
    ],
    players: [
      { steam_id: T, name: "tee" },
      { steam_id: CT, name: "cee" },
    ],
    kills: [],
    bombs: [],
    positions: [
      position(T, "t", 100, 0),
      position(T, "t", 4000, 0),
      position(CT, "ct", 100, 500),
      position(CT, "ct", 4000, 500),
    ],
    shots_fired: [],
    grenade_throws: [],
    damages: [],
    ...extra,
  };
}

const players = {
  position: (id: string) =>
    id === CT ? { x: 500, y: 0, z: 0 } : { x: 0, y: 0, z: 0 },
  team: () => null,
};

describe("joinShotsAndDamages", () => {
  // PlayerHurt lands before WeaponFire on the same tick, so the parser marks
  // the round before the one that hit (or none at all).
  it("credits a damage to the bullet fired on its own tick", () => {
    const { shots, damages } = joinShotsAndDamages(
      [
        shot(100),
        shot(110, { result: "hit", impact_x: 484, impact_y: 0, impact_z: 55 }),
        shot(120),
      ],
      [damage(120)],
      64,
      players,
    );
    expect(shots.map((s) => s.hit)).toEqual([false, false, true]);
    expect(shots[2]).toMatchObject({ victimId: CT, damage: 27 });
    // The parser's impact is the victim's body point for that damage.
    expect(shots[2].to).toEqual({ x: 484, y: 0, z: 55 });
    // And the round it wrongly marked flies on to its wall.
    expect(shots[1].to).toEqual({ x: 1000, y: 110, z: 64 });
    expect(damages[0]).toMatchObject({
      victimId: CT,
      amount: 27,
      healthAfter: 73,
    });
  });

  it("falls back to the latest round inside 250ms, and no further", () => {
    const { shots } = joinShotsAndDamages(
      [shot(100), shot(104), shot(200)],
      [damage(110), damage(210)],
      64,
      players,
    );
    expect(shots.map((s) => s.hit)).toEqual([false, true, true]);
    const late = joinShotsAndDamages([shot(100)], [damage(117)], 64, players);
    expect(late.shots[0].hit).toBe(false);
  });

  it("puts the round on the hit group when the parser left no impact", () => {
    const { shots } = joinShotsAndDamages(
      [shot(120)],
      [damage(120, { hitgroup: 1 })],
      64,
      players,
    );
    expect(shots[0].headshot).toBe(true);
    // Head height, pulled 16u back toward the shooter's eye.
    expect(shots[0].to.x).toBeCloseTo(484, 0);
    expect(shots[0].to.z).toBeCloseTo(68, 0);
  });

  it("does not let a second victim of one bullet steal an earlier miss", () => {
    const { shots, damages } = joinShotsAndDamages(
      [shot(110), shot(120)],
      [damage(120), damage(120, { attacked_steam_id: "other" })],
      64,
      players,
    );
    expect(shots.map((s) => s.hit)).toEqual([false, true]);
    expect(damages).toHaveLength(2);
  });

  it("leaves grenade and fire damage off the bullets", () => {
    const { shots } = joinShotsAndDamages(
      [shot(120)],
      [damage(120, { weapon: "hegrenade" })],
      64,
      players,
    );
    expect(shots[0].hit).toBe(false);
  });

  it("drops rounds and damage it has nowhere to put", () => {
    const nowhere = { position: () => null, team: () => null };
    const { shots, damages } = joinShotsAndDamages(
      [shot(110, { eye_x: null, eye_y: null, eye_z: null })],
      [damage(110)],
      64,
      nowhere,
    );
    expect(shots).toHaveLength(0);
    expect(damages).toHaveLength(0);
  });

  it("reads a headshot from the parser's marked round on blobs without hit groups", () => {
    const { damages, shots } = joinShotsAndDamages(
      [shot(110, { result: "headshot" }), shot(120)],
      [damage(120)],
      64,
      players,
    );
    expect(damages[0].headshot).toBe(true);
    expect(shots[1].headshot).toBe(true);
  });
});

describe("buildStageFrame players", () => {
  it("interpolates by tick across 4Hz samples and per-tick throw bursts", () => {
    const burst = Array.from({ length: 11 }, (_, i) =>
      position(T, "t", 200 + i, 200 + i),
    );
    const b = blob({
      positions: [
        position(T, "t", 100, 0, { yaw: 350 }),
        position(T, "t", 116, 160, { yaw: 10 }),
        ...burst,
        position(CT, "ct", 100, 500),
      ],
    });
    const at = (tick: number) =>
      buildStageFrame(b, 1, tick).players.find((p) => p.id === T)!;
    expect(at(108).x).toBeCloseTo(80);
    // 350 to 10 degrees goes the short way, through 0.
    expect(((at(108).yaw % 360) + 360) % 360).toBeCloseTo(0);
    expect(at(205.5).x).toBeCloseTo(205.5);
    expect(at(50).x).toBe(0);
  });

  it("takes names from options, then the blob, and marks the selected one", () => {
    const frame = buildStageFrame(blob(), 1, 200, {
      names: new Map([[CT, "Ankle"]]),
      selectedId: T,
    });
    expect(frame.players.map((p) => [p.name, p.selected])).toEqual([
      ["tee", true],
      ["Ankle", false],
    ]);
  });

  it("steps health at the damage tick, and dies where the kill says", () => {
    const b = blob({
      damages: [damage(1000, { health: 40 })],
      kills: [
        {
          tick: 2000,
          killer: T,
          victim: CT,
          victim_team: "ct",
          victim_x: 510,
          victim_y: 5,
          victim_z: 0,
        },
      ],
    });
    const ct = (tick: number) =>
      buildStageFrame(b, 1, tick).players.find((p) => p.id === CT)!;
    expect(ct(999).health).toBe(100);
    expect(ct(1000).health).toBe(40);
    expect(ct(1032).hurtAge).toBeCloseTo(0.5);
    expect(ct(1999).alive).toBe(true);
    expect(ct(2064)).toMatchObject({
      alive: false,
      health: 0,
      x: 510,
      y: 5,
      diedAge: 1,
    });
    expect(buildStageFrame(b, 1, 2064).kills[0]).toMatchObject({
      team: "ct",
      age: 1,
    });
  });

  it("reads blindness from the demo's flashes", () => {
    const b = blob({
      flashes: [
        {
          round: 1,
          tick: 1000,
          attacker_steam_id: T,
          attacked_steam_id: CT,
          duration: 4,
          team_flash: false,
        },
      ],
    });
    const blind = (tick: number) =>
      buildStageFrame(b, 1, tick).players.find((p) => p.id === CT)!.blind;
    expect(blind(999)).toBe(0);
    expect(blind(1000 + 64 * 0.5)).toBe(1);
    // 1.5s left of a 3s fade-out: (1.5 / 3)^2.
    expect(blind(1000 + 64 * 2.5)).toBeCloseTo(0.25);
    expect(blind(1000 + 64 * 4)).toBe(0);
  });

  it("plays a last round whose end the viewer's blob does not know", () => {
    const b = blob({
      total_ticks: 0,
      round_ticks: [{ round: 1, start_tick: 0, freeze_end_tick: 64 }],
      kills: [{ tick: 3000, killer: T, victim: CT, victim_team: "ct" }],
    });
    const frame = buildStageFrame(b, 1, 3064);
    expect(frame.players).toHaveLength(2);
    expect(frame.kills).toHaveLength(1);
    expect(stageRounds(b)[0].endTick).toBe(4000);
  });

  it("files kills and bombs by tick when the blob has no round ticks", () => {
    const b = blob({
      round_ticks: [],
      kills: [{ tick: 2000, killer: T, victim: CT, victim_team: "ct" }],
      bombs: [{ tick: 1000, type: "planted", player: T, x: 90, y: 9, z: 1 }],
    });
    const frame = buildStageFrame(b, 1, 2064);
    expect(frame.players.find((p) => p.id === CT)?.alive).toBe(false);
    expect(frame.kills).toHaveLength(1);
    expect(frame.bomb).toMatchObject({ state: "planted", at: { x: 90 } });
  });

  it("matches steam ids that arrive as numbers", () => {
    const t = Number(T) as unknown as string;
    const ct = Number(CT) as unknown as string;
    const b = blob({
      positions: [
        position(t, "t", 100, 0),
        position(t, "t", 4000, 0),
        position(ct, "ct", 100, 500),
        position(ct, "ct", 4000, 500),
      ],
      kills: [{ tick: 2000, killer: t, victim: ct, victim_team: "ct" }],
      bombs: [{ tick: 64, type: "pickup", player: t }],
      flashes: [
        {
          round: 1,
          tick: 1000,
          attacker_steam_id: t,
          attacked_steam_id: ct,
          duration: 4,
          team_flash: false,
        },
      ],
    });
    const id = String(Number(T));
    const victim = String(Number(CT));
    const at = (tick: number) =>
      buildStageFrame(b, 1, tick).players.find((p) => p.id === victim)!;
    expect(at(1032).blind).toBe(1);
    expect(at(2064).alive).toBe(false);
    const frame = buildStageFrame(b, 1, 2064);
    expect(frame.kills[0]).toMatchObject({ killerId: id, victimId: victim });
    expect(frame.bomb?.state).toBe("carried");
    expect(frame.players.find((p) => p.id === id)?.hasBomb).toBe(true);
  });

  it("drops rows a restarted match labelled with the same round", () => {
    const b = blob({
      round_ticks: [
        { round: 1, start_tick: 3000, freeze_end_tick: 3064, end_tick: 5000 },
      ],
      positions: [position(T, "t", 100, -999), position(T, "t", 3100, 7)],
    });
    expect(buildStageFrame(b, 1, 3200).players[0].x).toBe(7);
    expect(stageRounds(b)[0]).toMatchObject({ round: 1, freezeEndTick: 3064 });
    expect(roundTick(b, 1, 2)).toBe(3064 + 128);
  });
});

describe("buildStageFrame utility", () => {
  it("maps flames to life, intensity, age and a stable seed", () => {
    const b = blob({
      infernos: [
        {
          id: 7,
          round: 1,
          thrower: T,
          thrower_team: "t",
          start_tick: 1000,
          end_tick: 1448,
          fires: [
            { x: 10, y: 20, z: 0, s: 1000, e: 1448 },
            { x: 80, y: 20, z: 0, s: 1200, e: 1448 },
          ],
        },
      ],
    });
    const inferno = buildStageFrame(b, 1, 1224).infernos[0];
    expect(inferno).toMatchObject({ key: "inf7", team: "t", type: "molotov" });
    const [old, fresh] = inferno.flames;
    expect(old.life).toBeCloseTo(0.5);
    expect(old.intensity).toBe(1);
    expect(old.age).toBeCloseTo(3.5);
    // Caught 0.375s ago, just past its 0.35s catch.
    expect(fresh.intensity).toBe(1);
    expect(
      buildStageFrame(b, 1, 1210).infernos[0].flames[1].intensity,
    ).toBeCloseTo(10 / 64 / 0.35);
    // Guttering out over the last 0.6s.
    expect(
      buildStageFrame(b, 1, 1448 - 19.2).infernos[0].flames[0].intensity,
    ).toBeCloseTo(0.5);
    expect(old.seed).toBeGreaterThanOrEqual(0);
    expect(old.seed).toBeLessThan(1);
    expect(buildStageFrame(b, 1, 1300).infernos[0].flames[0].seed).toBe(
      old.seed,
    );
    expect(buildStageFrame(b, 1, 1449).infernos).toHaveLength(0);
  });

  it("counts a fire down to its end tick", () => {
    const b = blob({
      infernos: [
        {
          id: 3,
          round: 1,
          thrower: T,
          thrower_team: "ct",
          start_tick: 1000,
          end_tick: 1448,
          fires: [{ x: 0, y: 0, z: 0, s: 1000, e: 1400 }],
        },
      ],
    });
    expect(buildStageFrame(b, 1, 1000).infernos[0].remaining).toBeCloseTo(7);
    expect(buildStageFrame(b, 1, 1384).infernos[0].remaining).toBeCloseTo(1);
  });

  const smokeBlob = (endTick: number, arr = "") =>
    blob({
      grenade_throws: [
        {
          round: 1,
          tick: 900,
          grenade_id: 3,
          thrower_steam_id: T,
          thrower_team: "t",
          type: "Smoke",
          phase: "thrown",
          x: 0,
          y: 0,
          z: 64,
        },
        {
          round: 1,
          tick: 1000,
          grenade_id: 3,
          thrower_steam_id: T,
          thrower_team: "t",
          type: "Smoke",
          phase: "detonated",
          x: 300,
          y: 40,
          z: 0,
        },
      ],
      smoke_voxels: [
        {
          gid: 3,
          round: 1,
          start_tick: 1000,
          end_tick: endTick,
          ox: 0,
          oy: 0,
          oz: 0,
          vs: 20,
          dx: 2,
          dy: 3,
          dz: 4,
          arr,
        },
      ],
    });

  it("decodes Valve's smoke voxels once and hands them to the smoke", () => {
    const bytes = new Uint8Array(2 * 3 * 4).map((_, i) => (i === 5 ? 255 : i));
    const b = smokeBlob(2408, Buffer.from(bytes).toString("base64"));
    const smoke = buildStageFrame(b, 1, 1064).smokes[0];
    expect(smoke).toMatchObject({
      gid: 3,
      team: "t",
      at: { x: 300, y: 40, z: 0 },
      age: 1,
    });
    expect(smoke.remaining).toBeCloseTo(1344 / 64);
    expect(smoke.voxels).toMatchObject({ dx: 2, dy: 3, dz: 4, vs: 20 });
    expect(Array.from(smoke.voxels!.arrival)).toEqual(Array.from(bytes));
    expect(buildStageFrame(b, 1, 1500).smokes[0].voxels).toBe(smoke.voxels);
    expect(buildStageFrame(b, 1, 2409).smokes).toHaveLength(0);
  });

  it("times a smoke the round end cut short by its own life", () => {
    const b = smokeBlob(2000);
    expect(buildStageFrame(b, 1, 1064).smokes[0].remaining).toBeCloseTo(19);
    expect(buildStageFrame(b, 1, 2001).smokes).toHaveLength(0);
  });

  it("gives two smokes popped together a grid each, by where they are", () => {
    const grid = (start: number, x: number) => ({
      gid: null,
      round: 1,
      start_tick: start,
      end_tick: 2000,
      ox: x - 20,
      oy: -20,
      oz: -20,
      vs: 20,
      dx: 2,
      dy: 2,
      dz: 2,
      arr: Buffer.from(new Uint8Array(8).fill(x ? 2 : 1)).toString("base64"),
    });
    const smoke = (tick: number, x: number, phase: "thrown" | "detonated") => ({
      round: 1,
      tick,
      grenade_id: null,
      thrower_steam_id: T,
      thrower_team: "t",
      type: "Smoke",
      phase,
      x,
      y: 0,
      z: 0,
    });
    const b = blob({
      grenade_throws: [
        smoke(900, 0, "thrown"),
        smoke(910, 1000, "thrown"),
        smoke(1000, 0, "detonated"),
        smoke(1020, 1000, "detonated"),
      ],
      smoke_voxels: [grid(1001, 1000), grid(1019, 0)],
    });
    const smokes = buildStageFrame(b, 1, 1100).smokes;
    expect(smokes.map((s) => [s.at.x, s.voxels?.arrival[0]])).toEqual([
      [0, 1],
      [1000, 2],
    ]);
  });

  it("flies a grenade along its recorded path until it goes off", () => {
    const pts = Array.from({ length: 31 }, (_, i) => ({
      t: 900 + i * 2,
      x: i * 10,
      y: 0,
      z: 64,
    }));
    const b = blob({
      grenade_throws: [
        {
          round: 1,
          tick: 900,
          grenade_id: 4,
          thrower_steam_id: CT,
          thrower_team: "ct",
          type: "HE",
          phase: "thrown",
          x: 0,
          y: 0,
          z: 64,
        },
        {
          round: 1,
          tick: 940,
          grenade_id: 4,
          thrower_steam_id: CT,
          thrower_team: "ct",
          type: "HE",
          phase: "detonated",
          x: 200,
          y: 0,
          z: 64,
        },
      ],
      grenade_trajectories: [{ gid: 4, pts }],
    });
    const flying = buildStageFrame(b, 1, 920);
    expect(flying.projectiles[0]).toMatchObject({
      type: "he",
      team: "ct",
      progress: 0.5,
    });
    const path = flying.projectiles[0].path;
    // Evenly spaced in time, cut where it went off.
    expect(path).toHaveLength(21);
    expect(path[10].x).toBeCloseTo(100);
    expect(path[20].x).toBeCloseTo(200);
    const after = buildStageFrame(b, 1, 972);
    expect(after.projectiles).toHaveLength(0);
    expect(after.detonations[0]).toMatchObject({
      type: "he",
      age: 0.5,
      at: { x: 200 },
    });
    expect(after.blasts[0]).toMatchObject({ radius: 250, age: 0.5 });
  });

  it("counts a decoy down from its detonation", () => {
    const decoy = (tick: number, phase: "thrown" | "detonated") => ({
      round: 1,
      tick,
      grenade_id: 9,
      thrower_steam_id: T,
      thrower_team: "t",
      type: "Decoy",
      phase,
      x: 300,
      y: 40,
      z: 0,
    });
    const b = blob({
      grenade_throws: [decoy(900, "thrown"), decoy(960, "detonated")],
    });
    expect(buildStageFrame(b, 1, 960 + 64 * 5).detonations[0]).toMatchObject({
      type: "decoy",
      team: "t",
      age: 5,
      remaining: 10,
      at: { x: 300 },
    });
    expect(buildStageFrame(b, 1, 960 + 64 * 16).detonations).toHaveLength(0);
  });

  it("times plants and defuses on the player, until they stop", () => {
    const b = blob({
      bombs: [
        { tick: 1000, type: "plant_begin", player: T },
        { tick: 1064, type: "plant_abort", player: T },
        { tick: 1200, type: "plant_begin", player: T },
        { tick: 1405, type: "planted", player: T, x: 1, y: 1, z: 0 },
        { tick: 2000, type: "defuse_begin", player: CT, has_kit: true },
        { tick: 2100, type: "defuse_abort", player: CT },
        { tick: 2200, type: "defuse_begin", player: CT },
      ],
    });
    const at = (tick: number, id: string) =>
      buildStageFrame(b, 1, tick).players.find((p) => p.id === id)!.bombAction;
    expect(at(1032, T)).toMatchObject({
      kind: "plant",
      age: 0.5,
      duration: 3.2,
    });
    expect(at(1100, T)).toBeFalsy();
    expect(at(1300, T)?.age).toBeCloseTo(100 / 64);
    expect(at(1500, T)).toBeFalsy();
    expect(at(2032, CT)).toMatchObject({
      kind: "defuse",
      duration: 5,
      kit: true,
    });
    expect(at(2150, CT)).toBeFalsy();
    expect(at(2264, CT)).toMatchObject({ age: 1, duration: 10, kit: false });
  });

  it("gives players their speed and how long they have held their weapon", () => {
    const b = blob({
      positions: [
        position(T, "t", 100, 0, { active_weapon: "knife" }),
        position(T, "t", 132, 125, { active_weapon: "ak47" }),
        position(T, "t", 164, 250, { active_weapon: "ak47" }),
        position(T, "t", 4000, 250, { active_weapon: "ak47" }),
      ],
    });
    const player = buildStageFrame(b, 1, 148).players[0];
    expect(player.speed).toBeCloseTo(250);
    expect(player.weaponAge).toBeCloseTo(16 / 64);
    expect(buildStageFrame(b, 1, 3000).players[0].weaponAge).toBeNull();
  });

  it("keeps the gun up through a quick switch", () => {
    const b = blob({
      positions: [
        position(T, "t", 100, 0, { active_weapon: "ak47" }),
        position(T, "t", 116, 0, { active_weapon: "ak47" }),
        position(T, "t", 132, 0, { active_weapon: "knife" }),
        position(T, "t", 148, 0, { active_weapon: "ak47" }),
        position(T, "t", 4000, 0, { active_weapon: "ak47" }),
      ],
    });
    for (const tick of [136, 152]) {
      const player = buildStageFrame(b, 1, tick).players[0];
      expect(player.weapon).toBe("ak47");
      expect(player.weaponAge).toBeNull();
    }
  });

  it("tracks the bomb from carrier to plant", () => {
    const b = blob({
      positions: [
        position(T, "t", 100, 0, { has_bomb: true }),
        position(T, "t", 4000, 400, { has_bomb: false }),
        position(CT, "ct", 100, 500),
      ],
      bombs: [
        { tick: 64, type: "pickup", player: T },
        {
          tick: 1000,
          type: "planted",
          player: T,
          site: "A",
          x: 90,
          y: 9,
          z: 1,
        },
      ],
    });
    const carried = buildStageFrame(b, 1, 500);
    expect(carried.bomb?.state).toBe("carried");
    expect(carried.players[0].hasBomb).toBe(true);
    const planted = buildStageFrame(b, 1, 1640);
    expect(planted.bomb).toMatchObject({
      state: "planted",
      at: { x: 90, y: 9 },
      age: 10,
      timer: 31,
    });
    expect(planted.players[0].hasBomb).toBe(false);
  });

  it("counts the bomb down to the round's own explosion", () => {
    const b = blob({
      bombs: [
        { tick: 1000, type: "planted", player: T, x: 0, y: 0, z: 0 },
        { tick: 1000 + 64 * 41, type: "exploded" },
      ],
    });
    expect(buildStageFrame(b, 1, 1000 + 64 * 40).bomb?.timer).toBeCloseTo(1);
    expect(buildStageFrame(b, 1, 1000 + 64 * 41).bomb?.state).toBe("exploded");
  });
});

describe("buildStageFrame viewer options", () => {
  const nade = (
    gid: number,
    type: string,
    tick: number,
    phase: "thrown" | "detonated",
    x = 0,
    extra = {},
  ) => ({
    round: 1,
    tick,
    grenade_id: gid,
    thrower_steam_id: T,
    thrower_team: "t",
    type,
    phase,
    x,
    y: 0,
    z: 0,
    ...extra,
  });
  // A smoke, a flash and a molotov thrown together; the flash logged twice.
  const utilityBlob = () =>
    blob({
      grenade_throws: [
        nade(1, "Smoke", 900, "thrown"),
        nade(1, "Smoke", 1000, "detonated", 300),
        nade(2, "Flash", 900, "thrown"),
        nade(2, "Flash", 1000, "detonated", 600),
        { ...nade(2, "Flash", 1000, "detonated", 600), grenade_id: null },
        nade(3, "Molotov", 900, "thrown"),
        nade(3, "Molotov", 1000, "detonated", 900),
        nade(4, "HE", 3000, "thrown"),
        nade(4, "HE", 3040, "detonated", 1200),
      ],
      infernos: [
        {
          id: 77,
          round: 1,
          thrower: T,
          thrower_team: "t",
          start_tick: 1001,
          end_tick: 1400,
          fires: [{ x: 905, y: 0, z: 0, s: 1001, e: 1400 }],
        },
      ],
    });

  it("leaves a filtered type out of flight, bursts, smokes, fires and the heatmap", () => {
    const b = utilityBlob();
    const all = buildStageFrame(b, 1, 1010, { heatmap: true });
    expect(all.smokes).toHaveLength(1);
    expect(all.infernos).toHaveLength(1);
    expect(all.detonations.map((d) => d.type)).toEqual(["flash"]);
    const none = buildStageFrame(b, 1, 1010, {
      heatmap: true,
      utility: { smoke: false, flash: false, molotov: false },
    });
    expect(none.smokes).toHaveLength(0);
    expect(none.infernos).toHaveLength(0);
    expect(none.detonations).toHaveLength(0);
    expect(none.heat!.map((h) => h.type)).toEqual(["he"]);
    expect(
      buildStageFrame(b, 1, 950, { utility: { smoke: false } }).projectiles.map(
        (p) => p.type,
      ),
    ).toEqual(["flash", "molotov"]);
  });

  it("puts every detonation of the round on the heatmap, once each", () => {
    const b = utilityBlob();
    const early = buildStageFrame(b, 1, 100, { heatmap: true }).heat!;
    // The HE has not gone off yet, and the flash logged twice is one disc.
    expect(early.map((h) => [h.gid, h.type, h.at.x])).toEqual([
      [1, "smoke", 300],
      [2, "flash", 600],
      [3, "molotov", 900],
      [4, "he", 1200],
    ]);
    expect(buildStageFrame(b, 1, 101, { heatmap: true }).heat).toBe(early);
    expect(buildStageFrame(b, 1, 1010).heat).toBeUndefined();
    // And the flash bursts once.
    expect(buildStageFrame(b, 1, 1010).detonations).toHaveLength(1);
  });

  it("draws only the picked grenades, with their whole flight", () => {
    const b = utilityBlob();
    const frame = buildStageFrame(b, 1, 1010, {
      heatmap: true,
      selectedGids: [3],
    });
    expect(frame.smokes).toHaveLength(0);
    expect(frame.detonations).toHaveLength(0);
    // The fire matched to the molotov that started it.
    expect(frame.infernos).toHaveLength(1);
    expect(frame.heat!.filter((h) => h.selected).map((h) => h.gid)).toEqual([
      3,
    ]);
    expect(frame.throws).toHaveLength(1);
    expect(frame.throws![0]).toMatchObject({
      gid: 3,
      type: "molotov",
      at: { x: 900 },
    });
    expect(frame.throws![0].path[0]).toMatchObject({ x: 0 });
    // A Set works too, and nothing picked draws everything.
    expect(
      buildStageFrame(b, 1, 1010, { selectedGids: new Set([1]) }).smokes,
    ).toHaveLength(1);
    // Picks from another round leave this one alone.
    const elsewhere = buildStageFrame(b, 1, 1010, { selectedGids: [999] });
    expect(elsewhere.smokes).toHaveLength(1);
    expect(elsewhere.throws).toBeUndefined();
    const free = buildStageFrame(b, 1, 1010, { selectedGids: [] });
    expect(free.throws).toBeUndefined();
    expect(free.infernos).toHaveLength(1);
  });

  it("drops the dead once their death has played when deaths are hidden", () => {
    const b = blob({ kills: [{ tick: 1000, killer: T, victim: CT }] });
    const ids = (tick: number, deaths: boolean) =>
      buildStageFrame(b, 1, tick, { deaths }).players.map((p) => p.id);
    expect(ids(1032, false)).toEqual([T, CT]);
    expect(ids(1100, false)).toEqual([T]);
    expect(ids(1100, true)).toEqual([T, CT]);
  });

  it("walks each player's trail up to their death, on the frame's clock", () => {
    const b = blob({
      positions: [
        position(T, "t", 100, 0),
        position(T, "t", 116, 5),
        position(T, "t", 132, 100),
        position(T, "t", 4000, 900),
        position(CT, "ct", 100, 500),
        position(CT, "ct", 132, 600),
        position(CT, "ct", 164, 700),
      ],
      kills: [{ tick: 150, killer: T, victim: CT, victim_x: 650, victim_y: 0 }],
    });
    const trails = buildStageFrame(b, 1, 200, { trails: true }).trails!;
    expect(trails).toBe(buildStageFrame(b, 1, 300, { trails: true }).trails);
    const strip = (id: string) => {
      const s = trails.strips.find((x) => x.id === id)!;
      return Array.from(
        trails.points.subarray(s.start * 4, (s.start + s.count) * 4),
      );
    };
    // The 5u step is dropped; the 60s gap to the last sample breaks the walk.
    expect(trails.strips.filter((s) => s.id === T)).toHaveLength(1);
    expect(strip(T)).toEqual([0, 0, 3, 36 / 64, 100, 0, 3, 68 / 64]);
    // The CT's walk ends where they fell, when they fell.
    expect(strip(CT).slice(-4)).toEqual([650, 0, 3, 86 / 64]);
    expect(buildStageFrame(b, 1, 200).trails).toBeUndefined();
  });

  it("puts the dropped bomb and kits on the floor until picked up", () => {
    const b = blob({
      positions: [
        position(T, "t", 100, 0, { has_bomb: true }),
        position(T, "t", 4000, 0),
        position(CT, "ct", 100, 500),
        position(CT, "ct", 2000, 500),
        position(CT, "ct", 2100, 820, { has_defuser: true }),
      ],
      bombs: [
        { tick: 64, type: "pickup", player: T },
        { tick: 500, type: "dropped", player: T, x: 40, y: 50, z: 6 },
        { tick: 900, type: "pickup", player: T },
      ],
      kit_drops: [{ tick: 1500, round: 1, player: "x", x: 800, y: 0, z: 0 }],
    });
    expect(buildStageFrame(b, 1, 600).ground).toEqual([
      {
        key: "bomb",
        kind: "bomb",
        at: { x: 40, y: 50, z: 6 },
        age: 1.5625,
        timer: null,
      },
    ]);
    expect(buildStageFrame(b, 1, 600, { groundBomb: false }).ground).toBe(
      undefined,
    );
    expect(buildStageFrame(b, 1, 1000).ground).toBeUndefined();
    expect(buildStageFrame(b, 1, 1564).ground).toMatchObject([
      { kind: "kit", at: { x: 800 }, age: 1 },
    ]);
    expect(buildStageFrame(b, 1, 1564, { groundKits: false }).ground).toBe(
      undefined,
    );
    // The CT who walked onto it and came away with a kit picked it up.
    expect(buildStageFrame(b, 1, 2100).ground).toBeUndefined();
  });

  it("hands slot numbers instead of portraits, and the callouts flag", () => {
    const frame = buildStageFrame(blob(), 1, 500, {
      slots: { [T]: 3 },
      callouts: true,
    });
    expect(frame.players[0]).toMatchObject({ id: T, slot: 3, avatarUrl: null });
    expect(frame.players[1].slot).toBeNull();
    expect(frame.callouts).toBe(true);
    expect(buildStageFrame(blob(), 1, 500).callouts).toBeUndefined();
  });

  it("carries the storey in view for the players to dim the rest", () => {
    const band = { min: -Infinity, max: -500 };
    expect(buildStageFrame(blob(), 1, 500, { levelBand: band }).levelBand).toBe(
      band,
    );
    expect(buildStageFrame(blob(), 1, 500).levelBand).toBeUndefined();
  });
});
