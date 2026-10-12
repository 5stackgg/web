// Flash report for a round of the replay, from the blob's per-player blinds
// (schema v11+): who each flashbang blinded, and the kills it set up.
import type { FlashRow } from "~/utilities/replayStage/frameIndex";
import { isEnemyKill, type TradeKill } from "~/utilities/replayAnalysis/trades";

// The API counts enemies_flashed / team_flashed only past one second of
// blindness, so a glance at a flash doesn't count here either.
export const MIN_BLIND_SEC = 1;
// Every player a flashbang blinds is reported on the tick it pops.
const BURST_SEC = 0.25;
const PAIR_SEC = 0.5;
// A flashbang's fuse, with room for a bounce.
const THROW_TO_POP_SEC = 5;

export type FlashGrenade = {
  tick: number;
  grenade_id: number | null;
  thrower_steam_id: string | null;
  type: string;
  phase: string;
};

export type FlashBurst = {
  attacker: string;
  tick: number;
  /** The flashbang it came from (grenade_id), when it can be told. */
  gid: number | null;
  enemies: number;
  enemySec: number;
  /** Teammates blinded, the thrower included, as the API counts it. */
  teammates: number;
};

const sid = (v: string | number | null | undefined) =>
  v == null || v === "" ? "" : String(v);

function burstOf(
  attacker: string,
  tick: number,
  gid: number | null,
  rows: FlashRow[],
): FlashBurst {
  const b: FlashBurst = {
    attacker,
    tick,
    gid,
    enemies: 0,
    enemySec: 0,
    teammates: 0,
  };
  for (const r of rows) {
    if (r.duration <= MIN_BLIND_SEC) continue;
    if (r.team_flash) b.teammates++;
    else {
      b.enemies++;
      b.enemySec += r.duration;
    }
  }
  return b;
}

/**
 * One entry per flashbang that popped: its blinds, matched to the grenade by
 * thrower and tick. A flash that blinded nobody is an empty entry.
 */
export function groupFlashes(
  rows: FlashRow[],
  grenades: FlashGrenade[],
  tickRate: number,
): FlashBurst[] {
  const rate = tickRate || 64;
  const flashes = grenades.filter((g) => g.type === "Flash");
  const pops = flashes
    .filter((g) => g.phase === "detonated")
    .sort((a, b) => a.tick - b.tick);
  const throws = flashes
    .filter((g) => g.phase === "thrown")
    .sort((a, b) => a.tick - b.tick);

  const groups: Array<{ attacker: string; tick: number; rows: FlashRow[] }> =
    [];
  const sorted = rows
    .filter((r) => sid(r.attacker_steam_id))
    .sort((a, b) => a.tick - b.tick);
  for (const r of sorted) {
    const attacker = sid(r.attacker_steam_id);
    const g = groups.find(
      (x) => x.attacker === attacker && r.tick - x.tick <= BURST_SEC * rate,
    );
    if (g) g.rows.push(r);
    else groups.push({ attacker, tick: r.tick, rows: [r] });
  }

  const usedPops = new Set<FlashGrenade>();
  const usedGids = new Set<number>();
  const out: FlashBurst[] = [];
  for (const g of groups) {
    let pop: FlashGrenade | null = null;
    for (const p of pops) {
      if (usedPops.has(p) || sid(p.thrower_steam_id) !== g.attacker) continue;
      const d = Math.abs(p.tick - g.tick);
      if (d <= PAIR_SEC * rate && (!pop || d < Math.abs(pop.tick - g.tick))) {
        pop = p;
      }
    }
    let gid: number | null = null;
    if (pop) {
      usedPops.add(pop);
      gid = pop.grenade_id;
    } else {
      let thrown: FlashGrenade | null = null;
      for (const t of throws) {
        if (sid(t.thrower_steam_id) !== g.attacker || t.tick > g.tick) continue;
        if (g.tick - t.tick > THROW_TO_POP_SEC * rate) continue;
        if (t.grenade_id != null && usedGids.has(t.grenade_id)) continue;
        thrown = t;
      }
      gid = thrown?.grenade_id ?? null;
    }
    if (gid != null) usedGids.add(gid);
    out.push(burstOf(g.attacker, pop?.tick ?? g.tick, gid, g.rows));
  }
  for (const p of pops) {
    if (usedPops.has(p)) continue;
    if (p.grenade_id != null && usedGids.has(p.grenade_id)) continue;
    out.push(burstOf(sid(p.thrower_steam_id), p.tick, p.grenade_id, []));
  }
  return out.sort((a, b) => a.tick - b.tick);
}

