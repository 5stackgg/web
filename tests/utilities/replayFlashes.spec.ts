// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { FlashRow } from "~/utilities/replayStage/frameIndex";
import {
  flashAssists,
  flashAssistsFromKills,
  flashTallies,
  groupFlashes,
  type FlashGrenade,
} from "~/utilities/replayAnalysis/flashes";

const RATE = 64;
const blind = (
  tick: number,
  attacker: string,
  victim: string,
  duration: number,
  team_flash = attacker[0] === victim[0],
): FlashRow => ({
  round: 1,
  tick,
  attacker_steam_id: attacker,
  attacked_steam_id: victim,
  duration,
  team_flash,
});
const nade = (
  tick: number,
  gid: number,
  thrower: string,
  phase: "thrown" | "detonated",
): FlashGrenade => ({
  tick,
  grenade_id: gid,
  thrower_steam_id: thrower,
  type: "Flash",
  phase,
});

describe("groupFlashes", () => {
  it("collects one flashbang's blinds and ties them to its grenade", () => {
    const bursts = groupFlashes(
      [
        blind(1100, "ct1", "t1", 3.2),
        blind(1100, "ct1", "t2", 1.8),
        blind(1101, "ct1", "ct2", 2.1),
      ],
      [nade(1000, 7, "ct1", "thrown"), nade(1100, 7, "ct1", "detonated")],
      RATE,
    );
    expect(bursts).toHaveLength(1);
    expect(bursts[0]).toMatchObject({
      attacker: "ct1",
      gid: 7,
      enemies: 2,
      teammates: 1,
    });
    expect(bursts[0].enemySec).toBeCloseTo(5.0);
  });

  it("skips blinds of a second or less, as the match stats do", () => {
    const [b] = groupFlashes(
      [blind(1100, "ct1", "t1", 0.6), blind(1100, "ct1", "t2", 1.5)],
      [nade(1100, 7, "ct1", "detonated")],
      RATE,
    );
    expect(b.enemies).toBe(1);
    expect(b.enemySec).toBeCloseTo(1.5);
  });

  it("keeps a flash that blinded no one", () => {
    const bursts = groupFlashes([], [nade(900, 3, "t1", "detonated")], RATE);
    expect(bursts).toEqual([
      {
        attacker: "t1",
        tick: 900,
        gid: 3,
        enemies: 0,
        enemySec: 0,
        teammates: 0,
      },
    ]);
  });

  it("splits two flashes from one player and falls back to the throw", () => {
    const bursts = groupFlashes(
      [blind(1100, "ct1", "t1", 2), blind(1400, "ct1", "t2", 2)],
      [
        nade(1000, 1, "ct1", "thrown"),
        nade(1100, 1, "ct1", "detonated"),
        nade(1300, 2, "ct1", "thrown"),
      ],
      RATE,
    );
    expect(bursts.map((b) => b.gid)).toEqual([1, 2]);
  });
});

describe("flashAssists", () => {
  const kills = [
    {
      tick: 1200,
      killer: "ct2",
      victim: "t1",
      killer_team: "ct",
      victim_team: "t",
    },
    {
      tick: 1200,
      killer: "ct1",
      victim: "t2",
      killer_team: "ct",
      victim_team: "t",
    },
    {
      tick: 2000,
      killer: "ct2",
      victim: "t3",
      killer_team: "ct",
      victim_team: "t",
    },
  ];
  const rows = [
    blind(1100, "ct1", "t1", 3),
    blind(1100, "ct1", "t2", 3),
    blind(1900, "ct1", "t3", 1),
  ];

  it("credits the flasher when a teammate kills the blind enemy", () => {
    expect(flashAssists(kills, rows, RATE)).toEqual(["ct1", null, null]);
  });

  it("gives no assist for flashing your own kill or after the blind wore off", () => {
    const [, own, late] = flashAssists(kills, rows, RATE);
    expect(own).toBeNull();
    expect(late).toBeNull();
  });
});

describe("flashAssistsFromKills", () => {
  it("takes the game's flag, never for the killer or a team kill", () => {
    const k = (
      killer: string,
      victim: string,
      assist: string,
      flag: boolean,
      vt = "t",
    ) => ({
      tick: 1,
      killer,
      victim,
      killer_team: "ct",
      victim_team: vt,
      assist,
      assist_flash: flag,
    });
    expect(
      flashAssistsFromKills([
        k("ct2", "t1", "ct1", true),
        k("ct2", "t2", "ct1", false),
        k("ct2", "t3", "ct2", true),
        k("ct2", "ct3", "ct1", true, "ct"),
      ]),
    ).toEqual(["ct1", null, null, null]);
  });
});

describe("flashTallies", () => {
  it("adds up each side and thrower up to the cursor", () => {
    const bursts = [
      {
        attacker: "ct1",
        tick: 1100,
        gid: 1,
        enemies: 2,
        enemySec: 5,
        teammates: 1,
      },
      {
        attacker: "t1",
        tick: 1500,
        gid: 2,
        enemies: 1,
        enemySec: 2,
        teammates: 0,
      },
      {
        attacker: "ct1",
        tick: 3000,
        gid: 3,
        enemies: 3,
        enemySec: 6,
        teammates: 0,
      },
    ];
    const kills = [
      {
        tick: 1200,
        killer: "ct2",
        victim: "t1",
        killer_team: "ct",
        victim_team: "t",
      },
    ];
    const sides: Record<string, "ct" | "t"> = { ct1: "ct", ct2: "ct", t1: "t" };
    const out = flashTallies(
      bursts,
      kills,
      ["ct1"],
      2000,
      (id) => sides[id] ?? null,
    );
    expect(out.ct).toEqual({
      thrown: 1,
      enemies: 2,
      enemySec: 5,
      teammates: 1,
      assists: 1,
    });
    expect(out.t).toEqual({
      thrown: 1,
      enemies: 1,
      enemySec: 2,
      teammates: 0,
      assists: 0,
    });
    expect(out.players.map((p) => p.sid)).toEqual(["ct1", "t1"]);
  });
});
