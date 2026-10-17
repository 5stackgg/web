<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import RenderQueueLedger from "~/components/render-queue/RenderQueueLedger.vue";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.highlights.render_queue") }}</h1>

  <!-- Every clip render and every lineup render, one row each, in one
       ledger: the control row picks in flight, failed or finished. -->
  <PageTransition>
    <RenderQueueLedger />
  </PageTransition>
</template>
