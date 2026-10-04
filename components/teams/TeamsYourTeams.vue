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
import { useAuthStore } from "~/stores/AuthStore";
import {
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
let sub: { unsubscribe: () => void } | undefined;

watch(
  () => auth.me?.steam_id,
  (steamId) => {
    sub?.unsubscribe();
    sub = undefined;
    teams.value = [];
    emit("team-ids", []);
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
  <section v-if="teams.length" aria-labelledby="teams-yours-label">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2
        id="teams-yours-label"
        :class="[tacticalSectionLabelClasses, '!mb-0']"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.teams.your_teams.title") }}
      </h2>
      <Button
        as-child
        size="sm"
        variant="outline"
        class="relative h-8 gap-1.5 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden"
      >
        <NuxtLink :to="{ name: 'teams-create' }">
          <PlusCircle class="size-3.5" />
          {{ $t("pages.teams.create") }}
        </NuxtLink>
      </Button>
    </div>

    <div
      class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]"
    >
      <TeamsYourTeamCard
        v-for="team in teams"
        :key="team.id"
        :team="team"
        :now="now"
      />
    </div>
  </section>
</template>
