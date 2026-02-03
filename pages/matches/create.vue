<script lang="ts" setup>
import PageHeading from "~/components/PageHeading.vue";
import MatchForm from "~/components/match/MatchForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";

definePageMeta({
  middleware: ["match-create"],
});
</script>

<template>
  <PageTransition>
    <PageHeading>
      <template #title>{{ $t("pages.matches.create_page.title") }}</template>
    </PageHeading>
  </PageTransition>
  <PageTransition :delay="100" class="mt-6">
    <MatchForm />
  </PageTransition>
</template>

<script lang="ts">
export default {};
</script>
