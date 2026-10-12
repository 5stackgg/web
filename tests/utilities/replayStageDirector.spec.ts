// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CONDENSE_SPEED,
  MIN_DWELL,
  SLOW_SPEED,
  roundPlan,
  shotAt,
  speedAt,
} from "~/utilities/replayStage/director";
import type {
  DamageRow,
  KillRow,
  ShotRow,
  StageBlob,
} from "~/utilities/replayStage/frameIndex";

const RATE = 64;
const FREEZE_END = 2 * RATE;
const END = 100 * RATE;
/** Seconds into the round → tick. */
const at = (secs: number) => FREEZE_END + secs * RATE;

type Spot = { id: string; team: "t" | "ct"; x: number; y: number };

/** Three a side; t1/c1 and t2/c2 face off 800u apart, far from the rest. */
const SPOTS: Spot[] = [
  { id: "t1", team: "t", x: 0, y: 0 },
  { id: "c1", team: "ct", x: 800, y: 0 },
  { id: "t2", team: "t", x: 8000, y: 8000 },
  { id: "c2", team: "ct", x: 8800, y: 8000 },
  { id: "t3", team: "t", x: -8000, y: 8000 },
  { id: "c3", team: "ct", x: -8000, y: 12000 },
];

function spot(id: string) {
  return SPOTS.find((s) => s.id === id)!;
}

function positions(weapons: Record<string, string>) {
  const rows = [];
  for (const s of SPOTS) {
    for (let tick = 0; tick <= END + RATE; tick += RATE / 4) {
      rows.push({
        round: 1,
        tick,
        attacker_steam_id: s.id,
        attacker_team: s.team,
        alive: true,
        x: s.x,
        y: s.y,
        z: 0,
        yaw: s.team === "t" ? 0 : 180,
        pitch: 0,
        health: 100,
        armor: 100,
        helmet: true,
        active_weapon: weapons[s.id] ?? "ak47",
      });
    }
  }
  return rows;
}

/** `shooter` fires at `victim` at `secs`, hitting for `dmg` (0 = a miss). */
function exchange(
  shooter: string,
  victim: string,
  secs: number,
  dmg: number,
  weapon = "ak47",
) {
  const a = spot(shooter);
  const b = spot(victim);
  const tick = at(secs);
  const shot: ShotRow = {
    round: 1,
    tick,
    attacker_steam_id: a.id,
    attacker_team: a.team,
    with: weapon,
    eye_x: a.x,
    eye_y: a.y,
    eye_z: 64,
    result: dmg ? "hit" : null,
    impact_x: dmg ? b.x : null,
    impact_y: dmg ? b.y : null,
    impact_z: dmg ? 40 : null,
    miss_x: dmg ? null : b.x,
    miss_y: dmg ? null : b.y + 200,
    miss_z: dmg ? null : 64,
  };
  const damage: DamageRow | null = dmg
    ? {
        round: 1,
        time: String(tick),
        attacker_steam_id: a.id,
        attacked_steam_id: b.id,
        damage: dmg,
        health: Math.max(0, 100 - dmg),
        weapon,
      }
    : null;
  return { shot, damage };
}

function kill(
  killer: string,
  victim: string,
  secs: number,
  weapon = "ak47",
): KillRow {
  const v = spot(victim);
  return {
    tick: at(secs),
    killer,
    victim,
    killer_team: spot(killer).team,
    victim_team: v.team,
    weapon,
    headshot: false,
    victim_x: v.x,
    victim_y: v.y,
    victim_z: 0,
  };
}

function blob(
  fights: Array<ReturnType<typeof exchange>>,
  kills: KillRow[],
  weapons: Record<string, string> = {},
): StageBlob {
  return {
    schema_version: 11,
    match_map_id: "m",
    tick_rate: RATE,
    total_ticks: END,
    map_name: "de_mirage",
    round_ticks: [
      { round: 1, start_tick: 0, freeze_end_tick: FREEZE_END, end_tick: END },
    ],
    players: SPOTS.map((s) => ({ steam_id: s.id, name: s.id })),
    kills,
    bombs: [],
    positions: positions(weapons),
    shots_fired: fights.map((f) => f.shot),
    damages: fights.flatMap((f) => (f.damage ? [f.damage] : [])),
    grenade_throws: [],
  } as unknown as StageBlob;
}

