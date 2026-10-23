import { e_sides_enum, e_winning_reasons_enum } from "~/generated/zeus";
import { classifyBuyType, START_MONEY } from "~/utilities/buyType";
import {
  DEMO_LINEUP_IDS,
  DEMO_PLAYER_NAMES,
  type DemoMatch,
} from "~/utilities/demoMatch";
import { DEMO_PLAYERS } from "~/utilities/landing/demoStats";

// The welcome page's finished demo match with every stat its tabs read. One
// seeded kill feed is played out over the demo's own rounds (who won each and
// how), and everything is counted from it the way the api's views count it:
// scoreboard lines, economy, buy types, opening duels, clutches, trades, head
// to head, roles and utility. Nothing here exists on the api.

type Slot = 1 | 2;
type Side = "t" | "ct";
type Buy = "pistol" | "eco" | "force" | "full";
type Gear = "pistols" | "light" | "rifles";
type Nade = "flashbang" | "smokegrenade" | "hegrenade" | "molotov";

type Profile = {
  skill: number;
  entry: number;
  awp: number;
  hs: number;
  aim: number;
  util: number;
  // flash, smoke, he, molotov
  nades: [number, number, number, number];
};

const PROFILES: Record<string, Profile> = {
  vexa: { skill: 1.25, entry: 2.2, awp: 0, hs: 0.5, aim: 0.22, util: 0.9, nades: [5, 1, 2, 2] },
  Moritz: { skill: 1.15, entry: 0.7, awp: 0.8, hs: 0.22, aim: 0.2, util: 0.7, nades: [3, 3, 1, 2] },
  kuro: { skill: 1.35, entry: 1.1, awp: 0, hs: 0.52, aim: 0.24, util: 0.9, nades: [3, 2, 3, 2] },
  deadlock: { skill: 0.85, entry: 0.6, awp: 0, hs: 0.42, aim: 0.18, util: 1.35, nades: [5, 4, 1, 3] },
  Pip: { skill: 0.95, entry: 0.8, awp: 0, hs: 0.48, aim: 0.19, util: 1, nades: [3, 2, 3, 3] },
  Saffron: { skill: 1.3, entry: 0.7, awp: 0.8, hs: 0.24, aim: 0.21, util: 0.7, nades: [3, 3, 1, 2] },
  tomek: { skill: 0.8, entry: 0.6, awp: 0, hs: 0.42, aim: 0.17, util: 1.35, nades: [5, 4, 1, 3] },
  Juno: { skill: 1, entry: 2.2, awp: 0, hs: 0.5, aim: 0.19, util: 0.9, nades: [5, 1, 2, 2] },
  brisk: { skill: 1.15, entry: 1, awp: 0, hs: 0.55, aim: 0.21, util: 0.9, nades: [3, 2, 3, 2] },
  OLLIE: { skill: 0.9, entry: 0.8, awp: 0, hs: 0.46, aim: 0.18, util: 1, nades: [3, 2, 3, 3] },
};

const MR = 12;
const SNIPERS = new Set(["awp", "ssg08"]);
const PISTOLS = new Set(["glock", "usp_silencer", "p250", "tec9", "fiveseven", "deagle"]);
const NADES: Nade[] = ["flashbang", "smokegrenade", "hegrenade", "molotov"];
const MULTI = ["two_kill_rounds", "three_kill_rounds", "four_kill_rounds", "five_kill_rounds"] as const;
const REPORT_TYPES: Record<Nade, string> = {
  flashbang: "Flash",
  smokegrenade: "Smoke",
  hegrenade: "HighExplosive",
  molotov: "Molotov",
};

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sideOf = (side: string): Side => (side === e_sides_enum.CT ? "ct" : "t");
const other = (slot: Slot): Slot => (slot === 1 ? 2 : 1);

function matchup(own: Buy, enemy: Buy) {
  if (own === "pistol" && enemy === "pistol") return "pistol_v_pistol";
  if (own === "full") {
    return enemy === "full" ? "full_v_full" : enemy === "eco" ? "full_v_eco" : enemy === "force" ? "full_v_force" : null;
  }
  if (enemy === "full") {
    return own === "eco" ? "eco_v_full" : own === "force" ? "force_v_full" : null;
  }
  return null;
}

