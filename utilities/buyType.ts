// Per-round buy classification from team money. Shared by the match
// economy timeline and the 2D replay buy-round overlay so both agree on
// what counts as a "full buy".
export const ECO_MAX = 5000;
export const FULL_MIN = 20000;

export type BuyType = "eco" | "force" | "full" | "unknown";

export function moneyOf(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function classifyBuyType(money: number | null): BuyType {
  if (money === null) return "unknown";
  if (money >= FULL_MIN) return "full";
  if (money <= ECO_MAX) return "eco";
  return "force";
}

// A round qualifies for the buy-round overlay when either side did a
// full buy — we keep both teams' positions either way.
export function isFullBuyRound(
  lineup1Money: number | null,
  lineup2Money: number | null,
): boolean {
  return (
    classifyBuyType(lineup1Money) === "full" ||
    classifyBuyType(lineup2Money) === "full"
  );
}

// mp_startmoney in every 5Stack match cfg, and CS2's default for imports.
export const START_MONEY = 800;

// 5Stack leaves mp_overtime_maxrounds at CS2's 6: three rounds a side.
const OVERTIME_HALF_ROUNDS = 3;

const PLAYERS_PER_SIDE: Record<string, number> = {
  Competitive: 5,
  Premier: 5,
  Faceit: 5,
  Wingman: 2,
  Duel: 1,
  Rush: 3,
};

const LINEUP_FIELDS = {
  1: { money: "lineup_1_money", side: "lineup_1_side" },
  2: { money: "lineup_2_money", side: "lineup_2_side" },
} as const;

export type EconomyRound = {
  round: number;
  lineup_1_money: number | string | null;
  lineup_2_money: number | string | null;
  lineup_1_side?: string | null;
  lineup_2_side?: string | null;
};

export type RoundStartMoney = {
  lineup_1: number | null;
  lineup_2: number | null;
};

/**
 * The stretch of rounds a team's money carries across. Each regulation half
 * and each overtime half restarts every player's money; Rush plays one side
 * with no halftime.
 */
export function moneyPeriod(
  round: number,
  mr: number,
  type?: string | null,
): number {
  if (type === "Rush" || round <= mr) return 0;
  if (round <= mr * 2) return 1;
  return 2 + Math.floor((round - mr * 2 - 1) / OVERTIME_HALF_ROUNDS);
}

function sideOf(side: string | null | undefined): string | null {
  return side === "T" ? "TERRORIST" : (side ?? null);
}

/**
 * Each lineup's money going into each round. match_map_rounds stores money as
 * the round ends, so a round starts on the previous round's figure while the
 * lineup stays in the same period on the same side. A regulation half opens on
 * mp_startmoney a player. 5Stack never sets mp_overtime_startmoney, so an
 * overtime half's opening figure is unknown, as is any round whose previous
 * round is missing.
 */
export function startMoneyByRound(
  rounds: EconomyRound[],
  mr: number | null | undefined,
  type: string | null | undefined,
): Map<number, RoundStartMoney> {
  const byRound = new Map<number, EconomyRound>(
    rounds.map((r) => [r.round, r]),
  );
  const players = PLAYERS_PER_SIDE[type ?? ""];

  const start = (r: EconomyRound, n: 1 | 2): number | null => {
    if (!mr || mr <= 0) return null;
    const period = moneyPeriod(r.round, mr, type);
    if (r.round === 1 || moneyPeriod(r.round - 1, mr, type) !== period) {
      return period < 2 && players ? START_MONEY * players : null;
    }
    const prev = byRound.get(r.round - 1);
    const { money, side } = LINEUP_FIELDS[n];
    if (!prev || sideOf(prev[side]) !== sideOf(r[side])) return null;
    return moneyOf(prev[money]);
  };

  return new Map<number, RoundStartMoney>(
    rounds.map((r) => [
      r.round,
      { lineup_1: start(r, 1), lineup_2: start(r, 2) },
    ]),
  );
}
