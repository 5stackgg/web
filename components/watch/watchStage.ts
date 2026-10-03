import { currentMatchMap, teamMonogram } from "~/components/watch/watchTicker";

// Anti-cheat: a match's own players and coaches never get its stream on the
// stage -- they'd see the other side. Guests aren't in any lineup, so they
// keep the match (behind the login gate when one is required).
export function streamableMatches<T extends Record<string, any>>(rows: T[]) {
  return rows.filter(
    (m) => (m.streams?.length ?? 0) > 0 && !m.is_in_lineup && !m.is_coach,
  );
}

export function stageNeedsLogin(requireLogin: boolean, signedIn: boolean) {
  return requireLogin && !signedIn;
}

// The one-line phone score bug: "BB 1 · 10–8 · 0 ST", or "BB 10–8 ST" for a
// single map.
export function stageScoreBug(match: any): string {
  const current = currentMatchMap(match);
  const short = (lineup: any) =>
    lineup ? teamMonogram(lineup.name ?? lineup.team?.name ?? "", lineup.team?.short_name) : "?";
  const score = `${current?.lineup_1_score ?? 0}–${current?.lineup_2_score ?? 0}`;
  if ((match?.options?.best_of ?? 1) <= 1) {
    return `${short(match?.lineup_1)} ${score} ${short(match?.lineup_2)}`;
  }
  const won = (id: string) =>
    (match?.match_maps ?? []).filter((mm: any) => mm.winning_lineup_id === id)
      .length;
  return `${short(match?.lineup_1)} ${won(match?.lineup_1_id)} · ${score} · ${won(match?.lineup_2_id)} ${short(match?.lineup_2)}`;
}
