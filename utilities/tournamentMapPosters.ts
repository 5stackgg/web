// Bannerless tournaments fall back to their map pool as artwork — pull the
// posters off the tournament options first, then any stage overrides.
export function tournamentMapPosters(tournament: any, limit = 7): string[] {
  const pools = [
    tournament?.options?.map_pool?.maps,
    ...(tournament?.stages || []).map((stage: any) => stage?.options?.map_pool?.maps),
  ];

  const seen = new Set<string>();
  const posters: string[] = [];

  for (const maps of pools) {
    for (const map of maps || []) {
      const poster = map?.poster;
      if (!poster || seen.has(poster)) {
        continue;
      }
      seen.add(poster);
      posters.push(poster);
      if (posters.length >= limit) {
        return posters;
      }
    }
  }

  return posters;
}
