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
</script>

<template>
  <div
    v-if="src"
    class="relative overflow-hidden rounded-md border border-border bg-black/40"
    :class="variant === 'thumb' ? 'aspect-video w-full' : 'aspect-video w-full'"
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
      class="group/preview absolute inset-0 flex items-center justify-center"
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
        class="absolute inset-0 flex items-center justify-center bg-muted/30"
      >
        <Film class="h-5 w-5 text-muted-foreground" />
      </span>
      <span
        class="relative flex h-8 w-8 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/25 transition-transform duration-150 group-hover/preview:scale-110"
      >
        <Play class="h-3.5 w-3.5 translate-x-[1px] fill-white text-white" />
      </span>
      <span
        v-if="seconds"
        class="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[0.625rem] font-medium tabular-nums text-white"
      >
        {{ seconds }}s
      </span>
    </button>
  </div>
</template>
