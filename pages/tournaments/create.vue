<script setup lang="ts">
import TournamentCreateWizard from "~/components/tournament/TournamentCreateWizard.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

definePageMeta({ middleware: "tournament-create" });
</script>

<template>
  <h1 class="sr-only">{{ $t("tournament.form.create") }}</h1>
  <PageTransition>
    <TournamentCreateWizard />
  </PageTransition>
</template>