export type FlashAssistKill = TradeKill & {
  assist?: string | null;
  assist_flash?: boolean;
};

/**
 * CS2's own flash assist on each kill, for blobs without per-player blinds.
 * The game names one assister, so a damage assist hides a flash.
 */
export function flashAssistsFromKills(
  kills: FlashAssistKill[],
): Array<string | null> {
  return kills.map((k) =>
    k.assist_flash && k.assist && isEnemyKill(k) && k.assist !== k.killer
      ? sid(k.assist)
      : null,
  );
}

/**
 * For each kill, the player whose flash had the victim blind when they died:
 * on the killer's team, and not the killer. Null when there is none.
 */
export function flashAssists(
  kills: TradeKill[],
  rows: FlashRow[],
  tickRate: number,
): Array<string | null> {
  const rate = tickRate || 64;
  return kills.map((k) => {
    if (!isEnemyKill(k)) return null;
    let best: FlashRow | null = null;
    for (const r of rows) {
      const flasher = sid(r.attacker_steam_id);
      if (r.team_flash || !flasher) continue;
      if (sid(r.attacked_steam_id) !== k.victim) continue;
      if (flasher === k.killer || flasher === k.victim) continue;
      if (k.tick < r.tick || k.tick > r.tick + r.duration * rate) continue;
      if (!best || r.tick > best.tick) best = r;
    }
    return best ? sid(best.attacker_steam_id) : null;
  });
}

export type FlashTally = {
  /** Flashbangs that popped. */
  thrown: number;
  enemies: number;
  enemySec: number;
  teammates: number;
  assists: number;
};

export type FlashPlayerTally = FlashTally & { sid: string; side: "ct" | "t" };

export type FlashTallies = {
  ct: FlashTally;
  t: FlashTally;
  players: FlashPlayerTally[];
};

const emptyTally = (): FlashTally => ({
  thrown: 0,
  enemies: 0,
  enemySec: 0,
  teammates: 0,
  assists: 0,
});

/** Per side and per thrower, up to `cursor`. */
export function flashTallies(
  bursts: FlashBurst[],
  kills: TradeKill[],
  assists: Array<string | null>,
  cursor: number,
  sideOf: (sid: string) => "ct" | "t" | null,
): FlashTallies {
  const out: FlashTallies = { ct: emptyTally(), t: emptyTally(), players: [] };
  const byPlayer = new Map<string, FlashPlayerTally>();
  const player = (id: string) => {
    const side = sideOf(id);
    if (!side) return null;
    let p = byPlayer.get(id);
    if (!p) {
      p = { sid: id, side, ...emptyTally() };
      byPlayer.set(id, p);
    }
    return p;
  };
  for (const b of bursts) {
    if (b.tick > cursor) continue;
    const p = player(b.attacker);
    if (!p) continue;
    for (const t of [p, out[p.side]]) {
      t.thrown++;
      t.enemies += b.enemies;
      t.enemySec += b.enemySec;
      t.teammates += b.teammates;
    }
  }
  kills.forEach((k, i) => {
    const flasher = assists[i];
    if (!flasher || k.tick > cursor) return;
    const p = player(flasher);
    if (!p) return;
    p.assists++;
    out[p.side].assists++;
  });
  out.players = [...byPlayer.values()].sort(
    (a, b) =>
      b.enemies - a.enemies || b.enemySec - a.enemySec || b.assists - a.assists,
  );
  return out;
}
