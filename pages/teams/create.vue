<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import TeamForm from "~/components/teams/TeamForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
PageHeading;
</script>

<template>
  <div class="w-1/2">
    <PageTransition :delay="0">
      <PageHeading>
        <template #title>{{ $t("pages.teams.create") }}</template>
      </PageHeading>
    </PageTransition>
    <PageTransition :delay="100">
      <team-form></team-form>
    </PageTransition>
  </div>
</template>
