<script setup lang="ts">
import { computed } from "vue";
import { Play, Film } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    clips: any[];
    max?: number;
    // Stack thumbnails vertically (single column) instead of the
    // default horizontal flex-wrap. Used when the highlights live in
    // a narrow side column.
    vertical?: boolean;
    // Suppress the built-in "Highlights · N" header; useful when the
    // strip is nested inside a larger highlights section that already
    // owns the heading.
    hideHeader?: boolean;
  }>(),
  {
    max: 4,
    vertical: false,
    hideHeader: false,
  },
);

const emit = defineEmits<{
  (e: "open", clipId: string): void;
}>();

const visible = computed(() => props.clips.slice(0, props.max));
const overflow = computed(() =>
  Math.max(0, props.clips.length - visible.value.length),
);
</script>

<template>
  <div v-if="clips.length > 0">
    <div
      v-if="!hideHeader"
      class="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
    >
      <Film class="h-3 w-3 text-[hsl(var(--tac-amber))]/80" />
      Highlights
      <span class="text-foreground/70">·</span>
      <span class="text-foreground/80">{{ clips.length }}</span>
    </div>
    <TransitionGroup
      tag="div"
      :class="vertical ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'"
      enter-active-class="transition-[opacity,transform] duration-200 ease-out"
      leave-active-class="absolute transition-[opacity,transform] duration-150 ease-in"
      enter-from-class="opacity-0 translate-y-1 scale-[0.96]"
      leave-to-class="opacity-0 translate-y-1 scale-[0.96]"
      move-class="transition-transform duration-200 ease-out"
    >
      <button
        v-for="clip in visible"
        :key="clip.id"
        type="button"
        :class="[
          'group/clip relative aspect-video shrink-0 overflow-hidden rounded-md border border-border bg-black transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-[hsl(var(--tac-amber)/0.7)] hover:shadow-[0_0_18px_hsl(var(--tac-amber)/0.18)]',
          vertical ? 'w-full' : 'w-32 sm:w-40',
        ]"
        :title="clip.title || 'Highlight'"
        @click.stop="emit('open', clip.id)"
      >
        <img
          v-if="clip.thumbnail_download_url"
          :src="clip.thumbnail_download_url"
          :alt="clip.title || ''"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/clip:scale-[1.04]"
        />
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_55%,hsl(0_0%_0%/0.6)_100%)]"
        ></span>
        <span
          class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-150 group-hover/clip:opacity-100"
        >
          <span
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--tac-amber)/0.95)] text-[hsl(var(--tac-amber-foreground))] shadow-lg"
          >
            <Play class="h-4 w-4 fill-current" />
          </span>
        </span>
        <span
          v-if="(clip.kills_count ?? 0) > 1"
          class="absolute bottom-1.5 right-1.5 rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[0.6rem] font-bold leading-none text-[hsl(var(--tac-amber))] backdrop-blur-sm"
        >
          {{ clip.kills_count }}K
        </span>
        <span
          v-if="clip.title"
          class="absolute bottom-1.5 left-1.5 right-10 truncate font-mono text-[0.55rem] uppercase tracking-[0.08em] text-white/85"
        >
          {{ clip.title }}
        </span>
      </button>
      <!-- Overflow tile only rendered when `max` > 1; with max=1 the
           count badge inside the single card carries the same info
           without taking another row of height. -->
      <div
        v-if="overflow > 0 && max > 1"
        key="overflow-tile"
        :class="[
          'grid aspect-video shrink-0 place-items-center rounded-md border border-dashed border-border bg-muted/30 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground',
          vertical ? 'w-full' : 'w-32 sm:w-40',
        ]"
      >
        +{{ overflow }} more
      </div>
    </TransitionGroup>
  </div>
</template>
