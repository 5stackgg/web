// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { useReplayAnalysis } from "~/composables/useReplayAnalysis";
import type { StageBlob } from "~/utilities/replayStage/frameIndex";

const RATE = 64;

// A v11 blob's second round: CT force buy, T full buy; ct1 flashes two Ts,
// ct2 kills one of them blind, and t2's kill on ct2 is traded by ct3.
function blob(
  withFlashes: boolean,
): Pick<StageBlob, "kills" | "grenade_throws" | "round_inventory" | "flashes"> {
  const ct = (id: string, primary: string | null) => ({
    round: 2,
    steam_id: id,
    team: "ct",
    flash: 1,
    smoke: 0,
    he: 0,
    molotov: 0,
    decoy: 0,
    primary,
    secondary: "USP-S",
    armor: 100,
    helmet: false,
    kit: false,
  });
  const t = (id: string) => ({
    round: 2,
    steam_id: id,
    team: "t",
    flash: 1,
    smoke: 1,
    he: 1,
    molotov: 1,
    decoy: 0,
    primary: "AK-47",
    secondary: "Glock-18",
    armor: 100,
    helmet: true,
    kit: false,
  });
  return {
    kills: [
      {
        tick: 1200,
        killer: "ct2",
        victim: "t1",
        killer_team: "ct",
        victim_team: "t",
        assist: "ct1",
        assist_flash: true,
      },
      {
        tick: 1300,
        killer: "t2",
        victim: "ct2",
        killer_team: "t",
        victim_team: "ct",
      },
      {
        tick: 1400,
        killer: "ct3",
        victim: "t2",
        killer_team: "ct",
        victim_team: "t",
      },
    ],
    grenade_throws: [
      {
        round: 2,
        tick: 1000,
        grenade_id: 9,
        thrower_steam_id: "ct1",
        type: "Flash",
        phase: "thrown",
      },
      {
        round: 2,
        tick: 1100,
        grenade_id: 9,
        thrower_steam_id: "ct1",
        type: "Flash",
        phase: "detonated",
      },
    ],
    round_inventory: [
      ...["ct1", "ct2", "ct3", "ct4", "ct5"].map((id) => ct(id, "MP9")),
      ...["t1", "t2", "t3", "t4", "t5"].map(t),
    ],
    flashes: withFlashes
      ? [
          {
            round: 2,
            tick: 1100,
            attacker_steam_id: "ct1",
            attacked_steam_id: "t1",
            duration: 2.5,
            team_flash: false,
          },
          {
            round: 2,
            tick: 1100,
            attacker_steam_id: "ct1",
            attacked_steam_id: "t2",
            duration: 1.5,
            team_flash: false,
          },
          {
            round: 2,
            tick: 1100,
            attacker_steam_id: "ct1",
            attacked_steam_id: "ct2",
            duration: 2,
            team_flash: true,
          },
        ]
      : undefined,
  };
}

function setup(b: ReturnType<typeof blob>, cursorAt = 1500) {
  const cursor = ref(cursorAt);
  const sides = new Map<string, "ct" | "t">();
  for (const r of b.round_inventory ?? [])
    sides.set(r.steam_id!, r.team as "ct" | "t");
  const a = useReplayAnalysis({
    round: () => 2,
    kills: () => b.kills,
    grenades: () => b.grenade_throws,
    flashes: () => b.flashes,
    inventory: () => b.round_inventory,
    economy: () => [
      {
        round: 1,
        lineup_1_money: 9000,
        lineup_2_money: 18000,
        lineup_1_side: "CT",
        lineup_2_side: "TERRORIST",
      },
      {
        round: 2,
        lineup_1_money: 0,
        lineup_2_money: 0,
        lineup_1_side: "CT",
        lineup_2_side: "TERRORIST",
      },
    ],
    sideByRound: () =>
      new Map([
        [1, sides],
        [2, sides],
      ]),
    cursor: () => cursor.value,
    tickRate: () => RATE,
    name: (sid) => sid.toUpperCase(),
  });
  return { a, cursor };
}

describe("useReplayAnalysis on a synthetic blob", () => {
  it("prices each side's buy and names the round type", () => {
    const { a } = setup(blob(true));
    expect(a.summary.value.buy.ct).toEqual({
      type: "force",
      value: 5 * (1250 + 200 + 650 + 200),
      start: 9000,
    });
    expect(a.summary.value.buy.t?.type).toBe("full");
    expect(a.playerValue("t1")).toBe(2700 + 200 + 1000 + 200 + 300 + 300 + 400);
  });

  it("pairs the trade and counts it in the summary", () => {
    const b = blob(true);
    const { a } = setup(b);
    expect(a.killTrade(b.kills[1])).toEqual({
      state: "traded",
      by: "CT3",
      sec: "1.6",
      avenges: ["T1"],
      pairs: ["2-1", "2-0"],
    });
    expect(a.killTrade(b.kills[2])).toEqual({
      state: "open",
      avenges: ["CT2"],
      pairs: ["2-1"],
    });
    expect(a.summary.value.trades.ct).toEqual({ deaths: 1, traded: 1 });
    expect(a.summary.value.trades.t).toEqual({ deaths: 2, traded: 1 });
  });

  it("reports the flash on its grenade once it has popped, with the assist", () => {
    const b = blob(true);
    const { a, cursor } = setup(b, 1050);
    expect(a.flashNote(9)).toBeUndefined();
    cursor.value = 1500;
    expect(a.flashNote(9)).toEqual({ enemies: 2, sec: "4.0", teammates: 1 });
    expect(a.summary.value.flashes.blinds).toBe(true);
    expect(a.summary.value.flashes.ct).toMatchObject({
      thrown: 1,
      enemies: 2,
      teammates: 1,
      assists: 1,
    });
    expect(a.summary.value.flashes.players[0]).toMatchObject({
      sid: "ct1",
      name: "CT1",
      assists: 1,
    });
  });

  it("keeps only the game's flash assists on a blob without blinds", () => {
    const { a } = setup(blob(false));
    expect(a.flashNote(9)).toBeUndefined();
    expect(a.summary.value.flashes.blinds).toBe(false);
    expect(a.summary.value.flashes.ct).toMatchObject({
      thrown: 0,
      enemies: 0,
      assists: 1,
    });
    expect(a.summary.value.flashes.players).toMatchObject([
      { sid: "ct1", name: "CT1", assists: 1 },
    ]);
  });
});
