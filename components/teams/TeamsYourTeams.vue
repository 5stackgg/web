<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { PlusCircle } from "lucide-vue-next";
import { $, order_by, Selector } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";
import { teamResultMatchFields } from "~/graphql/teamPulseFields";
import { TICKER_LIVE_STATUSES } from "~/components/watch/watchTicker";
import { Button } from "~/components/ui/button";
import TeamsYourTeamCard from "~/components/teams/TeamsYourTeamCard.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import { lastYourTeams } from "~/utilities/teamsListCache";
import { useAuthStore } from "~/stores/AuthStore";
import {
  listCreateButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const emit = defineEmits<{ (e: "team-ids", ids: string[]): void }>();

const { client } = useApolloClient();
const auth = useAuthStore();

const lineupFields = Selector("match_lineups")({
  id: true,
  team_id: true,
  name: true,
});

const yourTeamsQuery = generateSubscription({
  teams: [
    {
      where: {
        _or: [
          { owner_steam_id: { _eq: $("steamId", "bigint!") } },
          { roster: { player_steam_id: { _eq: $("steamId", "bigint!") } } },
        ],
      },
      order_by: [{ name: order_by.asc }],
    },
    {
      id: true,
      name: true,
      short_name: true,
      avatar_url: true,
      can_manage_scrims: true,
      can_invite: true,
      roster: [{}, { status: true, player: { steam_id: true, name: true } }],
      __alias: {
        live_matches: {
          matches: [
            {
              where: {
                status: { _in: $("live", "[e_match_status_enum!]") },
              },
              order_by: [{ started_at: order_by.desc_nulls_last }],
              limit: 1,
            },
            {
              id: true,
              status: true,
              scheduled_at: true,
              options: { best_of: true, type: true },
              lineup_1: lineupFields,
              lineup_2: lineupFields,
              tournament_brackets: [
                { limit: 1 },
                { stage: { tournament: { id: true, name: true } } },
              ],
            },
          ],
        },
        next_matches: {
          matches: [
            {
              where: {
                status: { _in: $("upcoming", "[e_match_status_enum!]") },
              },
              order_by: [{ scheduled_at: order_by.asc_nulls_last }],
              limit: 1,
            },
            {
              id: true,
              status: true,
              scheduled_at: true,
              options: { best_of: true, type: true },
              lineup_1: lineupFields,
              lineup_2: lineupFields,
              tournament_brackets: [
                { limit: 1 },
                { stage: { tournament: { id: true, name: true } } },
              ],
            },
          ],
        },
        last_matches: {
          matches: [
            {
              where: { status: { _eq: $("finished", "e_match_status_enum!") } },
              order_by: [{ ended_at: order_by.desc_nulls_last }],
              limit: 1,
            },
            {
              ...teamResultMatchFields,
              options: { best_of: true },
              match_maps: [
                { order_by: [{ order: order_by.asc }] },
                {
                  lineup_1_score: true,
                  lineup_2_score: true,
                  winning_lineup_id: true,
                },
              ],
            },
          ],
        },
      },
    },
  ],
} as any);

const teams = ref<any[]>([]);
// Whether this player's teams are known yet. Until then a signed-in player gets
// the section's outline, so the page below sits where it will end up.
const loaded = ref(false);
let sub: { unsubscribe: () => void } | undefined;

watch(
  () => auth.me?.steam_id,
  (steamId) => {
    sub?.unsubscribe();
    sub = undefined;
    const cached = steamId ? lastYourTeams.get(String(steamId)) : undefined;
    teams.value = cached ?? [];
    loaded.value = !!cached;
    emit(
      "team-ids",
      teams.value.map((team) => team.id),
    );
    if (!steamId || typeof window === "undefined") return;
    sub = client
      .subscribe({
        query: yourTeamsQuery,
        variables: {
          steamId,
          live: [...TICKER_LIVE_STATUSES],
          upcoming: ["Scheduled"],
          finished: "Finished",
        },
      })
      .subscribe({
        next: ({ data }: any) => {
          teams.value = data?.teams ?? [];
          loaded.value = true;
          lastYourTeams.set(String(steamId), teams.value);
          emit(
            "team-ids",
            teams.value.map((team) => team.id),
          );
        },
        error: (error: any) => {
          console.error("[teams] your teams subscription error", error);
        },
      });
  },
  { immediate: true },
);

// "Next" times ("Sat 6:00 PM") tick along with the clock.
const now = ref(new Date());
const clock =
  typeof window !== "undefined"
    ? setInterval(() => (now.value = new Date()), 60_000)
    : null;

onBeforeUnmount(() => {
  sub?.unsubscribe();
  if (clock) clearInterval(clock);
});
</script>

<template>
  <section
    v-if="teams.length || (!loaded && auth.me)"
    aria-labelledby="teams-yours-label"
    :aria-busy="!loaded"
  >
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2
        id="teams-yours-label"
        :class="[tacticalSectionLabelClasses, '!mb-0']"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.teams.your_teams.title") }}
      </h2>
      <Button as-child size="sm" :class="listCreateButtonClasses">
        <NuxtLink
          :to="{ name: 'teams-create' }"
          :title="$t('pages.teams.create')"
        >
          <PlusCircle class="h-4 w-4" />
          <span class="max-md:sr-only">{{ $t("pages.teams.create") }}</span>
        </NuxtLink>
      </Button>
    </div>

    <div
      class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]"
    >
      <template v-if="!teams.length">
        <Skeleton v-for="i in 2" :key="i" class="h-[4.75rem] rounded-lg" />
      </template>
      <TeamsYourTeamCard
        v-for="team in teams"
        :key="team.id"
        :team="team"
        :now="now"
      />
    </div>
  </section>
</template>
