<script setup lang="ts">
import { computed, inject, type ComputedRef } from "vue";
import { Film } from "lucide-vue-next";
import { useClipModal, type ClipQueueItem } from "~/composables/useClipModal";
import type { Clip } from "~/types/clip";

const props = defineProps<{
  steamId: string | number;
}>();

const byTarget = inject<ComputedRef<Map<string, Clip[]>>>(
  "matchClipsByTarget",
  computed(() => new Map()) as any,
);
const { openClip, setClipQueue } = useClipModal();

const clips = computed<Clip[]>(() => {
  const sid = String(props.steamId);
  return byTarget.value?.get(sid) ?? [];
});
const count = computed(() => clips.value.length);
const hasClips = computed(() => count.value > 0);

function publishQueue() {
  const items: ClipQueueItem[] = clips.value.map((c) => ({
    id: c.id,
    title: c.title,
    playerName: c.target?.name ?? null,
    teamName: null,
    durationMs: c.duration_ms,
    thumbnailUrl: c.thumbnail_download_url,
    posterUrl: c.match_map?.map?.poster ?? null,
  }));
  setClipQueue(items, `player-match-clips:${String(props.steamId)}`);
}

function onClick(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  e.stopPropagation();
  const first = clips.value[0];
  if (!first) return;
  publishQueue();
  openClip(first.id);
}
</script>

<template>
  <span
    v-if="hasClips"
    class="inline-flex"
    @click.stop.prevent
    @mousedown.stop
    @mouseup.stop
  >
    <button
      type="button"
      class="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[hsl(var(--tac-amber))] text-background ring-1 ring-background shadow hover:brightness-110 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.8)]"
      :title="
        count === 1
          ? clips[0]?.title || $t('ui_extras.open_highlight')
          : `${count} highlights for this player`
      "
      @click="onClick"
    >
      <Film class="h-2.5 w-2.5" />
      <span
        v-if="count > 1"
        class="absolute -top-1.5 -right-1.5 inline-flex min-w-[0.75rem] h-3 px-[3px] items-center justify-center rounded-full border border-background bg-red-500 text-[0.5rem] font-mono font-bold tabular-nums text-white"
      >
        {{ count }}
      </span>
    </button>
  </span>
</template>
