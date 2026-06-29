<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
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
  <PageTransition :delay="0" class="mx-auto w-full max-w-2xl">
    <TacticalPageHeader>
      <template #title>{{ $t("pages.teams.create") }}</template>
    </TacticalPageHeader>
  </PageTransition>
  <PageTransition :delay="100" class="mx-auto mt-6 w-full max-w-2xl">
    <team-form :invite-members="inviteMembers"></team-form>
  </PageTransition>
</template>
