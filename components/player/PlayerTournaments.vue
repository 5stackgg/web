<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronDown, ChevronUp, Flag, Shield } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { tournamentCardFields } from "~/graphql/tournamentCardFields";
import { excludeLeagueTournaments } from "~/graphql/tournamentFilters";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import WatchTournamentCard from "~/components/watch/WatchTournamentCard.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";
import FilterChip from "~/components/common/FilterChip.vue";
import { tournamentRowState } from "~/utilities/watchEventCard";
import {
  ordinal,
  tournamentPlayerRank,
} from "~/utilities/tournamentPlayerRank";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  playerSteamId: string | number;
}>();

// The raw column value; the enum member only exists once codegen has run
// against the check-in migration.
const CHECK_IN_REVIEW_STATUS = "CheckInReview" as e_tournament_status_enum;

const STATUSES = [
  e_tournament_status_enum.Live,
  e_tournament_status_enum.Paused,
  e_tournament_status_enum.RegistrationOpen,
  e_tournament_status_enum.RegistrationClosed,
  e_tournament_status_enum.Setup,
  CHECK_IN_REVIEW_STATUS,
  e_tournament_status_enum.Finished,
];

// A player's own tournaments stay a small set; one fetch covers the row and
// the expanded grid.
const LIMIT = 60;

type Filter = "all" | "live" | "upcoming" | "finished";
const STATE_ORDER = { live: 0, upcoming: 1, finished: 2 } as const;

const tournaments = ref<any[]>([]);
const expanded = ref(false);
const filter = ref<Filter>("all");
// The scroll row while collapsed; a plain grid element once expanded.
const scrollRef = ref<any>(null);

async function fetchTournaments() {
  const steamId = String(props.playerSteamId);
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        tournaments: [
          {
            where: $("where", "tournaments_bool_exp!"),
            order_by: [{ start: order_by.desc }],
            limit: LIMIT,
          } as any,
          {
            ...tournamentCardFields,
            stages: [
              { order_by: [{ order: order_by.asc }] } as any,
              {
                order: true,
                max_teams: true,
                results: [
                  {} as any,
                  {
                    rank: true,
                    tournament_team_id: true,
                    team: {
                      name: true,
                      team: { name: true, short_name: true },
                    },
                  },
                ],
              },
            ],
            rosters: [
              {
                where: { player_steam_id: { _eq: steamId } },
                limit: 1,
              } as any,
              {
                tournament_team_id: true,
                tournament_team: { name: true, team: { name: true } },
              },
            ],
          },
        ],
      } as any),
      variables: {
        where: excludeLeagueTournaments({
          status: { _in: STATUSES },
          rosters: { player_steam_id: { _eq: steamId } },
        }),
      },
      fetchPolicy: "network-only",
    });
    tournaments.value = (data as any)?.tournaments ?? [];
  } catch (error) {
    console.error("[player-tournaments] fetch error:", error);
  }
}

fetchTournaments();
watch(() => props.playerSteamId, fetchTournaments);

function teamName(tournament: any): string | null {
  const team = tournament.rosters?.[0]?.tournament_team;
  return team?.team?.name || team?.name || null;
}

function finish(tournament: any, state: string) {
  if (state !== "finished") return null;
  const rank = tournamentPlayerRank(tournament);
  if (!rank) return null;
  return {
    place: ordinal(rank),
    count: tournament.teams_aggregate?.aggregate?.count ?? 0,
  };
}

// Live first, then what's coming up soonest, then results newest first.
const sorted = computed(() =>
  tournaments.value
    .map((tournament) => {
      const state = tournamentRowState(tournament.status);
      return {
        tournament,
        state,
        finish: finish(tournament, state),
        team: teamName(tournament),
      };
    })
    .sort((a, b) => {
      if (a.state !== b.state) {
        return STATE_ORDER[a.state] - STATE_ORDER[b.state];
      }
      const ta = new Date(a.tournament.start || 0).getTime();
      const tb = new Date(b.tournament.start || 0).getTime();
      return a.state === "upcoming" ? ta - tb : tb - ta;
    }),
);

const liveCount = computed(
  () => sorted.value.filter((row) => row.state === "live").length,
);
const upcomingCount = computed(
  () => sorted.value.filter((row) => row.state === "upcoming").length,
);

const visible = computed(() =>
  expanded.value && filter.value !== "all"
    ? sorted.value.filter((row) => row.state === filter.value)
    : sorted.value,
);

const canExpand = computed(() => sorted.value.length > 2);

function toggleExpanded() {
  expanded.value = !expanded.value;
  filter.value = "all";
}
</script>

<template>
  <section v-if="sorted.length">
    <div
      :class="[
        tacticalSectionLabelClasses,
        '!flex w-full items-center justify-between',
      ]"
    >
      <span class="inline-flex items-center gap-3">
        <span class="inline-flex items-center gap-2">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.players.detail.tournaments_section_label") }}
        </span>
        <button
          v-if="canExpand"
          type="button"
          class="inline-flex items-center gap-1 text-xs normal-case tracking-normal text-muted-foreground transition-colors hover:text-foreground"
          :aria-expanded="expanded"
          @click="toggleExpanded"
        >
          {{
            expanded
              ? $t("pages.players.detail.show_less")
              : $t("common.see_all")
          }}
          <component
            :is="expanded ? ChevronUp : ChevronDown"
            class="h-3 w-3"
          />
        </button>
      </span>
      <ScrollArrows
        v-if="!expanded"
        :can-left="scrollRef?.state?.canScrollLeft"
        :can-right="scrollRef?.state?.canScrollRight"
        @scroll="(direction) => scrollRef?.scrollByDirection(direction)"
      />
    </div>

    <div v-if="expanded" class="mb-3 flex flex-wrap items-center gap-2">
      <FilterChip
        :active="filter === 'all'"
        :label="$t('pages.tournaments.filter.status_all')"
        @toggle="filter = 'all'"
      />
      <FilterChip
        v-if="liveCount"
        :active="filter === 'live'"
        :label="`${$t('pages.tournaments.filter.status_live')} · ${liveCount}`"
        @toggle="filter = 'live'"
      />
      <FilterChip
        v-if="upcomingCount"
        :active="filter === 'upcoming'"
        :label="`${$t('pages.tournaments.filter.status_upcoming')} · ${upcomingCount}`"
        @toggle="filter = 'upcoming'"
      />
      <FilterChip
        :active="filter === 'finished'"
        :label="$t('pages.tournaments.filter.status_finished')"
        @toggle="filter = 'finished'"
      />
    </div>

    <component
      :is="expanded ? 'div' : HorizontalScrollRow"
      ref="scrollRef"
      :class="{ 'grid gap-3 lg:grid-cols-2': expanded }"
    >
      <WatchTournamentCard
        v-for="row in visible"
        :key="row.tournament.id"
        :tournament="row.tournament"
        hide-champion
        :class="{
          'w-[85vw] max-w-[34rem] shrink-0 snap-start sm:w-[34rem]': !expanded,
        }"
      >
        <template #facts>
          <li v-if="row.finish" class="flex items-center gap-1.5 tabular-nums">
            <Flag class="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              <span class="font-bold text-foreground">{{
                row.finish.place
              }}</span>
              {{
                $t("pages.players.detail.tournament_finish_of", {
                  count: row.finish.count,
                })
              }}
            </span>
          </li>
          <li v-if="row.team" class="flex min-w-0 items-center gap-1.5">
            <Shield class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ row.team }}</span>
          </li>
        </template>
      </WatchTournamentCard>
    </component>
  </section>
</template>
