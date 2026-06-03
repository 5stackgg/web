// Valve rank types, as emitted by the demo parser (Player.RankType()):
//   6  = Wingman          (skill group 0–18, wingman*.svg)
//   7  = Competitive      (legacy single skill group 0–18, skillgroup*.svg)
//   12 = Competitive      (current CS2 per-map skill group 0–18)
//   11 = Premier          (numeric CS Rating, no icon)
//   10 = unranked/practice (ignored)
export type CsRankKind = "premier" | "competitive" | "wingman";

export function csRankKind(
  rankType: number | null | undefined,
): CsRankKind | null {
  switch (Number(rankType)) {
    case 11:
      return "premier";
    case 7:
    case 12:
      return "competitive";
    case 6:
      return "wingman";
    default:
      return null;
  }
}

// Skill-group icon for competitive / wingman. Premier has no icon (it's a
// numeric rating). Ranks clamp to the 0–18 art set in public/img/skillgroups.
export function csRankIcon(
  rankType: number | null | undefined,
  rank: number | null | undefined,
): string | null {
  const kind = csRankKind(rankType);
  if (kind === "premier" || kind === null) return null;
  const r = Math.max(0, Math.min(18, Math.round(Number(rank) || 0)));
  const prefix = kind === "wingman" ? "wingman" : "skillgroup";
  return `/img/skillgroups/${prefix}${r}.svg`;
}

const SKILL_GROUP_NAMES: Record<number, string> = {
  0: "Unranked",
  1: "Silver I",
  2: "Silver II",
  3: "Silver III",
  4: "Silver IV",
  5: "Silver Elite",
  6: "Silver Elite Master",
  7: "Gold Nova I",
  8: "Gold Nova II",
  9: "Gold Nova III",
  10: "Gold Nova Master",
  11: "Master Guardian I",
  12: "Master Guardian II",
  13: "Master Guardian Elite",
  14: "Distinguished Master Guardian",
  15: "Legendary Eagle",
  16: "Legendary Eagle Master",
  17: "Supreme Master First Class",
  18: "The Global Elite",
};

export function csRankName(
  rankType: number | null | undefined,
  rank: number | null | undefined,
): string | null {
  const kind = csRankKind(rankType);
  if (kind === "premier" || kind === null) return null;
  const r = Math.max(0, Math.min(18, Math.round(Number(rank) || 0)));
  return SKILL_GROUP_NAMES[r] ?? null;
}