function blank() {
  return {
    kills: 0, deaths: 0, assists: 0, flash_assists: 0, hs_kills: 0,
    knife_kills: 0, zeus_kills: 0, damage: 0, team_damage: 0,
    he_damage: 0, molotov_damage: 0, he_team_damage: 0,
    flashes_thrown: 0, enemies_flashed: 0, team_flashed: 0, flash_time: 0,
    smoke_throws: 0, he_throws: 0, molotov_throws: 0, decoy_throws: 0,
    two_kill_rounds: 0, three_kill_rounds: 0, four_kill_rounds: 0, five_kill_rounds: 0,
    trade_kill_opportunities: 0, trade_kill_attempts: 0, trade_kill_successes: 0,
    traded_death_opportunities: 0, traded_death_attempts: 0, traded_death_successes: 0,
    kills_t: 0, kills_ct: 0, hs_kills_t: 0, hs_kills_ct: 0, deaths_t: 0, deaths_ct: 0,
    damage_t: 0, damage_ct: 0, assists_t: 0, assists_ct: 0, rounds_t: 0, rounds_ct: 0,
    rounds_played: 0, unused_sum: 0, unused_count: 0,
    sniper_kills: 0, pistol_kills: 0,
  };
}

type Line = ReturnType<typeof blank>;

type Kill = {
  time: number;
  killer: string;
  victim: string;
  killerSlot: Slot;
  weapon: string;
  hs: boolean;
  assister: string | null;
  assist: number;
  mates: string[];
};

