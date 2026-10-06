<script setup lang="ts">
import { computed } from "vue";
import { Maximize2, PencilLine, X } from "lucide-vue-next";
import { UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = defineProps<{
  label: string;
  /** The spot's lineups as the list has them -- the page of them on screen. */
  lineups: UtilityLineup[];
  /** Everything that lands here, which the page on screen may not all be. */
  total: number;
  hoveredId: string | null;
  selectedId: string | null;
}>();

const emit = defineEmits<{
  (e: "hover", id: string | null): void;
  (e: "select", id: string): void;
  (e: "open", id: string): void;
  (e: "edit", id: string): void;
  (e: "close"): void;
}>();

// What the preview is about: the throw you picked, else the one you are
// pointing at, else the first with something to show -- so the popover shows a
// throw before you have chosen one. Nothing rendered yet is common (a clip only
// exists once a lineup is public), and then the list alone is the popover.
const preview = computed(() => {
  const byId = (id: string | null) =>
    id ? props.lineups.find((lineup) => lineup.id === id) : undefined;
  const hasMedia = (lineup?: UtilityLineup) =>
    !!(lineup?.preview_url || lineup?.preview_thumbnail_url);
  const selected = byId(props.selectedId);
  if (hasMedia(selected)) {
    return selected!;
  }
  const hovered = byId(props.hoveredId);
  if (hasMedia(hovered)) {
    return hovered!;
  }
  return props.lineups.find(hasMedia) ?? null;
});

// Only the picked throw plays. Several clips cycling as the pointer crosses
// the list is a strobe, and a thumbnail already answers "which one is this".
const playing = computed(
  () => !!preview.value?.preview_url && preview.value.id === props.selectedId,
);
</script>

<template>
  <section
    class="flex max-h-[min(30rem,62vh)] w-[18rem] flex-col overflow-hidden rounded-lg border border-white/15 bg-background/95 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.95)] [backdrop-filter:blur(12px)]"
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
      :aria-label="$t('pages.utility.card.open')"
      @click="emit('open', preview.id)"
    >
      <video
        v-if="playing"
        :key="preview.id"
        :src="preview.preview_url ?? undefined"
        :poster="preview.preview_thumbnail_url ?? undefined"
        class="h-full w-full object-cover"
        autoplay
        muted
        loop
        playsinline
      />
      <img
        v-else-if="preview.preview_thumbnail_url"
        :src="preview.preview_thumbnail_url"
        alt=""
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
        <!-- Picking a row selects the throw rather than opening it: the card
             opens in place in the list and the throw lights up on the map, so
             you can read it without losing either. Opening is one more click,
             on the row you already picked. -->
        <div
          class="rounded-md transition-colors"
          :class="
            selectedId === lineup.id
              ? 'bg-[hsl(var(--tac-amber)/0.1)] ring-1 ring-inset ring-[hsl(var(--tac-amber)/0.4)]'
              : hoveredId === lineup.id
                ? 'bg-muted/50'
                : ''
          "
        >
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none"
            :aria-pressed="selectedId === lineup.id"
            @mouseenter="emit('hover', lineup.id)"
            @mouseleave="emit('hover', null)"
            @focus="emit('hover', lineup.id)"
            @blur="emit('hover', null)"
            @click="emit('select', lineup.id)"
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
          </button>
          <div v-if="selectedId === lineup.id" class="flex gap-1.5 px-2 pb-2">
            <button
              type="button"
              class="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-xs font-semibold text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.2)]"
              @click="emit('open', lineup.id)"
            >
              <Maximize2 class="h-3.5 w-3.5" />
              {{ $t("pages.utility.card.open") }}
            </button>
            <button
              v-if="lineup.can_edit && !lineup.archived_at"
              type="button"
              class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              @click="emit('edit', lineup.id)"
            >
              <PencilLine class="h-3.5 w-3.5" />
              {{ $t("pages.utility.edit.action") }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
