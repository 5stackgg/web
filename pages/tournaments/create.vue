<script setup lang="ts">
import TournamentForm from "~/components/tournament/TournamentForm.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
</script>

<template>
  <PageTransition :delay="0">
    <TacticalPageHeader>
      <template #title>{{ $t("tournament.form.create") }}</template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <tournament-form></tournament-form>
  </PageTransition>
</template>
