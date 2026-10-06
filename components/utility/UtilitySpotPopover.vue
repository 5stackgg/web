<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, X } from "lucide-vue-next";
import { UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = defineProps<{
  label: string;
  /** The spot's lineups as the list has them -- the page of them on screen. */
  lineups: UtilityLineup[];
  /** Everything that lands here, which the page on screen may not all be. */
  total: number;
  hoveredId: string | null;
}>();

const emit = defineEmits<{
  (e: "hover", id: string | null): void;
  (e: "open", id: string): void;
  (e: "close"): void;
}>();

// The clip of whatever you are pointing at, or else the first one that has a
// clip, so the popover shows a throw before you have chosen one. None rendered
// yet is common -- a clip only exists once a lineup is public -- and then the
// list alone is the popover.
const preview = computed(() => {
  const hovered = props.lineups.find((lineup) => lineup.id === props.hoveredId);
  if (hovered?.preview_thumbnail_url) {
    return hovered;
  }
  return props.lineups.find((lineup) => lineup.preview_thumbnail_url) ?? null;
});
</script>

<template>
  <section
    class="flex max-h-[min(26rem,60vh)] w-[17rem] flex-col overflow-hidden rounded-lg border border-white/15 bg-background/95 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.95)] [backdrop-filter:blur(12px)]"
    :aria-label="label"
  >
    <header class="flex items-center gap-2 border-b border-white/10 py-1.5 pl-3 pr-1">
      <span class="min-w-0 flex-1 truncate text-sm font-semibold">
        {{ label }}
      </span>
      <span
        class="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{ $t("pages.utility.spots.count", { count: total }, total) }}
      </span>
      <button
        type="button"
        class="grid h-7 w-7 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :aria-label="$t('pages.utility.spots.all')"
        @click="emit('close')"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </header>

    <button
      v-if="preview"
      type="button"
      class="relative block aspect-video w-full shrink-0 overflow-hidden bg-muted/30"
      @click="emit('open', preview.id)"
    >
      <img
        :src="preview.preview_thumbnail_url ?? undefined"
        :alt="preview.name"
        class="h-full w-full object-cover"
        draggable="false"
      />
      <span
        class="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-1.5 pt-4 text-left text-xs font-medium text-white"
      >
        {{ preview.name }}
      </span>
    </button>

    <ul class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
      <li v-for="lineup of lineups" :key="lineup.id">
        <button
          type="button"
          class="group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
          :class="hoveredId === lineup.id ? 'bg-muted/50' : ''"
          @mouseenter="emit('hover', lineup.id)"
          @mouseleave="emit('hover', null)"
          @focus="emit('hover', lineup.id)"
          @blur="emit('hover', null)"
          @click="emit('open', lineup.id)"
        >
          <span
            aria-hidden="true"
            class="h-2 w-2 shrink-0 rounded-[1px]"
            :style="{ backgroundColor: UTILITY_TYPE_COLORS[lineup.utility_type] }"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-[0.8rem] font-medium">
              {{ lineup.name }}
            </span>
            <span
              class="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground"
            >
              {{ $t(`pages.utility.sides.${lineup.side}`) }} ·
              {{ $t(`pages.utility.techniques.${lineup.technique}`) }}
            </span>
          </span>
          <ChevronRight
            class="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          />
        </button>
      </li>
    </ul>
  </section>
</template>