export function demoMatchStats(match: DemoMatch) {
  const random = rng(5150);
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const chance = (p: number) => random() < p;
  function pick<T>(items: T[], weight: (item: T) => number = () => 1): T {
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    let roll = random() * total;
    for (const item of items) {
      roll -= weight(item);
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  const lineupIds: Record<Slot, string> = DEMO_LINEUP_IDS;
  const roster: Record<Slot, string[]> = {
    1: DEMO_PLAYER_NAMES[1].map((_, i) => `demo-1-${i}`),
    2: DEMO_PLAYER_NAMES[2].map((_, i) => `demo-2-${i}`),
  };
  const nameOf: Record<string, string> = {};
  const slotOf: Record<string, Slot> = {};
  for (const slot of [1, 2] as const) {
    roster[slot].forEach((id, i) => {
      nameOf[id] = DEMO_PLAYER_NAMES[slot][i];
      slotOf[id] = slot;
    });
  }
  const profile = (id: string) => PROFILES[nameOf[id]];

  const lines: Record<string, Line> = Object.fromEntries(
    Object.keys(nameOf).map((id) => [id, blank()]),
  );
  type MapLine = { rounds: number; kast: number; kills: number; awp: number; openings: number; support: number };
  const perMap: Record<string, Record<string, MapLine>> = {};

  const rows = <T>() => new Map<string, T>();
  const lineupMap = rows<any>();
  const lineupBuys = rows<any>();
  const playerBuys = rows<any>();
  const openings = rows<any>();
  const killPairs = rows<any>();
  const pairs = rows<any>();
  const clutches: any[] = [];
  const grenades: any[] = [];
  const reportRows = rows<Record<Nade, { throws: number; landed: number }>>();

  function row<T>(table: Map<string, T>, key: string, make: () => T): T {
    let found = table.get(key);
    if (!found) {
      found = make();
      table.set(key, found);
    }
    return found;
  }
  const pair = (attacker: string, attacked: string) =>
    row(pairs, `${attacker}|${attacked}`, () => ({
      attacker_steam_id: attacker,
      attacked_steam_id: attacked,
      kills: 0,
      headshot_kills: 0,
      damage_dealt: 0,
      hits: 0,
      flash_count: 0,
    }));

  function weaponFor(id: string, side: Side, gear: Gear) {
    const p = profile(id);
    if (gear === "pistols") {
      return side === "t"
        ? pick(["glock", "glock", "glock", "tec9", "deagle", "p250"])
        : pick(["usp_silencer", "usp_silencer", "usp_silencer", "fiveseven", "deagle", "p250"]);
    }
    if (gear === "light") {
      if (p.awp && chance(0.35)) return "ssg08";
      return side === "t"
        ? pick(["galilar", "galilar", "mac10", "ak47", "deagle"])
        : pick(["famas", "famas", "mp9", "m4a1_silencer", "deagle"]);
    }
    if (chance(p.awp)) return "awp";
    if (chance(0.05)) return "deagle";
    return side === "t"
      ? chance(0.9)
        ? "ak47"
        : "sg556"
      : pick(["m4a1_silencer", "m4a1_silencer", "m4a1", "aug"]);
  }

  const killReward = (weapon: string) =>
    weapon === "awp" ? 100 : weapon === "mp9" || weapon === "mac10" ? 600 : 300;

  function deathsFor(reason: string) {
    const R = e_winning_reasons_enum;
    switch (reason) {
      case R.BombExploded:
        return { loser: pick([1, 2, 3, 4], (n) => [10, 25, 35, 30][n - 1]), winner: pick([0, 1, 2, 3, 4], (n) => [12, 28, 30, 20, 10][n]) };
      case R.BombDefused:
        return { loser: pick([3, 4, 5], (n) => [20, 35, 45][n - 3]), winner: pick([0, 1, 2, 3, 4], (n) => [10, 28, 32, 20, 10][n]) };
      case R.TimeRanOut:
        return { loser: pick([1, 2, 3, 4], (n) => [20, 35, 30, 15][n - 1]), winner: pick([0, 1, 2, 3], (n) => [30, 35, 25, 10][n]) };
      default:
        return { loser: 5, winner: pick([0, 1, 2, 3, 4], (n) => [10, 26, 30, 22, 12][n]) };
    }
  }

  const moneyByMap: Record<string, Map<number, Record<Slot, number>>> = {};
  let grenadeId = 0;

  for (const matchMap of match.match_maps) {
    const mapId = matchMap.id;
    const mapLines: Record<string, MapLine> = (perMap[mapId] = {});
    for (const id of Object.keys(nameOf)) {
      mapLines[id] = { rounds: 0, kast: 0, kills: 0, awp: 0, openings: 0, support: 0 };
    }
    const money: Record<Slot, number> = { 1: 0, 2: 0 };
    const streak: Record<Slot, number> = { 1: 0, 2: 0 };
    const fallen: Record<Slot, number> = { 1: 5, 2: 5 };
    const ends = (moneyByMap[mapId] = new Map());

    for (const round of [...matchMap.rounds].sort((a, b) => a.round - b.round)) {
      const sides: Record<Slot, Side> = {
        1: sideOf(round.lineup_1_side),
        2: sideOf(round.lineup_2_side),
      };
      const winner: Slot = sideOf(round.winning_side ?? "") === sides[1] ? 1 : 2;
      const loser = other(winner);
      const pistol = round.round === 1 || round.round === MR + 1;
      if (pistol) {
        money[1] = money[2] = START_MONEY * 5;
        streak[1] = streak[2] = 0;
      }
      const start = { ...money };
      const buy = (slot: Slot): Buy =>
        pistol ? "pistol" : (classifyBuyType(start[slot]) as Buy);
      const gear = (slot: Slot): Gear =>
        buy(slot) === "full"
          ? "rifles"
          : buy(slot) === "force" && !(streak[slot] >= 2 && start[slot] < 13000)
            ? "light"
            : "pistols";

      // The kill feed.
      const alive: Record<Slot, string[]> = { 1: [...roster[1]], 2: [...roster[2]] };
      const counts = deathsFor(round.winning_reason ?? "");
      const total: Record<Slot, number> = { [winner]: counts.winner, [loser]: counts.loser } as Record<Slot, number>;
      const left = { ...total };
      const kills: Kill[] = [];
      let time = int(14, 48);
      while (left[1] + left[2] > 0) {
        const first = kills.length === 0;
        const prev = kills[kills.length - 1];
        let victimSlot: Slot;
        if (!left[loser]) victimSlot = winner;
        else if (!left[winner]) victimSlot = loser;
        else if (total[loser] === 5 && left[loser] === 1) victimSlot = winner;
        else if (first) victimSlot = chance(0.68) ? loser : winner;
        else if (total[winner] === 4) victimSlot = chance(0.7) ? winner : loser;
        else victimSlot = chance(left[loser] / (left[loser] + left[winner])) ? loser : winner;
        const killerSlot = other(victimSlot);
        const trade = !!prev && prev.killerSlot === victimSlot && alive[victimSlot].includes(prev.killer) && chance(0.55);
        const victim = trade
          ? prev.killer
          : pick(alive[victimSlot], (id) => (first ? profile(id).entry : 1) / profile(id).skill);
        const killer = pick(alive[killerSlot], (id) => profile(id).skill * (first ? profile(id).entry : 1));
        if (!first) time += trade ? int(1, 4) : int(4, 22);
        const weapon = weaponFor(killer, sides[killerSlot], gear(killerSlot));
        const mates = alive[killerSlot].filter((id) => id !== killer);
        const assister = mates.length && chance(0.3) ? pick(mates) : null;
        alive[victimSlot] = alive[victimSlot].filter((id) => id !== victim);
        left[victimSlot]--;
        kills.push({
          time,
          killer,
          victim,
          killerSlot,
          weapon,
          hs: chance(SNIPERS.has(weapon) ? 0.1 : profile(killer).hs),
          assister,
          assist: assister ? int(25, 70) : 0,
          mates: [...alive[victimSlot]],
        });
        if (mates.length && chance(0.08)) {
          const flasher = pick(mates, (id) => profile(id).nades[0]);
          lines[flasher].flash_assists++;
          mapLines[flasher].support++;
        }
      }

      const tradedAt = (index: number) => {
        const k = kills[index];
        return kills.some((later, j) => j > index && later.victim === k.killer && later.time - k.time <= 5);
      };

      // Per player, per round.
      const roundKills: Record<string, number> = {};
      const touched = new Set<string>();
      const traded = new Set<string>();
      kills.forEach((k, index) => {
        const killerSide = sides[slotOf[k.killer]];
        const victimSide = sides[slotOf[k.victim]];
        const kl = lines[k.killer];
        const vl = lines[k.victim];
        const dealt = 100 - k.assist;
        roundKills[k.killer] = (roundKills[k.killer] ?? 0) + 1;
        touched.add(k.killer);
        kl.kills++;
        kl[`kills_${killerSide}` as const]++;
        kl.damage += dealt;
        kl[`damage_${killerSide}` as const] += dealt;
        if (k.hs) {
          kl.hs_kills++;
          kl[`hs_kills_${killerSide}` as const]++;
        }
        if (SNIPERS.has(k.weapon)) kl.sniper_kills++;
        if (PISTOLS.has(k.weapon)) kl.pistol_kills++;
        if (k.weapon === "awp") mapLines[k.killer].awp++;
        mapLines[k.killer].kills++;
        vl.deaths++;
        vl[`deaths_${victimSide}` as const]++;
        if (k.assister) {
          const al = lines[k.assister];
          touched.add(k.assister);
          al.assists++;
          al[`assists_${killerSide}` as const]++;
          al.damage += k.assist;
          al[`damage_${killerSide}` as const] += k.assist;
          const ap = pair(k.assister, k.victim);
          ap.damage_dealt += k.assist;
          ap.hits += 1;
        }
        const p = pair(k.killer, k.victim);
        p.kills++;
        p.headshot_kills += k.hs ? 1 : 0;
        p.damage_dealt += dealt;
        p.hits += SNIPERS.has(k.weapon) ? 1 : PISTOLS.has(k.weapon) ? int(2, 3) : int(2, 4);
        row(killPairs, `${mapId}|${k.killer}|${k.victim}|${k.weapon}|${killerSide}`, () => ({
          match_map_id: mapId,
          killer_steam_id: k.killer,
          victim_steam_id: k.victim,
          weapon: k.weapon,
          killer_side: killerSide,
          victim_side: victimSide,
          kills: 0,
        })).kills++;

        // Trades: the dead player's nearest teammates could answer it.
        const wasTraded = tradedAt(index);
        const trader = wasTraded
          ? kills.find((later) => later.victim === k.killer && later.time > k.time)!.killer
          : null;
        const chosen = k.mates.filter((id) => id === trader || chance(0.45)).slice(0, 2);
        if (trader && !chosen.includes(trader)) chosen.push(trader);
        let attempted = false;
        for (const id of chosen) {
          lines[id].trade_kill_opportunities++;
          if (id === trader || chance(0.6)) {
            lines[id].trade_kill_attempts++;
            attempted = true;
          }
          if (id === trader) lines[id].trade_kill_successes++;
        }
        if (chosen.length) {
          vl.traded_death_opportunities++;
          if (attempted) vl.traded_death_attempts++;
          if (wasTraded) vl.traded_death_successes++;
        }
        if (wasTraded) traded.add(k.victim);
      });

      // Opening duel.
      const opener = kills[0];
      if (opener) {
        const victimTraded = kills.some((k) => k.victim === opener.killer && k.killer !== opener.victim);
        for (const [id, win] of [[opener.killer, true], [opener.victim, false]] as const) {
          const slot = slotOf[id];
          const duel = row(openings, `${mapId}|${id}|${sides[slot]}`, () => ({
            match_map_id: mapId,
            match_lineup_id: lineupIds[slot],
            steam_id: id,
            side: sides[slot],
            attempts: 0,
            wins: 0,
            deaths: 0,
            traded_deaths: 0,
          }));
          duel.attempts++;
          if (win) duel.wins++;
          else {
            duel.deaths++;
            if (victimTraded) duel.traded_deaths++;
          }
          mapLines[id].openings++;
        }
      }

      // Clutch, detected as detect_round_clutch does.
      {
        const standing: Record<Slot, string[]> = { 1: [...roster[1]], 2: [...roster[2]] };
        let clutch: { slot: Slot; id: string; against: number; kills: number } | null = null;
        let killedAll = false;
        for (const k of kills) {
          const slot = slotOf[k.victim];
          standing[slot] = standing[slot].filter((id) => id !== k.victim);
          if (clutch && k.killer === clutch.id) clutch.kills++;
          if (!clutch && (standing[1].length === 1 || standing[2].length === 1) && standing[1].length && standing[2].length) {
            const s: Slot = standing[1].length === 1 ? 1 : 2;
            clutch = { slot: s, id: standing[s][0], against: standing[other(s)].length, kills: 0 };
          }
          if (clutch) {
            if (!standing[other(clutch.slot)].length) {
              killedAll = true;
              break;
            }
            if (!standing[clutch.slot].length) break;
          }
        }
        if (clutch) {
          clutches.push({
            match_map_id: mapId,
            round: round.round,
            match_lineup_id: lineupIds[clutch.slot],
            clutcher_steam_id: clutch.id,
            side: sides[clutch.slot],
            against_count: clutch.against,
            kills_in_clutch: clutch.kills,
            outcome: killedAll ? "won" : clutch.slot === winner ? "saved" : "lost",
          });
        }
      }

      // Chip damage on whoever lived, and every player's grenades.
      for (const slot of [1, 2] as const) {
        const side = sides[slot];
        for (const id of roster[slot]) {
          const l = lines[id];
          const p = profile(id);
          const enemies = roster[other(slot)];
          if (alive[slot].includes(id) && chance(0.45)) {
            const from = pick(enemies);
            const dmg = int(9, 62);
            lines[from].damage += dmg;
            lines[from][`damage_${sides[other(slot)]}` as const] += dmg;
            const cp = pair(from, id);
            cp.damage_dealt += dmg;
            cp.hits += int(1, 2);
          }
          const g = gear(slot);
          const thrown = Math.round(
            (g === "rifles" ? int(1, 3) : g === "light" ? int(0, 2) : chance(pistol ? 0.45 : 0.2) ? 1 : 0) * p.util,
          );
          for (let n = 0; n < thrown; n++) {
            const nade = pick(NADES, (type) => p.nades[NADES.indexOf(type)]);
            const landed = chance(0.96);
            const id2 = ++grenadeId;
            const type = nade === "molotov" && side === "ct" ? "incgrenade" : nade;
            grenades.push({ match_map_id: mapId, grenade_id: id2, phase: "thrown", type, round: round.round, thrower_steam_id: id });
            if (landed) {
              grenades.push({ match_map_id: mapId, grenade_id: id2, phase: "detonated", type, round: round.round, thrower_steam_id: id });
            }
            const report = row(reportRows, id, () =>
              Object.fromEntries(NADES.map((t) => [t, { throws: 0, landed: 0 }])) as Record<Nade, { throws: number; landed: number }>,
            );
            report[nade].throws++;
            if (landed) report[nade].landed++;
            if (nade === "flashbang") {
              l.flashes_thrown++;
              mapLines[id].support += 0.3;
              const blinded = pick([0, 1, 2], (c) => [35, 45, 20][c]);
              for (let b = 0; b < blinded; b++) {
                l.enemies_flashed++;
                l.flash_time += 0.9 + random() * 2.3;
                pair(id, pick(enemies)).flash_count++;
              }
              if (chance(0.12)) l.team_flashed++;
            } else if (nade === "smokegrenade") {
              l.smoke_throws++;
            } else {
              const he = nade === "hegrenade";
              const dmg = he ? (chance(0.7) ? int(6, 64) : 0) : chance(0.55) ? int(4, 46) : 0;
              if (he) {
                l.he_throws++;
                l.he_damage += dmg;
                if (chance(0.06)) l.he_team_damage += int(4, 22);
              } else {
                l.molotov_throws++;
                l.molotov_damage += dmg;
              }
              l.damage += dmg;
              l[`damage_${side}` as const] += dmg;
              mapLines[id].support += dmg / 100;
            }
          }
        }
      }

      // Rounds, KAST, multi-kills, buys.
      const matchups: Record<Slot, string | null> = {
        1: matchup(buy(1), buy(2)),
        2: matchup(buy(2), buy(1)),
      };
      for (const slot of [1, 2] as const) {
        const side = sides[slot];
        const won = slot === winner;
        const lost = kills[0] ? (slotOf[kills[0].victim] === slot) : false;
        const drew = kills[0] ? (slotOf[kills[0].killer] === slot) : false;
        const team = row(lineupMap, `${mapId}|${slot}|${side}`, () => ({
          match_map_id: mapId,
          match_lineup_id: lineupIds[slot],
          side,
          rounds: 0, round_wins: 0, pistol_rounds: 0, pistol_wins: 0,
          opening_attempts: 0, opening_wins: 0,
          man_adv_rounds: 0, man_adv_wins: 0, man_dis_rounds: 0, man_dis_wins: 0,
          won_buy_pistol: 0, won_buy_eco: 0, won_buy_force: 0, won_buy_full: 0,
        }));
        team.rounds++;
        if (won) team.round_wins++;
        if (pistol) team.pistol_rounds++;
        if (pistol && won) team.pistol_wins++;
        if (drew || lost) team.opening_attempts++;
        if (drew) team.opening_wins++;
        if (!lost) team.man_adv_rounds++;
        if (!lost && won) team.man_adv_wins++;
        if (lost) team.man_dis_rounds++;
        if (lost && won) team.man_dis_wins++;
        if (won) team[`won_buy_${buy(slot)}`]++;

        const key = matchups[slot];
        if (key) {
          const tb = row(lineupBuys, `${mapId}|${slot}|${side}|${key}`, () => ({
            match_map_id: mapId, match_lineup_id: lineupIds[slot], side, matchup: key, rounds: 0, wins: 0,
          }));
          tb.rounds++;
          if (won) tb.wins++;
        }

        for (const id of roster[slot]) {
          const l = lines[id];
          const died = !alive[slot].includes(id);
          const k = roundKills[id] ?? 0;
          l.rounds_played++;
          l[`rounds_${side}` as const]++;
          if (k >= 2) l[MULTI[Math.min(k, 5) - 2]]++;
          mapLines[id].rounds++;
          if (k || touched.has(id) || !died || traded.has(id)) mapLines[id].kast++;
          if (died && buy(slot) !== "pistol" && chance(0.3)) {
            l.unused_sum += pick([200, 300, 400, 600]);
            l.unused_count++;
          }
          if (key) {
            const pb = row(playerBuys, `${mapId}|${id}|${side}|${key}`, () => ({
              match_map_id: mapId, match_lineup_id: lineupIds[slot], steam_id: id, side, matchup: key, rounds: 0, kills: 0, deaths: 0,
            }));
            pb.rounds++;
            pb.kills += k;
            pb.deaths += died ? 1 : 0;
          }
        }

        // Money as the round ends. Whoever lived kept their guns.
        const g = gear(slot);
        const dead = pistol ? 5 : fallen[slot];
        const spend = pistol
          ? 3000
          : g === "rifles"
            ? Math.min(start[slot] * 0.95, dead * 4800 + (5 - dead) * 800)
            : g === "light"
              ? Math.min(start[slot] * 0.9, dead * 2900 + (5 - dead) * 500)
              : Math.min(start[slot] * 0.15, 1500);
        const reason = round.winning_reason;
        const reward = won
          ? reason === e_winning_reasons_enum.BombExploded || reason === e_winning_reasons_enum.BombDefused
            ? 3500
            : 3250
          : 1400 + 500 * Math.min(streak[slot], 4);
        const bounty = kills
          .filter((k) => slotOf[k.killer] === slot)
          .reduce((sum, k) => sum + killReward(k.weapon), 0);
        money[slot] = Math.max(0, Math.min(80000, Math.round((start[slot] - spend + reward * 5 + bounty) / 50) * 50));
        streak[slot] = won ? Math.max(0, streak[slot] - 1) : streak[slot] + 1;
        fallen[slot] = 5 - alive[slot].length;
      }
      ends.set(round.round, { ...money });
    }
  }

  // Shots and aim, sized to each player's fights.
  const aimOf = (id: string) => {
    const l = lines[id];
    const p = profile(id);
    const jitter = () => 0.92 + random() * 0.16;
    const shots = Math.round((l.kills * 10.5 + l.deaths * 5 + l.rounds_played * 3.2) * jitter());
    const hits = Math.round(shots * p.aim * jitter());
    const sniperShots = l.sniper_kills ? Math.round(l.sniper_kills * 1.7 + 3) : 0;
    const sniperHits = l.sniper_kills ? l.sniper_kills + 1 : 0;
    const pistolShots = Math.round((shots - sniperShots) * (0.16 + (l.pistol_kills / Math.max(1, l.kills)) * 0.4));
    const pistolHits = Math.round(pistolShots * p.aim * 1.1);
    const rifleShots = shots - sniperShots - pistolShots;
    const rifleHits = Math.max(0, hits - sniperHits - pistolHits);
    const nonAwp = hits - sniperHits;
    const sprayShots = Math.round(shots * 0.38);
    const fbShots = l.kills * 2 + l.rounds_played;
    const frames = Math.round(l.rounds_played * 140 * jitter());
    const eligible = Math.round(shots * 0.55);
    const spotted = Math.round(l.rounds_played * 2.4);
    const klass = (weapon_class: string, s: number, h: number) => ({
      weapon_class,
      shots: s,
      hits: h,
      first_bullet_shots: Math.round(s * 0.2),
      first_bullet_hits: Math.round(s * 0.2 * Math.min(0.9, p.aim * 2.1)),
    });
    return {
      stats: {
        shots_fired: shots,
        hits,
        non_awp_hits: nonAwp,
        headshot_hits: Math.round(nonAwp * (0.16 + p.hs * 0.24)),
        wasted_magazine_shots: Math.round(shots * (0.03 + random() * 0.03)),
        shots_at_spotted: Math.round(shots * 0.72),
        hits_at_spotted: Math.round(hits * 0.9),
        spray_shots: sprayShots,
        spray_hits: Math.round(sprayShots * p.aim * 1.3 * jitter()),
        first_bullet_shots: fbShots,
        first_bullet_hits: Math.round(fbShots * (0.28 + p.aim) * jitter()),
        total_engagement_frames: frames,
        on_target_frames: Math.round(frames * (0.34 + p.aim * 1.1)),
        counter_strafe_eligible_shots: eligible,
        counter_strafed_shots: Math.round(eligible * Math.min(0.95, 0.66 + p.skill * 0.15)),
        avg_time_to_damage_s: Math.round((0.86 - p.skill * 0.2) * jitter() * 1000) / 1000,
        avg_crosshair_angle_deg: Math.round((15 - p.skill * 6) * jitter() * 10) / 10,
        spotted_count: spotted,
        spotted_with_damage_count: Math.round(spotted * (0.2 + p.skill * 0.1)),
      },
      weapons: [
        klass("rifle", rifleShots, rifleHits),
        klass("pistol", pistolShots, pistolHits),
        ...(sniperShots ? [klass("sniper", sniperShots, sniperHits)] : []),
      ],
    };
  };

  const rating = (l: Line, kast: number) => {
    const rounds = l.rounds_played;
    const kpr = l.kills / rounds;
    const apr = l.assists / rounds;
    return 0.0073 * kast + 0.3591 * kpr - 0.5329 * (l.deaths / rounds) + 0.2372 * (2.13 * kpr + 0.42 * apr - 0.41) + 0.0032 * (l.damage / rounds) + 0.1587;
  };

  const kastOf = (id: string) => {
    let kast = 0;
    let rounds = 0;
    for (const mapLines of Object.values(perMap)) {
      kast += mapLines[id].kast;
      rounds += mapLines[id].rounds;
    }
    return (kast / rounds) * 100;
  };

  const eloOf = (id: string) => DEMO_PLAYERS[nameOf[id] as keyof typeof DEMO_PLAYERS].elo.competitive;
  const teamElo = (slot: Slot) => roster[slot].reduce((sum, id) => sum + eloOf(id), 0) / 5;
  const teamKda = (slot: Slot) =>
    roster[slot].reduce((sum, id) => sum + (lines[id].kills + lines[id].assists) / Math.max(1, lines[id].deaths), 0) / 5;
  const teamDamage = (slot: Slot) => roster[slot].reduce((sum, id) => sum + lines[id].damage, 0);

  const eloChanges: any[] = [];
  const winnerSlot: Slot = match.winning_lineup_id === lineupIds[2] ? 2 : 1;

  function playerStats(id: string) {
    const l = lines[id];
    const { stats, weapons } = aimOf(id);
    const slot = slotOf[id];
    const won = slot === winnerSlot;
    const r = rating(l, kastOf(id));
    const expected = 1 / (1 + 10 ** ((teamElo(other(slot)) - teamElo(slot)) / 400));
    const change = Math.round(won ? 12 + 14 * Math.max(0, r - 0.6) : -(26 - 12 * Math.max(0, r - 0.6)));
    const current = eloOf(id);
    eloChanges.push({
      player_steam_id: id,
      type: "competitive",
      match_result: won ? "win" : "loss",
      elo_change: change,
      current_elo: current,
      updated_elo: current + change,
      player_team_elo_avg: Math.round(teamElo(slot)),
      opponent_team_elo_avg: Math.round(teamElo(other(slot))),
      expected_score: Math.round(expected * 100) / 100,
      actual_score: won ? 1 : 0,
      k_factor: 40,
      impact: Math.round(r * 100) / 100,
      performance_multiplier: Math.round(r * 100) / 100,
      series_multiplier: 1,
      map_wins: won ? 2 : 0,
      map_losses: won ? 0 : 2,
      kills: l.kills,
      deaths: l.deaths,
      assists: l.assists,
      kda: Math.round(((l.kills + l.assists) / Math.max(1, l.deaths)) * 100) / 100,
      team_avg_kda: Math.round(teamKda(slot) * 100) / 100,
      damage: l.damage,
      damage_percent: Math.round((l.damage / teamDamage(slot)) * 100) / 100,
    });
    const { sniper_kills, pistol_kills, flash_time, unused_sum, unused_count, ...counts } = l;
    return {
      match_stats: [
        {
          ...counts,
          ...stats,
          avg_flash_duration: l.enemies_flashed ? Math.round((flash_time / l.enemies_flashed) * 100) / 100 : 0,
          utility_on_death: unused_count ? Math.round(unused_sum / unused_count) : 0,
          unused_utility_value: unused_sum,
        },
      ],
      weapon_stats: weapons,
      match_map_hltv: Object.entries(perMap).map(([match_map_id, mapLines]) => ({
        match_map_id,
        kast_pct: Math.round((mapLines[id].kast / mapLines[id].rounds) * 1000) / 10,
        rounds_played: mapLines[id].rounds,
      })),
    };
  }

  const lineup = (value: DemoMatch["lineup_1"]) => ({
    ...value,
    lineup_players: value.lineup_players.map((member) => ({
      ...member,
      player: {
        ...member.player,
        role: "user",
        elo: { competitive: eloOf(member.steam_id) },
        ...playerStats(member.steam_id),
      },
    })),
  });

  // Roles, classified per map and lineup as v_player_match_map_roles does.
  const roles: any[] = [];
  for (const [mapId, mapLines] of Object.entries(perMap)) {
    for (const slot of [1, 2] as const) {
      const signals = roster[slot].map((id) => ({
        id,
        awpKills: mapLines[id].awp,
        awp: mapLines[id].kills ? mapLines[id].awp / mapLines[id].kills : 0,
        entry: mapLines[id].openings / mapLines[id].rounds,
        support: mapLines[id].support / mapLines[id].rounds,
        openings: mapLines[id].openings,
      }));
      const top = [...signals].sort((a, b) => b.awpKills - a.awpKills || b.awp - a.awp)[0];
      const awper = top.awpKills >= 5 && top.awp >= 0.2 ? top.id : null;
      const entry = signals.filter((s) => s.id !== awper && s.openings > 0).sort((a, b) => b.entry - a.entry)[0]?.id;
      const support = signals.filter((s) => s.id !== awper && s.id !== entry && s.support > 0).sort((a, b) => b.support - a.support)[0]?.id;
      for (const s of signals) {
        roles.push({
          match_map_id: mapId,
          steam_id: s.id,
          role: s.id === awper ? "Sniper" : s.id === entry ? "Entry" : s.id === support ? "Support" : "Rifler",
          rounds: mapLines[s.id].rounds,
          awp_share: Math.round(s.awp * 10000) / 10000,
          entry_rate: Math.round(s.entry * 10000) / 10000,
          support_idx: Math.round(s.support * 10000) / 10000,
        });
      }
    }
  }

  // The utility report per thrower, and for everyone.
  const report = (steamId: string | null) => {
    const ids = steamId ? [steamId] : Object.keys(nameOf);
    const by_type = NADES.map((nade) => {
      const throws = ids.reduce((sum, id) => sum + (reportRows.get(id)?.[nade].throws ?? 0), 0);
      const landed = ids.reduce((sum, id) => sum + (reportRows.get(id)?.[nade].landed ?? 0), 0);
      const rate = { flashbang: 0.22, smokegrenade: 0.46, hegrenade: 0.12, molotov: 0.34 }[nade];
      const matched = Math.round(throws * rate);
      return {
        utility_type: REPORT_TYPES[nade],
        throws,
        matched_lineups: matched,
        matched_meta: Math.round(matched * 0.62),
        landed,
      };
    }).filter((entry) => entry.throws > 0);
    const sum = (key: "throws" | "matched_lineups" | "matched_meta" | "landed") =>
      by_type.reduce((total, entry) => total + entry[key], 0);
    return {
      steam_id: steamId,
      analysed: true,
      message: null,
      radius: 48,
      throws: sum("throws"),
      matched_lineups: sum("matched_lineups"),
      matched_meta: sum("matched_meta"),
      landed: sum("landed"),
      by_type,
    };
  };

  const enriched = {
    ...match,
    options: {
      ...match.options,
      mr: MR,
      overtime: true,
      timeout_setting: "CoachAndPlayers",
      tech_timeout_setting: "CoachAndPlayers",
      ready_setting: "Players",
      check_in_setting: "Players",
      number_of_substitutes: 0,
      default_models: false,
    },
    lineup_1: lineup(match.lineup_1),
    lineup_2: lineup(match.lineup_2),
    match_maps: match.match_maps.map((matchMap) => ({
      ...matchMap,
      rounds: matchMap.rounds.map((round) => ({
        ...round,
        lineup_1_money: moneyByMap[matchMap.id].get(round.round)?.[1] ?? null,
        lineup_2_money: moneyByMap[matchMap.id].get(round.round)?.[2] ?? null,
      })),
    })),
    elo_changes: eloChanges,
  };

  return {
    match: enriched,
    // Rows by the root field each tab would otherwise fetch.
    views: {
      v_match_lineup_map_stats: [...lineupMap.values()],
      v_match_lineup_buy_types: [...lineupBuys.values()],
      v_match_player_buy_types: [...playerBuys.values()],
      v_match_player_opening_duels: [...openings.values()],
      v_match_clutches: clutches,
      v_match_kill_pairs: [...killPairs.values()],
      v_player_match_head_to_head: [...pairs.values()],
      v_player_match_map_roles: roles,
      utilityMatchUtilityReport: [null, ...Object.keys(nameOf)].map(report),
      grenade_throws: grenades,
    } as Record<string, any[]>,
  };
}
