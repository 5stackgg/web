<script setup lang="ts">
import TournamentForm from "~/components/tournament/TournamentForm.vue";
import PageHeading from "~/components/PageHeading.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
</script>

<template>
  <PageTransition :delay="0">
    <PageHeading>
      <template #title>{{ $t("tournament.form.create") }}</template>
      <template #description>{{
        $t("tournament.form.description_help")
      }}</template>
    </PageHeading>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <tournament-form></tournament-form>
  </PageTransition>
</template>
