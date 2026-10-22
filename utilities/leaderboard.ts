import { eloTierColor } from "~/utils/eloTier";
import {
  KD_TIER,
  HLTV_TIER,
  KAST_TIER,
  ADR_TIER,
  type StatTierConfig,
} from "~/utils/statTiers";

// Page-local chevron tiers for the rate stats without a canonical config.
const KPR_TIER: StatTierConfig = { dir: "high", cuts: [0.8, 0.7, 0.6, 0.5] };
const DPR_TIER: StatTierConfig = { dir: "low", cuts: [0.6, 0.65, 0.7, 0.75] };
const UDR_TIER: StatTierConfig = { dir: "high", cuts: [8, 6, 4, 2.5] };
const HS_TIER: StatTierConfig = { dir: "high", cuts: [55, 45, 35, 25] };
const WIN_RATE_TIER: StatTierConfig = { dir: "high", cuts: [58, 52, 48, 42] };

export interface LeaderboardEntry {
  rank: number;
  player_steam_id: string;
  player_name: string;
  player_avatar_url: string | null;
  player_custom_avatar_url: string | null;
  player_country: string | null;
  value: number;
  secondary_value: number | null;
  tertiary_value: number | null;
  matches_played: number | null;
}

export type LeaderboardField =
  "value" | "secondary_value" | "tertiary_value" | "matches_played";

export const LEADERBOARD_CATEGORIES: Record<
  string,
  {
    columns: Partial<Record<LeaderboardField, string>> & { value: string };
    // Maps a column to a `stat_glossary` key so its header shows the
    // dotted-underline hover tooltip. Only cryptic stat abbreviations get one;
    // word columns (Wins, Rounds, Trophies…) are left plain.
    glossary?: Partial<Record<LeaderboardField, string>>;
    // Maps a column to a chevron tier config so its value shows the
    // good/bad directional chevron (matching the match scoreboard).
    tiers?: Partial<Record<LeaderboardField, StatTierConfig>>;
    // Where the distance-to-#1 bars start: ELO is earned from 5000, not 0.
    base?: number;
  }
> = {
  faceit_elo: {
    columns: {
      value: "pages.leaderboard.col.faceit_elo",
      secondary_value: "pages.leaderboard.col.faceit_level",
    },
  },
  premier_rank: {
    columns: {
      value: "pages.leaderboard.col.premier_rank",
    },
  },
  elo: {
    columns: {
      value: "pages.leaderboard.col.elo",
      secondary_value: "pages.leaderboard.col.elo_change",
      tertiary_value: "pages.leaderboard.col.win_streak",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "elo", secondary_value: "elo_change" },
    base: 5000,
  },
  best_kdr: {
    columns: {
      value: "pages.leaderboard.col.kdr",
      secondary_value: "pages.leaderboard.col.kills",
      tertiary_value: "pages.leaderboard.col.deaths",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "kd" },
    tiers: { value: KD_TIER },
  },
  best_win_rate: {
    columns: {
      value: "common.stats.win_rate",
      secondary_value: "pages.leaderboard.col.wins",
      tertiary_value: "pages.leaderboard.col.losses",
      matches_played: "pages.leaderboard.columns.matches",
    },
    tiers: { value: WIN_RATE_TIER },
  },
  highest_hs_pct: {
    columns: {
      value: "pages.leaderboard.col.hs_pct",
      secondary_value: "pages.leaderboard.col.total_kills",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "hs" },
    tiers: { value: HS_TIER },
  },
  awards: {
    columns: {
      value: "pages.leaderboard.col.gold",
      secondary_value: "pages.leaderboard.col.silver",
      tertiary_value: "pages.leaderboard.col.bronze",
      matches_played: "pages.leaderboard.col.mvp",
    },
  },
  best_rating: {
    columns: {
      value: "pages.leaderboard.col.rating",
      secondary_value: "pages.leaderboard.col.adr",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "hltv", secondary_value: "adr" },
    tiers: { value: HLTV_TIER, secondary_value: ADR_TIER },
  },
  best_adr: {
    columns: {
      value: "pages.leaderboard.col.adr",
      secondary_value: "pages.leaderboard.col.rating",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "adr", secondary_value: "hltv" },
    tiers: { value: ADR_TIER, secondary_value: HLTV_TIER },
  },
  best_kpr: {
    columns: {
      value: "pages.leaderboard.col.kpr",
      secondary_value: "pages.leaderboard.col.dpr",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "kpr", secondary_value: "dpr" },
    tiers: { value: KPR_TIER, secondary_value: DPR_TIER },
  },
  best_kast: {
    columns: {
      value: "pages.leaderboard.col.kast",
      secondary_value: "pages.leaderboard.col.rating",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "kast", secondary_value: "hltv" },
    tiers: { value: KAST_TIER, secondary_value: HLTV_TIER },
  },
  best_udr: {
    columns: {
      value: "pages.leaderboard.col.udr",
      secondary_value: "pages.leaderboard.col.util_damage",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "udr" },
    tiers: { value: UDR_TIER },
  },
};

