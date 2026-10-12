// What each player and team bought for a round, from the replay's freeze-end
// loadouts (blob round_inventory), valued at CS2 store prices.
import { classifyBuyType, moneyOf, type BuyType } from "~/utilities/buyType";

// Keyed by the compact name (lowercase, no "weapon_", alphanumerics only) of
// the internal names: "m4a1" is the M4A4 (see utilities/demoWeaponNames).
const WEAPON_PRICES: Record<string, number> = {
  glock: 200,
  glock18: 200,
  usp: 200,
  usps: 200,
  uspsilencer: 200,
  p2000: 200,
  hkp2000: 200,
  p250: 300,
  elite: 300,
  dualberettas: 300,
  fiveseven: 500,
  tec9: 500,
  cz75a: 500,
  cz75auto: 500,
  revolver: 600,
  r8revolver: 600,
  deagle: 700,
  deserteagle: 700,
  mac10: 1050,
  mp9: 1250,
  mp7: 1500,
  mp5sd: 1500,
  ump45: 1200,
  p90: 2350,
  bizon: 1400,
  ppbizon: 1400,
  nova: 1050,
  xm1014: 2000,
  sawedoff: 1100,
  mag7: 1300,
  m249: 5200,
  negev: 1700,
  galil: 1800,
  galilar: 1800,
  famas: 1950,
  ak47: 2700,
  m4a1: 3100,
  m4a4: 3100,
  m4a1s: 2900,
  m4a1silencer: 2900,
  sg553: 3000,
  sg556: 3000,
  aug: 3300,
  ssg08: 1700,
  awp: 4750,
  g3sg1: 5000,
  scar20: 5000,
};

export const KEVLAR_PRICE = 650;
export const KEVLAR_HELMET_PRICE = 1000;
export const KIT_PRICE = 400;
const FLASH_PRICE = 200;
const SMOKE_PRICE = 300;
const HE_PRICE = 300;
const MOLOTOV_PRICE = 400;
const INCENDIARY_PRICE = 500;
const DECOY_PRICE = 50;

export type BuyLoadout = {
  team?: string | null;
  flash?: number;
  smoke?: number;
  he?: number;
  molotov?: number;
  decoy?: number;
  primary?: string | null;
  secondary?: string | null;
  armor?: number;
  helmet?: boolean;
  kit?: boolean;
};

export function weaponPrice(name: string | null | undefined): number {
  if (!name) return 0;
  const key = name
    .toLowerCase()
    .replace(/^weapon_/, "")
    .replace(/[^a-z0-9]/g, "");
  return WEAPON_PRICES[key] ?? 0;
}

/** The loadout's worth, the way CS2 counts equipment value. */
export function loadoutValue(lo: BuyLoadout): number {
  const ct = (lo.team ?? "").toLowerCase() === "ct";
  let v = weaponPrice(lo.primary) + weaponPrice(lo.secondary);
  if ((lo.armor ?? 0) > 0) v += lo.helmet ? KEVLAR_HELMET_PRICE : KEVLAR_PRICE;
  if (lo.kit) v += KIT_PRICE;
  v += (lo.flash ?? 0) * FLASH_PRICE;
  v += (lo.smoke ?? 0) * SMOKE_PRICE;
  v += (lo.he ?? 0) * HE_PRICE;
  v += (lo.molotov ?? 0) * (ct ? INCENDIARY_PRICE : MOLOTOV_PRICE);
  v += (lo.decoy ?? 0) * DECOY_PRICE;
  return v;
}

/** Each side's equipment value per round, from the freeze-end loadouts. */
export function teamValuesByRound(
  inventory: Array<BuyLoadout & { round: number }>,
): Map<number, Record<"ct" | "t", number>> {
  const out = new Map<number, Record<"ct" | "t", number>>();
  for (const r of inventory) {
    const side = (r.team ?? "").toLowerCase();
    if (side !== "ct" && side !== "t") continue;
    let v = out.get(r.round);
    if (!v) out.set(r.round, (v = { ct: 0, t: 0 }));
    v[side] += loadoutValue(r);
  }
  return out;
}

export function formatMoney(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

/** $650, $4.7k, $24.1k. */
export function formatMoneyShort(v: number): string {
  return v < 1000 ? `$${Math.round(v)}` : `$${(v / 1000).toFixed(1)}k`;
}

export type RoundBuyType = BuyType | "pistol";

/**
 * The team's round type from what it bought, on the app's eco / force / full
 * thresholds. The first round of a half on eco money is the pistol round.
 */
export function roundBuyType(value: number, halfStart: boolean): RoundBuyType {
  const type = classifyBuyType(value);
  return halfStart && type === "eco" ? "pistol" : type;
}

/** Rounds that open a half: the first, and any where players changed sides. */
export function halfStartRounds(
  sideByRound: Map<number, Map<string, "ct" | "t">>,
): Set<number> {
  const rounds = [...sideByRound.keys()].sort((a, b) => a - b);
  const out = new Set<number>();
  if (rounds.length) out.add(rounds[0]);
  for (let i = 1; i < rounds.length; i++) {
    const prev = sideByRound.get(rounds[i - 1])!;
    for (const [sid, side] of sideByRound.get(rounds[i])!) {
      const before = prev.get(sid);
      if (before && before !== side) {
        out.add(rounds[i]);
        break;
      }
    }
  }
  return out;
}

export type RoundMoney = {
  round: number;
  lineup_1_money: number | string | null;
  lineup_2_money: number | string | null;
  lineup_1_side?: string | null;
  lineup_2_side?: string | null;
};

function moneySide(side: string | null | undefined): "ct" | "t" | null {
  const s = (side ?? "").toUpperCase();
  if (s === "CT") return "ct";
  if (s === "T" || s === "TERRORIST") return "t";
  return null;
}

/**
 * A side's money going into `round`. match_map_rounds stores each lineup's
 * money as the round ends, so it is the previous round's figure, and only
 * while the lineup stays on the same side (money resets at the half).
 */
export function startMoney(
  economy: RoundMoney[],
  round: number,
  side: "ct" | "t",
): number | null {
  const cur = economy.find((r) => r.round === round);
  const prev = economy.find((r) => r.round === round - 1);
  if (!cur || !prev) return null;
  for (const n of [1, 2] as const) {
    if (moneySide(cur[`lineup_${n}_side`]) !== side) continue;
    if (moneySide(prev[`lineup_${n}_side`]) !== side) return null;
    return moneyOf(prev[`lineup_${n}_money`]);
  }
  return null;
}
