<template>
  <TournamentDetail />
</template>

<script lang="ts" setup>
import TournamentDetail from "~/components/tournament/TournamentDetail.vue";

// The manage console's section is a view of this page, not a new one, and
// dropping the one-shot `join` must not remount it either.
definePageMeta({ persistQueryKeys: ["section", "join"] });
</script>
