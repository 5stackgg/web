<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import TeamForm from "~/components/teams/TeamForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

const route = useRoute();

// Suggested-team notifications deep-link here with a comma-separated steam id
// list to prefill the invite list.
const inviteMembers = computed<string[]>(() => {
  const members = route.query.members;
  const raw = Array.isArray(members) ? members.join(",") : (members ?? "");
  return String(raw)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
});
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.teams.create") }}</h1>
  <PageTransition class="mx-auto w-full max-w-2xl">
    <team-form :invite-members="inviteMembers"></team-form>
  </PageTransition>
</template>
