<script setup lang="ts">
import { ref } from "vue";
import TeamActivityFeed from "~/components/team/TeamActivityFeed.vue";
import TeamStartingFive from "~/components/team/TeamStartingFive.vue";
import TeamLeagueHistory from "~/components/teams/TeamLeagueHistory.vue";

defineProps<{
  team: any;
  teamAwards: any[];
}>();
const emit = defineEmits<{ (e: "all-highlights"): void }>();

const startingFive = ref<InstanceType<typeof TeamStartingFive> | null>(null);
// A side column taller than the screen can't stick, so the full roster
// lets it scroll with the page.
const rosterExpanded = ref(false);

// Lets the page open the full roster (e.g. from the needs inbox).
function showFullRoster() {
  startingFive.value?.showFullRoster();
}
defineExpose({ showFullRoster });
</script>

<template>
  <div
    class="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-10"
  >
    <TeamActivityFeed
      class="min-w-0"
      :team="team"
      :team-awards="teamAwards"
      @all-highlights="emit('all-highlights')"
    />

    <div
      class="grid min-w-0 gap-8"
      :class="{ 'lg:sticky lg:top-[5.5rem]': !rosterExpanded }"
    >
      <TeamStartingFive
        ref="startingFive"
        v-model:expanded="rosterExpanded"
        :team="team"
      />
      <TeamLeagueHistory :key="team.id" :team-id="team.id" />
    </div>
  </div>
</template>
