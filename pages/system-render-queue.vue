<script setup lang="ts">
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import RenderQueuePanel from "~/components/clips/RenderQueuePanel.vue";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <div class="relative space-y-6">
    <PageTransition>
      <TacticalPageHeader>
        <template #title>{{ $t("pages.highlights.render_queue") }}</template>
      </TacticalPageHeader>
    </PageTransition>

    <PageTransition :delay="60">
      <RenderQueuePanel />
    </PageTransition>
  </div>
</template>
