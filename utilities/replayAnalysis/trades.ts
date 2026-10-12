// Trades in a round of the replay: the killer of a player is killed by one of
// that player's teammates soon after.

// The API's trade_pairs (recompute_player_match_map_stats) use 5 seconds, so
// the replay agrees with the match's trade stats.
export const TRADE_WINDOW_SEC = 5;

export type TradeKill = {
  tick: number;
  killer?: string | null;
  victim?: string | null;
  killer_team?: string | null;
  victim_team?: string | null;
};

export type KillTrade = {
  /** Index of the kill that traded this death, if any. */
  tradedBy: number | null;
  /** Indexes of the deaths this kill traded. */
  avenges: number[];
};

export type TradeState = "traded" | "untraded" | "open" | "none";

export function sideOf(team: string | null | undefined): "ct" | "t" | null {
  const s = (team ?? "").toLowerCase();
  if (s === "ct") return "ct";
  if (s === "t" || s === "terrorist") return "t";
  return null;
}

/** A kill of an enemy by a player, the only kind a trade is about. */
export function isEnemyKill(k: TradeKill): boolean {
  const kt = sideOf(k.killer_team);
  const vt = sideOf(k.victim_team);
  return (
    !!k.killer &&
    !!k.victim &&
    k.killer !== k.victim &&
    !!kt &&
    !!vt &&
    kt !== vt
  );
}

/** Pairs each death with the kill that traded it. `kills` is one round's. */
export function findTrades(
  kills: TradeKill[],
  tickRate: number,
  windowSec = TRADE_WINDOW_SEC,
): KillTrade[] {
  const window = windowSec * (tickRate || 64);
  const out: KillTrade[] = kills.map(() => ({ tradedBy: null, avenges: [] }));
  const order = kills
    .map((_, i) => i)
    .sort((a, b) => kills[a].tick - kills[b].tick);
  for (let oi = 0; oi < order.length; oi++) {
    const i = order[oi];
    const k = kills[i];
    if (!isEnemyKill(k)) continue;
    const victimSide = sideOf(k.victim_team);
    for (let oj = oi + 1; oj < order.length; oj++) {
      const j = order[oj];
      const k2 = kills[j];
      if (k2.tick > k.tick + window) break;
      if (k2.tick <= k.tick) continue;
      if (
        k2.victim === k.killer &&
        !!k2.killer &&
        k2.killer !== k.victim &&
        sideOf(k2.killer_team) === victimSide
      ) {
        out[i].tradedBy = j;
        out[j].avenges.push(i);
        break;
      }
    }
  }
  return out;
}

/**
 * What the viewer can know about a death at `cursor`: once the window or the
 * round (`roundEnd`) is over, a death nobody traded is untraded.
 */
export function tradeStateAt(
  kills: TradeKill[],
  trades: KillTrade[],
  index: number,
  cursor: number,
  tickRate: number,
  roundEnd: number | null = null,
  windowSec = TRADE_WINDOW_SEC,
): TradeState {
  const k = kills[index];
  if (!k || !isEnemyKill(k)) return "none";
  const by = trades[index]?.tradedBy;
  if (by != null && kills[by].tick <= cursor) return "traded";
  if (cursor > k.tick + windowSec * (tickRate || 64)) return "untraded";
  if (roundEnd != null && cursor >= roundEnd && by == null) return "untraded";
  return "open";
}

export type TradeCounts = Record<
  "ct" | "t",
  { deaths: number; traded: number }
>;

/** Each side's deaths so far and how many of them were traded by `cursor`. */
export function tradeCounts(
  kills: TradeKill[],
  trades: KillTrade[],
  cursor: number,
): TradeCounts {
  const out: TradeCounts = {
    ct: { deaths: 0, traded: 0 },
    t: { deaths: 0, traded: 0 },
  };
  kills.forEach((k, i) => {
    if (k.tick > cursor || !isEnemyKill(k)) return;
    const side = sideOf(k.victim_team)!;
    out[side].deaths++;
    const by = trades[i]?.tradedBy;
    if (by != null && kills[by].tick <= cursor) out[side].traded++;
  });
  return out;
}
