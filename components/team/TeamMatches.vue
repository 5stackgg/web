<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import gql from "graphql-tag";
import { useApolloClient } from "@vue/apollo-composable";
import { $, order_by, Selector } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { teamMatchesFilter } from "~/graphql/teamPulseFields";
import PlayerMatchesTable from "~/components/player/PlayerMatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import TeamCalendarButton from "~/components/team/TeamCalendarButton.vue";
import { Skeleton } from "~/components/ui/skeleton";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { usePerPage } from "~/composables/usePerPage";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// The team's matches as the player profile shows a player's: the same rows,
// read from the team's side.
const props = defineProps<{ teamId: string }>();

const { client } = useApolloClient();

// A row needs the team's side (who played, for the roster column and the
// stats) and the opponent's team -- never each member's elo, which via
// playerFields would run get_player_elo() for every player on the page.
const teamMatchLineup = Selector("match_lineups")({
  id: true,
  name: true,
  team_id: true,
  team: { name: true, short_name: true, avatar_url: true },
  lineup_players: [
    {},
    {
      steam_id: true,
      player: { steam_id: true, name: true, avatar_url: true },
    },
  ],
});

const TEAM_MATCHES_QUERY = generateQuery({
  matches: [
    {
      where: teamMatchesFilter,
      limit: $("limit", "Int!"),
      offset: $("offset", "Int!"),
      order_by: [
        { effective_at: order_by.desc_nulls_last },
        { created_at: order_by.desc },
      ],
    },
    {
      ...simpleMatchFields,
      lineup_1: teamMatchLineup,
      lineup_2: teamMatchLineup,
      tournament_brackets: [
        { limit: 1 },
        {
          round: true,
          match_number: true,
          stage: {
            order: true,
            e_tournament_stage_type: { description: true },
            tournament: { id: true, name: true },
          },
          team_1: { team_id: true },
          team_2: { team_id: true },
        },
      ],
    },
  ],
  matches_aggregate: [
    { where: teamMatchesFilter },
    { aggregate: { count: true } },
  ],
} as any);

