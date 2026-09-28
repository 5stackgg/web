<script setup lang="ts">
import { useStreamMatchSummary } from "~/composables/useStreamMatchSummary";

// The caption shown over a stream while there's no picture: who's playing,
// where the match stands, and (in the default slot) a StreamStatusPanel
// saying what the player is doing. Pass `matchId` for a live stream or
// `matchMapId` for a demo replay of one map.
const props = withDefaults(
  defineProps<{
    matchId?: string | null;
    matchMapId?: string | null;
    // Blurred map poster behind the caption.
    backdrop?: boolean;
    // Floating PiP / popout: tighter card, no eyebrow.
    compact?: boolean;
  }>(),
  {
    backdrop: true,
    compact: false,
  },
);

const { summary } = useStreamMatchSummary(() => ({
  matchId: props.matchId,
  matchMapId: props.matchMapId,
}));
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden text-left">
    <template v-if="backdrop">
      <div
        v-if="summary?.poster"
        class="absolute -inset-[4%] bg-cover bg-center blur-[14px] brightness-[.42] saturate-[.85]"
        :style="{ backgroundImage: `url(${summary.poster})` }"
      />
      <div
        class="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,0.55))]"
      />
    </template>

    <slot name="corner" />

    <div
      class="pointer-events-auto absolute overflow-hidden rounded-[3px] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.85)]"
      :class="
        compact
          ? 'bottom-2 left-2 w-[min(18rem,calc(100%-1rem))]'
          : 'bottom-3 left-3 w-[min(22rem,calc(100%-1.5rem))] sm:bottom-5 sm:left-5'
      "
    >
      <div
        v-if="summary"
        class="flex flex-col bg-background/90"
        :class="compact ? 'px-3 py-2' : 'px-3.5 pb-2.5 pt-3'"
      >
        <p
          v-if="summary.eyebrow && !compact"
          class="mb-1 truncate text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground max-sm:hidden"
        >
          {{ summary.eyebrow }}
        </p>
        <div
          v-for="(row, i) in summary.rows"
          :key="i"
          class="flex items-center justify-between gap-3 font-semibold leading-tight"
          :class="[
            compact ? 'text-sm' : 'text-lg max-sm:text-sm',
            row.muted ? 'text-muted-foreground' : 'text-foreground',
          ]"
        >
          <span class="truncate">{{ row.name }}</span>
          <span
            v-if="row.score !== null"
            class="min-w-7 text-right tabular-nums"
            >{{ row.score }}</span
          >
        </div>
        <p
          v-if="summary.meta"
          class="mt-1 truncate text-muted-foreground"
          :class="compact ? 'text-[0.7rem]' : 'text-xs'"
        >
          {{ summary.meta }}
        </p>
      </div>
      <slot />
    </div>
  </div>
</template>
