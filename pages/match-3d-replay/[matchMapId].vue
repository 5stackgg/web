<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ReplayPopoutInner from "~/components/match/ReplayPopoutInner.vue";
import { useReplayNoZoom } from "~/composables/useReplayNoZoom";

// Native browser zoom fights the replay's own pinch/zoom and gets stuck.
useReplayNoZoom();

// Chromeless full-screen replay, defaulting to the 3D map. This is the SAME
// unified player as the popout — only the initial map view differs. ssr:false
// because the three.js scene is browser-only.
definePageMeta({ layout: false, ssr: false });

const route = useRoute();
const matchMapId = computed(() => String(route.params.matchMapId));
</script>

<template>
  <div class="fixed inset-0 h-[100dvh] bg-[#08101f]">
    <ReplayPopoutInner :match-map-id="matchMapId" initial-view="3d" />
  </div>
</template>
