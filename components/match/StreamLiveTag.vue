<script setup lang="ts">
import StreamViewerBadge from "~/components/match/StreamViewerBadge.vue";

// The LIVE tag with the viewer count beside it. One chip, so the two halves
// always share a height and baseline wherever a stream shows it.
withDefaults(
  defineProps<{
    matchId: string;
    // Greyed out while the player has no picture.
    dim?: boolean;
  }>(),
  { dim: false },
);
</script>

<template>
  <div
    class="pointer-events-none flex overflow-hidden rounded-[2px] text-[0.7rem] leading-none shadow-[0_6px_18px_-8px_rgba(0,0,0,0.7)]"
  >
    <span
      class="flex items-center px-2 py-1.5 font-bold uppercase tracking-[0.12em] transition-colors"
      :class="
        dim
          ? 'bg-muted text-muted-foreground'
          : 'bg-destructive text-destructive-foreground'
      "
    >
      {{ $t("common.live") }}
    </span>
    <span class="flex items-center bg-background/85 px-2 py-1.5 text-foreground">
      <StreamViewerBadge :match-id="matchId" bare />
    </span>
  </div>
</template>
