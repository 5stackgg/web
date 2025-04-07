<script setup lang="ts">
import TournamentForm from "~/components/tournament/TournamentForm.vue";
import PageHeading from "~/components/PageHeading.vue";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{ $t("tournament.form.create") }}</template>
      <template #description>{{
        $t("tournament.form.description_help")
      }}</template>
    </PageHeading>

    <tournament-form></tournament-form>
  </div>
</template>