// Every team player's aggregate and rating for the page's matches in one
// request; both views are indexed on (steam_id, match_id).
const TEAM_MATCH_STATS_QUERY = gql`
  query TeamMatchStats($steamIds: [bigint!]!, $matchIds: [uuid!]!) {
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

const page = ref(1);
const perPage = usePerPage("team-matches");
const matches = ref<any[]>([]);
const total = ref(0);
const statsByMatch = ref(new Map<string, any>());
const ratingByMatch = ref(new Map<string, number>());
const fetching = ref(true);
const { skeleton, refreshing, loaded } = useDeferredLoading(
  () => fetching.value,
);

// The team's lineup: by team_id, else by the tournament bracket side.
function teamLineup(match: any): any | null {
  if (match?.lineup_1?.team_id === props.teamId) return match.lineup_1;
  if (match?.lineup_2?.team_id === props.teamId) return match.lineup_2;
  const bracket = match?.tournament_brackets?.[0];
  if (bracket?.team_1?.team_id === props.teamId) return match.lineup_1;
  if (bracket?.team_2?.team_id === props.teamId) return match.lineup_2;
  return null;
}

// Sums for K/D/A and damage (so ADR is damage over every player's rounds),
// and the mean of the players' match ratings.
async function loadStats(current: number) {
  const sides = new Map<string, Set<string>>();
  for (const match of matches.value) {
    const ids = (teamLineup(match)?.lineup_players ?? [])
      .map((lp: any) => String(lp.steam_id ?? lp.player?.steam_id ?? ""))
      .filter(Boolean);
    if (ids.length) sides.set(String(match.id), new Set(ids));
  }
  if (!sides.size) {
    statsByMatch.value = new Map();
    ratingByMatch.value = new Map();
    return;
  }
  try {
    const { data } = await client.query({
      query: TEAM_MATCH_STATS_QUERY,
      variables: {
        steamIds: [...new Set([...sides.values()].flatMap((s) => [...s]))],
        matchIds: [...sides.keys()],
      },
      fetchPolicy: "network-only",
    });
    if (current !== generation) return;
    const stats = new Map<string, any>();
    for (const row of (data as any)?.player_match_stats_v ?? []) {
      const matchId = String(row.match_id);
      if (!sides.get(matchId)?.has(String(row.steam_id))) continue;
      const sum = stats.get(matchId) ?? {
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        rounds_played: 0,
      };
      sum.kills += row.kills ?? 0;
      sum.deaths += row.deaths ?? 0;
      sum.assists += row.assists ?? 0;
      sum.damage += row.damage ?? 0;
      sum.rounds_played += row.rounds_played ?? 0;
      stats.set(matchId, sum);
    }
    const ratingSums = new Map<string, { total: number; count: number }>();
    for (const row of (data as any)?.v_player_match_rating ?? []) {
      const matchId = String(row.match_id);
      if (row.hltv_rating == null) continue;
      if (!sides.get(matchId)?.has(String(row.steam_id))) continue;
      const sum = ratingSums.get(matchId) ?? { total: 0, count: 0 };
      sum.total += Number(row.hltv_rating);
      sum.count += 1;
      ratingSums.set(matchId, sum);
    }
    statsByMatch.value = stats;
    ratingByMatch.value = new Map(
      [...ratingSums].map(([id, sum]) => [id, sum.total / sum.count]),
    );
  } catch (error) {
    console.error("[team-matches] stats query error", error);
  }
}

// Bumped on every load so a slow page can't land over a newer one.
let generation = 0;
async function load() {
  if (typeof window === "undefined") return;
  const current = ++generation;
  fetching.value = true;
  try {
    const { data } = await client.query({
      query: TEAM_MATCHES_QUERY,
      variables: {
        teamId: props.teamId,
        limit: perPage.value,
        offset: (page.value - 1) * perPage.value,
      },
      fetchPolicy: "network-only",
    });
    if (current !== generation) return;
    matches.value = (data as any)?.matches ?? [];
    total.value = (data as any)?.matches_aggregate?.aggregate?.count ?? 0;
    void loadStats(current);
  } catch (error) {
    console.error("[team-matches] query error", error);
  } finally {
    if (current === generation) fetching.value = false;
  }
}

watch(
  () => props.teamId,
  () => {
    page.value = 1;
  },
);
watch([() => props.teamId, page, perPage], () => void load(), {
  immediate: true,
});
onBeforeUnmount(() => {
  generation++;
});

function onPerPage(value: number) {
  perPage.value = value;
  page.value = 1;
}
</script>

<template>
  <section aria-labelledby="team-matches-label">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2
        id="team-matches-label"
        :class="[tacticalSectionLabelClasses, '!mb-0 !flex']"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("match.recent.title") }}
      </h2>
      <TeamCalendarButton :team-id="teamId" />
    </div>

    <!-- First load: rows at their real height, held long enough not to
         blink; nothing at all while a fast answer is still on its way. -->
    <div v-if="!loaded" class="space-y-1.5" aria-busy="true">
      <template v-if="skeleton">
        <Skeleton v-for="i in 5" :key="i" class="h-14 w-full rounded-lg" />
      </template>
    </div>

    <p
      v-else-if="!matches.length"
      class="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground"
    >
      {{ $t("team.pulse.hero.no_matches") }}
    </p>

    <div
      v-else
      class="transition-opacity duration-150"
      :class="refreshing ? 'pointer-events-none opacity-50' : ''"
    >
      <PlayerMatchesTable
        :matches="matches"
        :team-id="teamId"
        :rating-by-match="ratingByMatch"
        :stats-by-match="statsByMatch"
      />
      <Pagination
        class="mt-3"
        :page="page"
        :per-page="perPage"
        :total="total"
        show-per-page-selector
        @page="(p: number) => (page = p)"
        @update:perPage="onPerPage"
      />
    </div>
  </section>
</template>
