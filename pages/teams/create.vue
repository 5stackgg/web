<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import TeamForm from "~/components/teams/TeamForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
PageHeading;
</script>

<template>
  <PageTransition :delay="0">
    <PageHeading class="w-1/2">
      <template #title>{{ $t("pages.teams.create") }}</template>
    </PageHeading>
  </PageTransition>
  <PageTransition :delay="100" class="mt-6 w-1/2">
    <team-form></team-form>
  </PageTransition>
</template>
