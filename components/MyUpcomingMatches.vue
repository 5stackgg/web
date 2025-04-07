<script lang="ts" setup>
import SimpleMatchDisplay from "./SimpleMatchDisplay.vue";
</script>

<template>
  <div class="flex gap-4 overflow-x-auto" v-if="matches.length > 0 || !hide">
    <template v-if="matches?.length > 0">
      <SimpleMatchDisplay
        :key="match.id"
        :match="match"
        v-for="match of matches"
      ></SimpleMatchDisplay>
    </template>
    <template v-else>
      <div class="text-center w-full p-4">
        <p class="text-muted-foreground">
          {{ $t("match.my_upcoming.no_matches") }}
        </p>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    hide: {
      default: false,
    },
  },
  computed: {
    matches() {
      return useMatchLobbyStore().upcomingMatches;
    },
  },
};
</script>
