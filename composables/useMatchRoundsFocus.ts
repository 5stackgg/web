// Fix a Problem and a map card's restore button both hand a match over to the
// Rounds tab with a round already picked, so the two never drift apart.
export function useMatchRoundsFocus() {
  const request = useState<{
    matchId: string;
    round: number | null;
    at: number;
  } | null>("match-rounds-focus", () => null);

  function focus(matchId: string, round: number | null = null) {
    request.value = { matchId, round, at: Date.now() };
  }

  return { request, focus };
}
