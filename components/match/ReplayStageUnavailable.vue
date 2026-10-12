<script setup lang="ts">
import { MapPinOff, MonitorX } from "lucide-vue-next";

// Stands in the replay stage's place when it cannot draw: no WebGL2, or no
// model of the map to draw.
defineProps<{ reason: "unsupported" | "missing-map" }>();
</script>

<template>
  <div
    role="status"
    class="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground"
  >
    <MonitorX v-if="reason === 'unsupported'" class="h-4 w-4 shrink-0" />
    <MapPinOff v-else class="h-4 w-4 shrink-0" />
    {{
      reason === "unsupported"
        ? $t("match.replay.chrome.stage_unsupported")
        : $t("match.replay.chrome.stage_no_map")
    }}
  </div>
</template>
