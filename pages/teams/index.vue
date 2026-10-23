<script setup lang="ts">
import { computed, ref } from "vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TeamsYourTeams from "~/components/teams/TeamsYourTeams.vue";
import TeamsPlayingNow from "~/components/teams/TeamsPlayingNow.vue";
import TeamsLookingForScrims from "~/components/teams/TeamsLookingForScrims.vue";
import TeamsBrowse from "~/components/teams/TeamsBrowse.vue";
import { tacticalSectionSeparatorClasses } from "~/utilities/tacticalClasses";
import { useAuthStore } from "~/stores/AuthStore";

// Each section renders nothing when it has nothing to offer, and any of them
// can be first, so every section carries the separator and the wrapper drops
// the first one's margin; the rule itself skips the first child.
const sectionClasses = ["mt-8", tacticalSectionSeparatorClasses];

// The viewer's own teams: shown first, ranked first among live matches, and
// left out of "Looking for scrims".
const myTeamIds = ref<string[]>([]);

// Signed out there's no "Your teams" to lead with, so the team lists do: the
// page opens on their search, like the other list pages.
const auth = useAuthStore();
const directoryFirst = computed(() => !auth.me);
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.teams.title") }}</h1>

  <div class="[&>*:first-child]:!mt-0">
    <PageTransition v-if="directoryFirst">
      <TeamsBrowse :class="sectionClasses" :show-create="false" />
    </PageTransition>

    <PageTransition>
      <TeamsYourTeams :class="sectionClasses" @team-ids="myTeamIds = $event" />
    </PageTransition>

    <PageTransition :step="1">
      <TeamsPlayingNow :class="sectionClasses" :my-team-ids="myTeamIds" />
    </PageTransition>

    <PageTransition :step="2">
      <TeamsLookingForScrims :class="sectionClasses" :my-team-ids="myTeamIds" />
    </PageTransition>

    <PageTransition v-if="!directoryFirst" :step="3">
      <TeamsBrowse :class="sectionClasses" :show-create="!myTeamIds.length" />
    </PageTransition>
  </div>
</template>
