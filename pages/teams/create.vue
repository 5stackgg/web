<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import PageHeading from "~/components/PageHeading.vue";
import TeamForm from "~/components/teams/TeamForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
PageHeading;

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
  <PageTransition :delay="0">
    <PageHeading class="w-1/2">
      <template #title>{{ $t("pages.teams.create") }}</template>
    </PageHeading>
  </PageTransition>
  <PageTransition :delay="100" class="mt-6 w-1/2">
    <team-form :invite-members="inviteMembers"></team-form>
  </PageTransition>
</template>
