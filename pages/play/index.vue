<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import PlayMatchmaking from "~/components/play/PlayMatchmaking.vue";
import PlaySchedule from "~/components/play/PlaySchedule.vue";
import PlayDraftRooms from "~/components/play/PlayDraftRooms.vue";
import PlayMoreWays from "~/components/play/PlayMoreWays.vue";
import { tacticalSectionSeparatorClasses } from "~/utilities/tacticalClasses";

// Each section renders nothing when it has nothing to offer, so the
// separator rule only ever sits between sections that are actually shown.
const sectionClasses = ["mt-8", tacticalSectionSeparatorClasses];
</script>

<template>
  <PageTransition>
    <PlayMatchmaking />
  </PageTransition>

  <PageTransition :delay="50">
    <PlaySchedule :class="sectionClasses" />
  </PageTransition>

  <PageTransition :delay="100">
    <PlayDraftRooms :class="sectionClasses" />
  </PageTransition>

  <PageTransition :delay="150">
    <PlayMoreWays :class="sectionClasses" />
  </PageTransition>
</template>
