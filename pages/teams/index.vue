<script setup lang="ts">
import { ref } from "vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TeamsYourTeams from "~/components/teams/TeamsYourTeams.vue";
import TeamsPlayingNow from "~/components/teams/TeamsPlayingNow.vue";
import TeamsLookingForScrims from "~/components/teams/TeamsLookingForScrims.vue";
import TeamsDirectory from "~/components/teams/TeamsDirectory.vue";
import { tacticalSectionSeparatorClasses } from "~/utilities/tacticalClasses";

// Each section renders nothing when it has nothing to offer, and any of them
// can be first, so every section carries the separator and the wrapper drops
// the first one's margin; the rule itself skips the first child.
const sectionClasses = ["mt-8", tacticalSectionSeparatorClasses];

// The viewer's own teams: shown first, ranked first among live matches, and
// left out of "Looking for scrims".
const myTeamIds = ref<string[]>([]);
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.teams.title") }}</h1>

  <div class="[&>*:first-child]:!mt-0">
    <PageTransition>
      <TeamsYourTeams :class="sectionClasses" @team-ids="myTeamIds = $event" />
    </PageTransition>

    <PageTransition :delay="50">
      <TeamsPlayingNow :class="sectionClasses" :my-team-ids="myTeamIds" />
    </PageTransition>

    <PageTransition :delay="100">
      <TeamsLookingForScrims :class="sectionClasses" :my-team-ids="myTeamIds" />
    </PageTransition>

    <PageTransition :delay="150">
      <TeamsDirectory
        :class="sectionClasses"
        :show-create="!myTeamIds.length"
      />
    </PageTransition>
  </div>
</template>
