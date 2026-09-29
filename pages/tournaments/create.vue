<script setup lang="ts">
import TournamentCreateWizard from "~/components/tournament/TournamentCreateWizard.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

definePageMeta({ middleware: "tournament-create" });
</script>

<template>
  <PageTransition :delay="0">
    <TacticalPageHeader>
      <template #title>{{ $t("tournament.form.create") }}</template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <TournamentCreateWizard />
  </PageTransition>
</template>
