import { ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { toast } from "@/components/ui/toast";
import {
  CREATE_SEASON_MUTATION,
  CREATE_MATCH_OPTIONS_MUTATION,
  MAP_POOLS_QUERY,
} from "~/graphql/leagues";
import type { NewSeasonInput } from "~/components/league/LeagueSeasonForm.vue";

// Shared season-create flow (map pool -> match options -> season) used by the
// leagues landing empty state and the season page's create button.
export function useLeagueSeasonCreate(onCreated?: (seasonId: string) => void) {
  const { client } = useApolloClient();
  const { t } = useI18n();
  const showCreateModal = ref(false);
  const creatingSeason = ref(false);

  async function createSeason(season: NewSeasonInput) {
    creatingSeason.value = true;
    try {
      // League matches stay dormant until scheduled, so the season template is
      // always admin-mode. Uses the seeded competitive map pool.
      const pools = await client.query({
        query: MAP_POOLS_QUERY,
        fetchPolicy: "network-only",
      });
      const pool =
        pools.data?.map_pools?.find((p: any) => p.type === "Competitive") ??
        pools.data?.map_pools?.[0];
      if (!pool) {
        throw new Error(t("league.season_form.no_map_pool"));
      }

      const options = await client.mutate({
        mutation: CREATE_MATCH_OPTIONS_MUTATION,
        variables: { mapPoolId: pool.id },
      });
      const matchOptionsId = options.data?.insert_match_options_one?.id;

      // Roster sizing is a league-wide setting; stamp it onto the season.
      const settings = useApplicationSettingsStore();

      const { match_weeks, ...rest } = season;
      const { data } = await client.mutate({
        mutation: CREATE_SEASON_MUTATION,
        variables: {
          season: {
            ...rest,
            match_options_id: matchOptionsId,
            min_roster_size: settings.teamMinRosterSize,
            max_roster_size: settings.teamMaxRosterSize,
            match_weeks: { data: match_weeks },
          },
        },
      });
      toast({ title: t("league.season_form.created") });
      showCreateModal.value = false;
      onCreated?.(data?.insert_league_seasons_one?.id);
    } catch (error: any) {
      toast({ title: error?.message ?? String(error), variant: "destructive" });
    } finally {
      creatingSeason.value = false;
    }
  }

  return { showCreateModal, creatingSeason, createSeason };
}
