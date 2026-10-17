<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { TONE_BG, type Tone } from "~/components/admin/tone";

// The admin status dot. `live` adds the ping ring, and only for something
// happening right now: on air, rendering, a live match, a tail that is
// following. Merely being online is not live; an online node gets a still
// green dot.
const props = withDefaults(
  defineProps<{
    tone: Tone;
    live?: boolean;
    /** Names the state: becomes the tooltip and the accessible label. */
    label?: string;
    size?: "sm" | "md";
    side?: "top" | "right" | "bottom" | "left";
  }>(),
  { live: false, size: "md", side: "top" },
);
</script>

<template>
  <FiveStackToolTip
    v-if="props.label"
    as-child
    :delay-duration="120"
    :side="props.side"
  >
    <template #trigger>
      <span
        class="relative inline-flex shrink-0"
        :class="props.size === 'sm' ? 'size-1.5' : 'size-2'"
        role="img"
        tabindex="-1"
        :aria-label="props.label"
      >
        <span
          v-if="props.live"
          class="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden"
          :class="TONE_BG[props.tone]"
        />
        <span
          class="relative inline-flex size-full rounded-full transition-colors duration-150"
          :class="TONE_BG[props.tone]"
        />
      </span>
    </template>
    {{ props.label }}
  </FiveStackToolTip>
  <span
    v-else
    class="relative inline-flex shrink-0"
    :class="props.size === 'sm' ? 'size-1.5' : 'size-2'"
    aria-hidden="true"
  >
    <span
      v-if="props.live"
      class="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden"
      :class="TONE_BG[props.tone]"
    />
    <span
      class="relative inline-flex size-full rounded-full transition-colors duration-150"
      :class="TONE_BG[props.tone]"
    />
  </span>
</template>
