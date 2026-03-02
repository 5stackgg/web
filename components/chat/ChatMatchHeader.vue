<script setup lang="ts">
import MatchTableRow from "~/components/MatchTableRow.vue";

const props = defineProps<{
  match: any | null;
}>();
</script>

<template>
  <div v-if="match" class="mb-2">
    <MatchTableRow :match="match" :player="null" compact />
  </div>
</template>