/** c1 picks t1 with an AWP at 41s after a short exchange. */
function awpDuel() {
  return blob(
    [
      exchange("t1", "c1", 40, 0),
      exchange("c1", "t1", 40.3, 0, "awp"),
      exchange("t1", "c1", 40.6, 24),
      exchange("c1", "t1", 41, 100, "awp"),
    ],
    [kill("c1", "t1", 41, "awp")],
    { c1: "awp" },
  );
}

describe("roundPlan", () => {
  it("covers the round with back-to-back shots held at least MIN_DWELL", () => {
    const plan = roundPlan(awpDuel(), 1)!;
    expect(plan.shots[0].fromTick).toBe(FREEZE_END);
    expect(plan.shots.at(-1)!.toTick).toBe(END);
    plan.shots.forEach((shot, i) => {
      if (i > 0) {
        expect(shot.fromTick).toBe(plan.shots[i - 1].toTick);
      }
      expect(shot.toTick - shot.fromTick).toBeGreaterThanOrEqual(
        MIN_DWELL * RATE,
      );
    });
    // Built once per round.
    const same = awpDuel();
    expect(roundPlan(same, 1)).toBe(roundPlan(same, 1));
  });

  it("is on the duel before its first shot", () => {
    const plan = roundPlan(awpDuel(), 1)!;
    const before = shotAt(plan, at(40) - 1.2 * RATE);
    expect(before.kind).toBe("duel");
    expect([...before.subjects].sort()).toEqual(["c1", "t1"]);
    expect(before.protagonist).toBe("c1");
    expect(before.weapon).toBe("awp");
    // Side-on to the pair.
    expect(before.look?.either).toBe(true);
    expect(shotAt(plan, at(41.5))).toBe(before);
  });

  it("slows down before the AWP shot, holds through it and eases back", () => {
    const plan = roundPlan(awpDuel(), 1)!;
    const key = at(41);
    expect(speedAt(plan, key - 0.6 * RATE)).toBe(1);
    const easing = speedAt(plan, key - 0.35 * RATE);
    expect(easing).toBeLessThan(1);
    expect(easing).toBeGreaterThan(SLOW_SPEED);
    expect(speedAt(plan, key)).toBeCloseTo(SLOW_SPEED);
    expect(speedAt(plan, key + 0.4 * RATE)).toBeCloseTo(SLOW_SPEED);
    expect(speedAt(plan, key + 1 * RATE)).toBe(1);
    expect(speedAt(plan, key, { slowmo: false })).toBe(1);
    // It never jumps: tick to tick the speed moves a little at a time.
    let biggest = 0;
    for (let tick = key - RATE; tick < key + RATE; tick++) {
      biggest = Math.max(
        biggest,
        Math.abs(speedAt(plan, tick + 1) - speedAt(plan, tick)),
      );
    }
    expect(biggest).toBeLessThan(0.06);
  });

  it("hurries through dead time only when condensed is on", () => {
    const plan = roundPlan(awpDuel(), 1)!;
    expect(speedAt(plan, at(20))).toBe(1);
    expect(speedAt(plan, at(20), { condensed: true })).toBe(CONDENSE_SPEED);
    // Back to normal speed before the duel's lead-in.
    expect(speedAt(plan, at(40) - 2.5 * RATE, { condensed: true })).toBe(1);
  });

  it("shows the better of two fights at once and offers the other as a replay", () => {
    const plan = roundPlan(
      blob(
        [
          exchange("t1", "c1", 40, 0),
          exchange("c1", "t1", 41, 100, "awp"),
          // Meanwhile across the map, t2 wins a fight of its own.
          exchange("t2", "c2", 40.2, 30),
          exchange("t2", "c2", 40.8, 100),
        ],
        [kill("t2", "c2", 40.8), kill("c1", "t1", 41, "awp")],
        { c1: "awp" },
      ),
      1,
    )!;
    expect(shotAt(plan, at(40.8)).subjects).toContain("c1");
    expect(shotAt(plan, at(41)).subjects).toContain("c1");
    const replay = plan.replays.find((r) => r.shot.subjects.includes("t2"));
    expect(replay?.reason).toBe("missed");
    expect(replay!.fromTick).toBeLessThan(at(40.2));
    expect(replay!.untilTick).toBeGreaterThan(at(40.8));
    // Offered once the action has settled, after both.
    expect(replay!.offerTick).toBeGreaterThan(at(41));
  });
});
