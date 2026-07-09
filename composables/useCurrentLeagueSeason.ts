import { computed, effectScope, ref, watch } from "vue";
import { LEAGUE_SEASONS_LIST_SUBSCRIPTION } from "~/graphql/leagues";
import {
  pickCurrentSeason,
  type LeagueSeasonRef,
} from "~/utilities/leagueSeason";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const seasons = ref<LeagueSeasonRef[]>([]);
let started = false;

export function useCurrentLeagueSeason() {
  if (import.meta.client && !started) {
    started = true;
    const apolloClient = useApolloClient().client;
    const settings = useApplicationSettingsStore();

    let sub: { unsubscribe: () => void } | null = null;

    effectScope(true).run(() => {
      watch(
        () => settings.leaguesEnabled,
        (enabled) => {
          sub?.unsubscribe();
          sub = null;
          seasons.value = [];
          if (!enabled) {
            return;
          }

          sub = apolloClient
            .subscribe({ query: LEAGUE_SEASONS_LIST_SUBSCRIPTION })
            .subscribe({
              next: ({ data }: any) => {
                seasons.value = data?.league_seasons ?? [];
              },
            });
        },
        { immediate: true },
      );
    });
  }

  const currentSeason = computed(() => pickCurrentSeason(seasons.value));

  const currentSeasonTo = computed(() =>
    currentSeason.value
      ? {
          name: "league-seasons-seasonId",
          params: { seasonId: currentSeason.value.id },
        }
      : { name: "league" },
  );

  return { seasons, currentSeason, currentSeasonTo };
}
