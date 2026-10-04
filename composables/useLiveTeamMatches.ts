import { computed, onBeforeUnmount, ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { $, order_by, Selector } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";
import { watchTickerMatchFields } from "~/graphql/watchTickerFields";
import { TICKER_LIVE_STATUSES } from "~/components/watch/watchTicker";

const liveLineupFields = Selector("match_lineups")({
  id: true,
  name: true,
  team_id: true,
  team: { id: true, name: true, short_name: true, avatar_url: true },
  lineup_players: [{}, { checked_in: true, captain: true }],
});

// Live matches between teams. Pickup games (no team on either side) stay on
// /watch; the teams page only follows teams.
const liveTeamMatchesQuery = generateSubscription({
  matches: [
    {
      where: {
        status: { _in: $("statuses", "[e_match_status_enum!]") },
        _or: [
          { lineup_1: { team_id: { _is_null: false } } },
          { lineup_2: { team_id: { _is_null: false } } },
        ],
      },
      order_by: [{ started_at: order_by.desc_nulls_last }],
      limit: 50,
    },
    {
      ...watchTickerMatchFields,
      lineup_1: liveLineupFields,
      lineup_2: liveLineupFields,
      tournament_brackets: [
        { limit: 1 },
        { stage: { tournament: { id: true, name: true, is_league: true } } },
      ],
    },
  ],
} as any);

// One subscription shared by every section on the page that needs it.
const matches = ref<any[]>([]);
const loaded = ref(false);
let users = 0;
let sub: { unsubscribe: () => void } | undefined;

export function useLiveTeamMatches() {
  const { client } = useApolloClient();

  if (typeof window !== "undefined") {
    users++;
    if (!sub) {
      sub = client
        .subscribe({
          query: liveTeamMatchesQuery,
          variables: { statuses: [...TICKER_LIVE_STATUSES] },
        })
        .subscribe({
          next: ({ data }: any) => {
            matches.value = data?.matches ?? [];
            loaded.value = true;
          },
          error: (error: any) => {
            console.error(
              "[teams] live team matches subscription error",
              error,
            );
            loaded.value = true;
          },
        });
    }
    onBeforeUnmount(() => {
      users--;
      if (users === 0) {
        sub?.unsubscribe();
        sub = undefined;
        matches.value = [];
        loaded.value = false;
      }
    });
  }

  // In play only: a team still checking in or in veto isn't "playing now".
  const liveTeamIds = computed(() => {
    const ids = new Set<string>();
    for (const match of matches.value) {
      if (match.status !== "Live") continue;
      if (match.lineup_1?.team_id) ids.add(match.lineup_1.team_id);
      if (match.lineup_2?.team_id) ids.add(match.lineup_2.team_id);
    }
    return ids;
  });

  return { matches, loaded, liveTeamIds };
}
