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
