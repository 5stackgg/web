<script setup lang="ts">
// Who is talking, at a glance.
//
// Deliberately not a real level meter: reading an actual level per remote peer
// means an AnalyserNode and a sampling loop for every member of the channel,
// which is exactly the continuous work the voice stack is built to avoid. The
// gate on each player's own machine already decides whether they are
// transmitting and says so over the socket, so this animates on that -- honest
// about who is speaking, free when nobody is.
const props = withDefaults(
  defineProps<{
    active?: boolean;
    // Matches the surface it sits on: 3 bars in a dense list, 4 with room.
    bars?: number;
    class?: string;
  }>(),
  { active: false, bars: 4, class: "" },
);

// Prime-ish offsets so the bars never fall into a visible lockstep.
const DELAYS = ["0ms", "180ms", "90ms", "270ms", "45ms"];
</script>

<template>
  <span
    class="inline-flex items-end gap-[2px]"
    :class="props.class"
    aria-hidden="true"
  >
    <span
      v-for="index in bars"
      :key="index"
      class="w-[2px] rounded-full transition-[height,background-color] duration-150"
      :class="
        active
          ? 'voice-bar bg-emerald-400'
          : 'h-[3px] bg-muted-foreground/30'
      "
      :style="active ? { animationDelay: DELAYS[index % DELAYS.length] } : {}"
    ></span>
  </span>
</template>

<style scoped>
/* CSS-only: nothing schedules work on the main thread, and the compositor
   drops the whole thing the moment `active` goes false. */
.voice-bar {
  height: 100%;
  animation: voice-bar 620ms ease-in-out infinite alternate;
}

@keyframes voice-bar {
  from {
    height: 3px;
  }
  to {
    height: 11px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .voice-bar {
    animation: none;
    height: 8px;
  }
}
</style>
