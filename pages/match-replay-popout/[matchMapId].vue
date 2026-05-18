<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ReplayPopoutInner from "~/components/match/ReplayPopoutInner.vue";
import { TooltipProvider } from "~/components/ui/tooltip";

// Chromeless single-purpose route — opened via window.open() from the
// ReplayViewer's pop-out button. We render only the replay viewer so
// the user can drag the OS window anywhere (second monitor, snapped
// half-screen, etc.) and we don't waste pixels on the app shell.
//
// The default layout supplies the global TooltipProvider; we skip the
// layout here, so we have to wrap our own — Tooltips inside the
// replay viewer rely on the radix-vue context to mount.
definePageMeta({ layout: false });

const route = useRoute();
const matchMapId = computed(() => String(route.params.matchMapId));
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <div class="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <ReplayPopoutInner :match-map-id="matchMapId" />
    </div>
  </TooltipProvider>
</template>