// Categories backed by per-map stats — the only ones the role view can scope.
export const ROLE_CATEGORIES = new Set([
  "best_rating",
  "best_adr",
  "best_kpr",
  "best_kast",
  "best_udr",
]);

// FACEIT ratings and Premier ranks are snapshots we cache from elsewhere, not
// anything derived from matches played here, so none of the match filters mean
// anything for them.
export const EXTERNAL_RANK_SOURCES: Record<string, string> = {
  faceit_elo: "FACEIT",
  premier_rank: "CS2 Premier",
};

export const AWARD_COLORS = {
  mvp: "hsl(195 85% 60%)",
  gold: "hsl(45 95% 60%)",
  silver: "hsl(0 0% 78%)",
  bronze: "hsl(28 70% 52%)",
};

export const PLACE_COLORS = [
  AWARD_COLORS.gold,
  AWARD_COLORS.silver,
  AWARD_COLORS.bronze,
];

const AWARD_FIELD_COLORS: Record<LeaderboardField, string> = {
  value: AWARD_COLORS.gold,
  secondary_value: AWARD_COLORS.silver,
  tertiary_value: AWARD_COLORS.bronze,
  matches_played: AWARD_COLORS.mvp,
};

export function formatLeaderboardValue(
  category: string,
  value: number | null | undefined,
): string {
  if (value == null) return "—";
  switch (category) {
    case "best_kdr":
    case "best_kpr":
    case "best_rating":
      return value.toFixed(2);
    case "best_adr":
    case "best_udr":
      return value.toFixed(1);
    case "best_win_rate":
    case "highest_hs_pct":
    case "best_kast":
      return value.toFixed(1) + "%";
    default:
      return Math.round(value).toLocaleString();
  }
}

export function formatLeaderboardField(
  category: string,
  field: LeaderboardField,
  value: number | null | undefined,
): string {
  if (field === "value") return formatLeaderboardValue(category, value);
  if (value == null) return "—";
  if (field === "secondary_value") {
    switch (category) {
      case "elo": {
        const rounded = Math.round(value);
        return (rounded >= 0 ? "+" : "") + rounded.toLocaleString();
      }
      case "best_rating":
        return value.toFixed(1); // secondary = ADR
      case "best_kast":
      case "best_adr":
      case "best_kpr":
        return value.toFixed(2); // secondary = rating / DPR
    }
  }
  return Math.round(value).toLocaleString();
}

// Award boards paint each medal column its medal's color; ELO tints the
// rating with its rank tier (Recruit → Apex), like the player ELO pill.
export function leaderboardFieldColor(
  category: string,
  field: LeaderboardField,
  value?: number | null,
): string | undefined {
  if (category === "awards") return AWARD_FIELD_COLORS[field];
  if (category === "elo" && field === "value") return eloTierColor(value);
  return undefined;
}

// Must match get_player_leaderboard_rank's RANK() order in the api, or a
// player's rank opens the wrong page.
export function leaderboardOrderBy(category: string) {
  if (category === "awards") {
    return [
      { matches_played: "desc" },
      { value: "desc" },
      { secondary_value: "desc" },
      { tertiary_value: "desc" },
    ];
  }
  return [{ value: "desc" }];
}

export function leaderboardFieldTier(
  category: string,
  field: LeaderboardField,
): StatTierConfig | undefined {
  return LEADERBOARD_CATEGORIES[category]?.tiers?.[field];
}
