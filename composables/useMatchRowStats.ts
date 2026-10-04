import { computed, ref, watch, type Ref } from "vue";
import gql from "graphql-tag";
import { useApolloClient } from "@vue/apollo-composable";
import { e_match_status_enum } from "~/generated/zeus";

// Every listed player's aggregate and rating for a page of matches in one
// request; both views are indexed on (steam_id, match_id).
const MATCH_ROW_STATS_QUERY = gql`
  query MatchRowStats($steamIds: [bigint!]!, $matchIds: [uuid!]!) {
    player_match_stats_v(
      where: { steam_id: { _in: $steamIds }, match_id: { _in: $matchIds } }
    ) {
      match_id
      steam_id
      kills
      deaths
      assists
      damage
      rounds_played
    }
    v_player_match_rating(
      where: { steam_id: { _in: $steamIds }, match_id: { _in: $matchIds } }
    ) {
      match_id
      steam_id
      hltv_rating
    }
  }
`;

// The numbers PlayerMatchesTable rows show when a list isn't read from the
// page's own player or team (event and tournament lists): each finished
// match's top player by rating, or, given a focus steam id, that player's line.
export function useMatchRowStats(
  matches: Ref<any[]>,
  focusSteamId: Ref<string | null>,
) {
  const { client } = useApolloClient();

  const statsByMatch = ref(new Map<string, any>());
  const ratingByMatch = ref(new Map<string, number>());
  const topPlayerByMatch = ref(new Map<string, any>());

  // match id -> steam id -> player, for the finished matches on the page.
  const playersByMatch = computed(() => {
    const focus = focusSteamId.value;
    const byMatch = new Map<string, Map<string, any>>();
    for (const match of matches.value) {
      if (match?.status !== e_match_status_enum.Finished) continue;
      const players = new Map<string, any>();
      for (const lineup of [match.lineup_1, match.lineup_2]) {
        for (const lp of lineup?.lineup_players ?? []) {
          const steamId = String(lp.steam_id ?? lp.player?.steam_id ?? "");
          if (steamId && (!focus || steamId === focus)) {
            players.set(steamId, lp.player ?? { steam_id: steamId });
          }
        }
      }
      if (players.size) byMatch.set(String(match.id), players);
    }
    return byMatch;
  });

  // Bumped on every load so a slow page can't land over a newer one.
  let generation = 0;
  async function load() {
    const current = ++generation;
    const byMatch = playersByMatch.value;
    if (!byMatch.size) {
      statsByMatch.value = new Map();
      ratingByMatch.value = new Map();
      topPlayerByMatch.value = new Map();
      return;
    }
    try {
      const { data } = await client.query({
        query: MATCH_ROW_STATS_QUERY,
        variables: {
          steamIds: [
            ...new Set([...byMatch.values()].flatMap((p) => [...p.keys()])),
          ],
          matchIds: [...byMatch.keys()],
        },
        fetchPolicy: "network-only",
      });
      if (current !== generation) return;

      const rowKey = (row: any) => `${row.match_id}:${row.steam_id}`;
      const ratings = new Map<string, number>();
      for (const row of (data as any)?.v_player_match_rating ?? []) {
        if (row.hltv_rating != null) {
          ratings.set(rowKey(row), Number(row.hltv_rating));
        }
      }

      // The top line per match: highest rating, then most kills.
      const best = new Map<string, { row: any; player: any; rating: number }>();
      for (const row of (data as any)?.player_match_stats_v ?? []) {
        const matchId = String(row.match_id);
        const player = byMatch.get(matchId)?.get(String(row.steam_id));
        if (!player) continue;
        const rating = ratings.get(rowKey(row)) ?? -Infinity;
        const leader = best.get(matchId);
        if (
          !leader ||
          rating > leader.rating ||
          (rating === leader.rating &&
            (row.kills ?? 0) > (leader.row.kills ?? 0))
        ) {
          best.set(matchId, { row, player, rating });
        }
      }
      const stats = new Map<string, any>();
      const rating = new Map<string, number>();
      const top = new Map<string, any>();
      for (const [matchId, line] of best) {
        stats.set(matchId, line.row);
        top.set(matchId, line.player);
        if (Number.isFinite(line.rating)) rating.set(matchId, line.rating);
      }
      statsByMatch.value = stats;
      ratingByMatch.value = rating;
      topPlayerByMatch.value = top;
    } catch (error) {
      console.error("[match-row-stats] query error", error);
    }
  }

  watch(
    () =>
      `${focusSteamId.value}|${[...playersByMatch.value]
        .map(([id, players]) => `${id}:${players.size}`)
        .join(",")}`,
    () => void load(),
    { immediate: true },
  );

  return { statsByMatch, ratingByMatch, topPlayerByMatch };
}
