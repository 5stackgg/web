<script lang="ts" setup>
import { ArrowRight, UsersIcon } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <NuxtLink
    :to="{
      name: 'tournaments-tournamentId',
      params: { tournamentId: tournament.id },
    }"
    class="relative w-80 h-48 overflow-hidden rounded-lg cursor-pointer block"
  >
    <div
      class="flex w-full h-full transition-transform duration-300 hover:scale-105"
    >
      <MapDisplay
        class="rounded-none"
        v-for="map of tournament.options?.map_pool?.maps || []"
        :key="map.id"
        :map="map"
        :patch="false"
      ></MapDisplay>
    </div>
    <div
      class="absolute inset-0 bg-black bg-opacity-50 flex flex-col p-4 justify-between hover:bg-opacity-10 duration-300"
    >
      <div class="flex flex-col gap-2 w-full">
        <!-- Status on top row -->
        <div class="flex justify-between items-start w-full">
          <Badge class="text-xs">{{
            tournament.e_tournament_status.description
          }}</Badge>
          <ArrowRight></ArrowRight>
        </div>
        <!-- Type and Stage on second row -->
        <div class="flex flex-wrap gap-1.5">
          <Badge
            variant="secondary"
            class="text-xs bg-black/70 text-white border-0 backdrop-blur-sm"
          >
            {{ tournament.options?.type }}
          </Badge>
          <Badge
            v-if="stageCount > 1"
            variant="outline"
            class="text-xs bg-black/70 text-white border-white/30 backdrop-blur-sm"
          >
            {{ stageCount }} {{ $t("tournament.stage.stages") }}
          </Badge>
          <Badge
            v-if="singleStageType"
            variant="outline"
            class="text-xs bg-black/70 text-white border-white/30 backdrop-blur-sm"
          >
            {{ singleStageType }}
          </Badge>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-center space-x-2 font-semibold">
          {{ tournament.name }}
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <TimeAgo
              :date="tournament.start"
              class="text-sm text-gray-600 dark:text-gray-400"
            ></TimeAgo>
          </div>
          <div
            v-if="tournament.teams_aggregate?.aggregate?.count !== undefined"
            class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
          >
            <UsersIcon class="h-3.5 w-3.5" />
            <span>
              {{ tournament.teams_aggregate.aggregate.count }}
              {{ $t("tournament.table.teams_joined") }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    e_match_types: {
      fetchPolicy: "cache-first",
      query: generateQuery({
        e_match_types: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
  },
  computed: {
    tournamentTypeDescription() {
      if (!this.tournament?.options?.type || !this.e_match_types?.length) {
        return this.tournament?.options?.type || "";
      }
      const matchType = this.e_match_types.find(
        (type: any) => type.value === this.tournament.options.type,
      );
      return matchType?.description || this.tournament.options.type;
    },
    stageCount() {
      return this.tournament?.stages?.length || 0;
    },
    singleStageType() {
      if (
        this.stageCount === 1 &&
        this.tournament?.stages?.[0]?.e_tournament_stage_type
      ) {
        return this.tournament.stages[0].e_tournament_stage_type.description;
      }
      return null;
    },
  },
};
</script>
