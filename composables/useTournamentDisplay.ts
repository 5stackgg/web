import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { e_tournament_status_enum } from "~/generated/zeus";
import { formatPrizePool } from "~/utilities/prizePool";
import { tournamentMapPosters } from "~/utilities/tournamentMapPosters";
import {
  matchTypeLabel,
  tournamentChampion,
  tournamentRowState,
} from "~/utilities/watchEventCard";

// Status and category descriptions come from the database in title case;
// keep acronyms (LAN) and lower the rest so the line reads as a sentence.
export function sentenceCase(value: string) {
  return value
    .split(" ")
    .map((word, index) =>
      index === 0 || word === word.toUpperCase() ? word : word.toLowerCase(),
    )
    .join(" ");
}

// The bits every tournament surface on /tournaments shows, read the same way
// WatchTournamentCard reads them.
export function useTournamentDisplay(source: () => any) {
  const { t } = useI18n();
  const runtimeConfig = useRuntimeConfig();
  const tournament = computed(source);

  const state = computed(() => tournamentRowState(tournament.value?.status));
  const paused = computed(
    () => tournament.value?.status === e_tournament_status_enum.Paused,
  );
  const registrationOpen = computed(
    () =>
      tournament.value?.status === e_tournament_status_enum.RegistrationOpen,
  );

  const bannerSrc = computed(() => {
    if (tournament.value?.banner) {
      return `https://${runtimeConfig.public.apiDomain}/${tournament.value.banner}`;
    }
    return tournamentMapPosters(tournament.value, 1)[0] ?? null;
  });

  const statusLabel = computed(() => {
    if (state.value === "live" && !paused.value) return t("event.phase.live");
    const description = tournament.value?.e_tournament_status?.description;
    return description ? sentenceCase(description) : null;
  });

  const categories = computed(() =>
    (tournament.value?.categories || [])
      .map((category: any) =>
        sentenceCase(
          category.e_tournament_category?.description ?? category.category,
        ),
      )
      .slice(0, 2),
  );

  const sub = computed(() => {
    const parts: string[] = [];
    const organizer =
      tournament.value?.organizer_teams?.[0]?.team?.name ||
      tournament.value?.admin?.name;
    if (organizer) {
      parts.push(t("pages.watch.tournaments.by", { name: organizer }));
    }
    parts.push(matchTypeLabel(tournament.value?.options?.type));
    if (tournament.value?.options?.best_of) {
      parts.push(
        t("pages.watch.tournaments.best_of", {
          count: tournament.value.options.best_of,
        }),
      );
    }
    return parts.join(" · ");
  });

  const teams = computed(
    () => tournament.value?.teams_aggregate?.aggregate?.count ?? 0,
  );
  const maxTeams = computed(
    () => tournament.value?.stages?.[0]?.max_teams ?? 0,
  );
  const teamsLabel = computed(() => {
    if (maxTeams.value > 0) {
      return `${t("pages.watch.tournaments.registered_count", {
        count: teams.value,
        max: maxTeams.value,
      })} ${t("pages.watch.events.count_teams", maxTeams.value)}`;
    }
    return `${teams.value} ${t("pages.watch.events.count_teams", teams.value)}`;
  });
  const spotsLeft = computed(() => Math.max(0, maxTeams.value - teams.value));

  const prizePool = computed(() => formatPrizePool(tournament.value?.prizes));
  const champion = computed(() =>
    state.value === "finished" ? tournamentChampion(tournament.value) : null,
  );

  const start = computed(() =>
    tournament.value?.start ? new Date(tournament.value.start) : null,
  );
  const startDay = computed(() =>
    start.value
      ? new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }).format(start.value)
      : null,
  );
  const startTime = computed(() =>
    start.value
      ? new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }).format(start.value)
      : null,
  );

  return {
    state,
    paused,
    registrationOpen,
    bannerSrc,
    statusLabel,
    categories,
    sub,
    teams,
    maxTeams,
    teamsLabel,
    spotsLeft,
    prizePool,
    champion,
    start,
    startDay,
    startTime,
  };
}
