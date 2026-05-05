<script setup lang="ts">
import { computed, inject, type ComputedRef } from "vue";
import { Film } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useClipModal } from "~/composables/useClipModal";
import type { Clip } from "~/types/clip";

// Inline clip indicator that sits next to a player's name on the
// match page. Reads the parent-provided `matchClipsByTarget` map so
// every row in a 10-player lineup shares one subscription.
//
// Single clip → click opens the global clip modal directly.
// Multi-clip → small popover lists each clip with its title +
//              duration; clicking an item pops the modal.
const props = defineProps<{
  steamId: string | number;
}>();

const byTarget = inject<ComputedRef<Map<string, Clip[]>>>(
  "matchClipsByTarget",
  computed(() => new Map()) as any,
);
const { openClip } = useClipModal();

const clips = computed<Clip[]>(() => {
  const sid = String(props.steamId);
  return byTarget.value?.get(sid) ?? [];
});
const count = computed(() => clips.value.length);
const hasClips = computed(() => count.value > 0);
const single = computed(() => clips.value[0] ?? null);

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function onSingleClick(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  e.stopPropagation();
  if (single.value) openClip(single.value.id);
}

function pickClip(c: Clip) {
  openClip(c.id);
}
</script>

<template>
  <!-- Hidden when the player has no clips. Keeps the row identical to
       its prior layout for non-clipped players. -->
  <template v-if="hasClips">
    <!-- Single-clip path: direct shortcut, no popover layer. -->
    <button
      v-if="count === 1 && single"
      type="button"
      class="ml-1.5 inline-flex h-5 items-center gap-1 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
      :title="single.title || 'Open highlight'"
      @click="onSingleClick"
    >
      <Film class="h-3 w-3" />
      <span
        class="font-mono text-[0.55rem] uppercase tracking-[0.16em]"
      >
        Clip
      </span>
    </button>

    <!-- Multi-clip path: popover lists each clip, click → modal. -->
    <Popover v-else>
      <PopoverTrigger
        class="ml-1.5 inline-flex h-5 items-center gap-1 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
        :title="`${count} highlights for this player`"
        @click.stop
      >
        <Film class="h-3 w-3" />
        <span
          class="font-mono text-[0.55rem] tabular-nums"
        >
          {{ count }}
        </span>
      </PopoverTrigger>
      <PopoverContent class="w-72 p-1" align="start" @click.stop>
        <div
          class="px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground flex items-center justify-between"
        >
          <span class="inline-flex items-center gap-1.5">
            <Film class="h-3 w-3 text-[hsl(var(--tac-amber))]" />
            Highlights
          </span>
          <span class="tabular-nums opacity-70">{{ count }}</span>
        </div>
        <div class="max-h-72 overflow-y-auto">
          <button
            v-for="c in clips"
            :key="c.id"
            type="button"
            class="w-full text-left flex items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/60 transition-colors"
            @click="pickClip(c)"
          >
            <span
              class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]"
            >
              <Film class="h-3 w-3" />
            </span>
            <span class="flex-1 min-w-0">
              <span class="block truncate font-medium">
                {{ c.title || "Untitled clip" }}
              </span>
              <span
                class="block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/80 truncate"
              >
                {{ c.match_map?.map?.label ?? c.match_map?.map?.name ?? "" }}
                <span v-if="c.duration_ms" class="opacity-60">·</span>
                <span v-if="c.duration_ms" class="tabular-nums">
                  {{ formatDuration(c.duration_ms) }}
                </span>
              </span>
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  </template>
</template>
