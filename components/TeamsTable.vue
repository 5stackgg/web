<script setup lang="ts">
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <NuxtLink
      v-for="(team, index) in teams"
      :key="team.id"
      :to="{ name: 'teams-id', params: { id: team.id } }"
      class="bg-muted/30 p-4 rounded-lg transition-all duration-200 hover:bg-muted/50 hover:shadow-md cursor-pointer animate-in fade-in slide-in-from-bottom-2"
      :style="{ animationDelay: `${index * 50}ms` }"
    >
      <div class="font-medium text-base mb-3">{{ team.name }}</div>
      <div class="flex flex-col gap-2">
        <PlayerDisplay
          v-for="rosterItem in team.roster || []"
          :key="rosterItem.player?.steam_id"
          :player="rosterItem.player"
          :show-flag="true"
          :show-role="false"
          :show-elo="true"
          class="text-sm"
        />
      </div>
    </NuxtLink>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    teams: {
      required: true,
      type: Object,
    },
  },
};
</script>
