<template>
  <TournamentDetail />
</template>

<script lang="ts" setup>
import TournamentDetail from "~/components/tournament/TournamentDetail.vue";

// The manage console's section is a view of this page, not a new one.
definePageMeta({ persistQueryKeys: ["section"] });
</script>
