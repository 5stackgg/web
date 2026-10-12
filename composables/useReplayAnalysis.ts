// Round context for the replay chrome: each side's buy, the trades and the
// flash report, all up to the playhead so nothing is given away early.
import { computed } from "vue";
import type { FlashRow } from "~/utilities/replayStage/frameIndex";
import {
  findTrades,
  tradeCounts,
  tradeStateAt,
  type TradeCounts,
  type TradeKill,
  type TradeState,
} from "~/utilities/replayAnalysis/trades";
import {
  halfStartRounds,
  loadoutValue,
  roundBuyType,
  startMoney,
  type BuyLoadout,
  type RoundBuyType,
  type RoundMoney,
} from "~/utilities/replayAnalysis/buy";
import {
  flashAssists,
  flashAssistsFromKills,
  flashTallies,
  groupFlashes,
  type FlashAssistKill,
  type FlashGrenade,
  type FlashTally,
} from "~/utilities/replayAnalysis/flashes";

type Side = "ct" | "t";

export type ReplayKillTrade = {
  state: TradeState;
  /** Who traded this death, and how many seconds later. */
  by?: string;
  sec?: string;
  /** Teammates whose deaths this kill traded. */
  avenges?: string[];
  /** Trade pairs the row belongs to, for highlighting its partner. */
  pairs?: string[];
};

export type ReplayFlashNote = {
  enemies: number;
  sec: string;
  teammates: number;
};

export type ReplayTeamBuy = {
  type: RoundBuyType;
  value: number;
  /** Money going into the round, when the round before is on record. */
  start: number | null;
};

export type ReplayRoundAnalysis = {
  buy: Record<Side, ReplayTeamBuy | null>;
  trades: TradeCounts;
  flashes: {
    /**
     * The blob has per-player blinds (schema v11+). Without them only flash
     * assists are known, from the game's own flag on each kill.
     */
    blinds: boolean;
    ct: FlashTally;
    t: FlashTally;
    players: Array<FlashTally & { sid: string; side: Side; name: string }>;
  };
};

type InventoryRow = BuyLoadout & { round: number; steam_id: string | null };

export function useReplayAnalysis(opts: {
  round: () => number | null;
  /** The round's kills, as stable objects. */
  kills: () => FlashAssistKill[];
  /** The round's grenade events. */
  grenades: () => FlashGrenade[];
  flashes: () => FlashRow[] | undefined;
  inventory: () => InventoryRow[] | undefined;
  economy: () => RoundMoney[] | undefined;
  sideByRound: () => Map<number, Map<string, Side>>;
  cursor: () => number;
  /** The round's last tick, after which no death can be traded. */
  roundEnd?: () => number | null;
  tickRate: () => number;
  name: (sid: string) => string;
}) {
  const rate = () => opts.tickRate() || 64;

  const trades = computed(() => findTrades(opts.kills(), rate()));

  const killTrades = computed(() => {
    const kills = opts.kills();
    const cursor = opts.cursor();
    const pairKey = (i: number) => `${opts.round()}-${i}`;
    const out = new Map<TradeKill, ReplayKillTrade>();
    kills.forEach((k, i) => {
      const t = trades.value[i];
      const state = tradeStateAt(
        kills,
        trades.value,
        i,
        cursor,
        rate(),
        opts.roundEnd?.() ?? null,
      );
      const note: ReplayKillTrade = { state, pairs: [] };
      if (state === "traded" && t.tradedBy != null) {
        const by = kills[t.tradedBy];
        note.by = opts.name(String(by.killer ?? ""));
        note.sec = ((by.tick - k.tick) / rate()).toFixed(1);
        note.pairs!.push(pairKey(i));
      }
      if (t.avenges.length) {
        note.avenges = t.avenges.map((j) =>
          opts.name(String(kills[j].victim ?? "")),
        );
        note.pairs!.push(...t.avenges.map(pairKey));
      }
      out.set(k, note);
    });
    return out;
  });

  const roundFlashes = computed(() => {
    const all = opts.flashes();
    if (!Array.isArray(all)) return null;
    const round = opts.round();
    return all.filter((f) => f.round === round);
  });

  const bursts = computed(() =>
    roundFlashes.value
      ? groupFlashes(roundFlashes.value, opts.grenades(), rate())
      : [],
  );

  const flashByGid = computed(() => {
    const cursor = opts.cursor();
    const out = new Map<number, ReplayFlashNote>();
    for (const b of bursts.value) {
      if (b.gid == null || b.tick > cursor) continue;
      out.set(b.gid, {
        enemies: b.enemies,
        sec: b.enemySec.toFixed(1),
        teammates: b.teammates,
      });
    }
    return out;
  });

  const roundInventory = computed(() => {
    const round = opts.round();
    return (opts.inventory() ?? []).filter((r) => r.round === round);
  });

  const valueBySteam = computed(() => {
    const out = new Map<string, number>();
    for (const r of roundInventory.value) {
      if (r.steam_id) out.set(r.steam_id, loadoutValue(r));
    }
    return out;
  });

  const halfStarts = computed(() => halfStartRounds(opts.sideByRound()));

  const teamBuys = computed<Record<Side, ReplayTeamBuy | null>>(() => {
    const round = opts.round();
    const out: Record<Side, ReplayTeamBuy | null> = { ct: null, t: null };
    if (round == null) return out;
    const value: Record<Side, number> = { ct: 0, t: 0 };
    const seen: Record<Side, boolean> = { ct: false, t: false };
    for (const r of roundInventory.value) {
      const side = (r.team ?? "").toLowerCase();
      if (side !== "ct" && side !== "t") continue;
      value[side] += loadoutValue(r);
      seen[side] = true;
    }
    const economy = opts.economy() ?? [];
    for (const side of ["ct", "t"] as const) {
      if (!seen[side]) continue;
      out[side] = {
        type: roundBuyType(value[side], halfStarts.value.has(round)),
        value: value[side],
        start: startMoney(economy, round, side),
      };
    }
    return out;
  });

  const summary = computed<ReplayRoundAnalysis>(() => {
    const kills = opts.kills();
    const cursor = opts.cursor();
    const sides = opts.sideByRound().get(opts.round() ?? -1);
    const tallies = flashTallies(
      bursts.value,
      kills,
      roundFlashes.value
        ? flashAssists(kills, roundFlashes.value, rate())
        : flashAssistsFromKills(kills),
      cursor,
      (id) => sides?.get(id) ?? null,
    );
    return {
      buy: teamBuys.value,
      trades: tradeCounts(kills, trades.value, cursor),
      flashes: {
        blinds: !!roundFlashes.value,
        ct: tallies.ct,
        t: tallies.t,
        players: tallies.players.map((p) => ({ ...p, name: opts.name(p.sid) })),
      },
    };
  });

  return {
    summary,
    killTrade: (k: TradeKill) => killTrades.value.get(k),
    flashNote: (gid: number | null | undefined) =>
      gid == null ? undefined : flashByGid.value.get(gid),
    playerValue: (sid: string) => valueBySteam.value.get(sid) ?? null,
  };
}
