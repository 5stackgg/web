<script lang="ts" setup>
import PageHeading from "~/components/PageHeading.vue";
import MatchForm from "~/components/match/MatchForm.vue";

definePageMeta({
  middleware: ["match-create"],
});
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{ $t("pages.matches.create_page.title") }}</template>
    </PageHeading>
    <MatchForm />
  </div>
</template>

<script lang="ts">
export default {};
</script>
