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
  <div class="flex-grow flex flex-col gap-6">
    <PageTransition>
      <PageHeading>
        <template #title>{{ $t("pages.matches.create_page.title") }}</template>
      </PageHeading>
    </PageTransition>
    <PageTransition :delay="100">
      <MatchForm />
    </PageTransition>
  </div>
</template>

<script lang="ts">
export default {};
</script>
