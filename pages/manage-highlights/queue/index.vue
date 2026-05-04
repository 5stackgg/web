<script setup lang="ts">
import { ListVideo, ArrowLeft } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import RenderQueuePanel from "~/components/clips/RenderQueuePanel.vue";

// Dedicated render-queue management page. Streamer-rank+ via the
// same middleware Manage Highlights uses (the queue is meaningless
// to non-operators — they'd see no actionable rows under the user-
// scoped Hasura permission anyway).
definePageMeta({
  middleware: "streamer",
});
</script>

<template>
  <PageTransition>
    <div class="mb-4 flex items-center gap-2">
      <Button variant="ghost" size="sm" as-child>
        <NuxtLink to="/manage-highlights" class="flex items-center gap-2">
          <ArrowLeft class="h-4 w-4" />
          Manage Highlights
        </NuxtLink>
      </Button>
    </div>
  </PageTransition>

  <PageTransition>
    <TacticalPageHeader
      :icon="ListVideo"
      title="Render Queue"
      subtitle="Active and recently-finished highlight render batches across the platform."
    />
  </PageTransition>

  <PageTransition :delay="80" class="mt-6">
    <RenderQueuePanel />
  </PageTransition>
</template>
