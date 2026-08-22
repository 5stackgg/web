<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Film, Play } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    src?: string | null;
    poster?: string | null;
    durationMs?: number | null;
    // "thumb" is the card form: a poster that becomes a player when you ask.
    // "full" is the page form, where the clip IS the content.
    variant?: "thumb" | "full";
  }>(),
  {
    src: null,
    poster: null,
    durationMs: null,
    variant: "thumb",
  },
);

// A preview is a few seconds of one throw, so it never buffers ahead of being
// asked for: the library grid would otherwise open a connection per card.
const playing = ref(props.variant === "full");

watch(
  () => props.src,
  () => {
    playing.value = props.variant === "full";
  },
);

const seconds = computed(() =>
  props.durationMs && props.durationMs > 0
    ? Math.round(props.durationMs / 1000)
    : null,
);

// The page form frames its own content, so the corners sit at reading strength
// from the start. On a card they are a hover affordance and stay out of the way
// of the grid until you go near one.
const cornerClasses = computed(() =>
  props.variant === "full"
    ? "border-[hsl(var(--tac-amber)/0.55)]"
    : "border-[hsl(var(--tac-amber)/0.28)] group-hover/preview:border-[hsl(var(--tac-amber)/0.85)]",
);
</script>

<template>
  <div
    v-if="src"
    class="group/preview relative aspect-video w-full overflow-hidden rounded-md border border-border bg-black/60"
    @click.stop
  >
    <video
      v-if="playing"
      :key="src"
      :src="src"
      :poster="poster ?? undefined"
      class="h-full w-full object-cover"
      controls
      autoplay
      loop
      muted
      playsinline
      preload="metadata"
    />
    <button
      v-else
      type="button"
      class="absolute inset-0 flex items-center justify-center"
      :title="$t('pages.utility.preview.play')"
      @click.stop="playing = true"
    >
      <img
        v-if="poster"
        :src="poster"
        alt=""
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover"
      />
      <span
        v-else
        class="absolute inset-0 flex items-center justify-center bg-muted/20"
      >
        <Film class="h-5 w-5 text-muted-foreground" />
      </span>

      <!-- Rotated square rather than a circle: the same tick the tab strip and
           the section labels use, so the affordance belongs to this app. -->
      <span
        class="relative flex h-9 w-9 rotate-45 items-center justify-center border border-[hsl(var(--tac-amber)/0.7)] bg-black/70 transition-transform [transition-duration:150ms] group-hover/preview:scale-110"
      >
        <Play
          class="h-3.5 w-3.5 -rotate-45 fill-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber))]"
        />
      </span>
    </button>

    <!-- Documented purpose of .tac-scanlines: footage reads as composed into the
         chrome instead of pasted above it. Above the poster, below the readouts,
         and never over the video's own controls. -->
    <span
      v-if="!playing"
      aria-hidden="true"
      class="tac-scanlines pointer-events-none absolute inset-0 z-[2]"
    ></span>

    <!-- Viewfinder corners. Four L's rather than a full frame: the border is
         already the frame, and this is the part that says the frame is aimed. -->
    <span
      v-if="!playing"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 z-[3]"
    >
      <span
        class="absolute left-1 top-1 h-3 w-3 border-l border-t transition-colors [transition-duration:150ms]"
        :class="cornerClasses"
      ></span>
      <span
        class="absolute right-1 top-1 h-3 w-3 border-r border-t transition-colors [transition-duration:150ms]"
        :class="cornerClasses"
      ></span>
      <span
        class="absolute bottom-1 left-1 h-3 w-3 border-b border-l transition-colors [transition-duration:150ms]"
        :class="cornerClasses"
      ></span>
      <span
        class="absolute bottom-1 right-1 h-3 w-3 border-b border-r transition-colors [transition-duration:150ms]"
        :class="cornerClasses"
      ></span>
    </span>

    <!-- Flat readout, not a pill: every other number on this card is mono,
         uppercase and tabular, and a runtime is one of them. -->
    <span
      v-if="seconds && !playing"
      aria-hidden="true"
      class="pointer-events-none absolute bottom-0 right-0 z-[3] border-l border-t border-[hsl(var(--tac-amber)/0.35)] bg-black/75 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tabular-nums tracking-[0.14em] text-[hsl(var(--tac-amber))]"
    >
      {{ seconds }}s
    </span>
  </div>
</template>
