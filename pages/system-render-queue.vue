<script setup lang="ts">
import { computed } from "vue";
import { ListVideo, Loader2, Clock } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import RenderQueuePanel from "~/components/clips/RenderQueuePanel.vue";
import { useRenderQueueStatusStore } from "~/stores/RenderQueueStatusStore";

definePageMeta({
  middleware: "admin",
});

const renderQueueStore = useRenderQueueStatusStore();
const inFlightCount = computed(() => renderQueueStore.inFlightCount);
</script>

<template>
  <div class="relative space-y-6">
    <PageTransition>
      <TacticalPageHeader>
        <template #title>Render Queue</template>
        <template #actions>
          <div
            class="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <template v-if="inFlightCount > 0">
              <Loader2
                class="h-3.5 w-3.5 animate-spin text-[hsl(var(--tac-amber))]"
              />
              <span>
                <span class="text-foreground font-semibold tabular-nums">{{
                  inFlightCount
                }}</span>
                in flight
              </span>
            </template>
            <template v-else>
              <Clock class="h-3.5 w-3.5" />
              <span>Idle</span>
            </template>
          </div>
        </template>
      </TacticalPageHeader>
    </PageTransition>

    <PageTransition :delay="60">
      <RenderQueuePanel />
    </PageTransition>
  </div>
</template>
