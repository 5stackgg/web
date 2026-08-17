<script setup lang="ts">
import { Smartphone } from "lucide-vue-next";

// "This one is on your phone", worn by the control it applies to rather than
// replacing it.
//
// Swapping the whole glyph for a phone was the first attempt and it cost more
// than it said: the key stopped showing whether the microphone was muted or the
// camera was on, so reading the row meant remembering which of them had moved.
// As a corner badge the control keeps its own meaning and gains a second one.
//
// The ring is the panel's own background rather than a border colour, so the
// badge reads as sitting in front of the icon instead of being part of it.
defineProps<{ on: boolean }>();
</script>

<template>
  <span
    v-if="on"
    class="pointer-events-none absolute -bottom-1.5 -right-1.5 inline-flex items-center justify-center rounded-full bg-background p-[1.5px]"
    aria-hidden="true"
  >
    <span
      class="inline-flex items-center justify-center rounded-full bg-[hsl(var(--tac-amber))] p-[3px] text-[hsl(var(--tac-amber-foreground))]"
    >
      <!-- Important, because the Button this rides on sets `[&_svg]:size-4` on
           every icon inside it and a 16px badge is not a badge. -->
      <Smartphone class="!h-2.5 !w-2.5" />
    </span>
  </span>
</template>
