<script lang="ts" setup>
import MatchForm from "~/components/match/MatchForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
definePageMeta({
  middleware: ["match-create"],
});
</script>

<template>
  <PageTransition>
    <MatchForm />
  </PageTransition>
</template>

<script lang="ts">
export default {};
</script>
