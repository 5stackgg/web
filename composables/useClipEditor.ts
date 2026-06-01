import { computed, ref, watch } from "vue";
import { useDemoPlaybackStore } from "~/stores/DemoPlaybackStore";
import { useDemoPlayback } from "~/composables/useDemoPlayback";

// Module-scoped so closing the editor preserves the segment list.
export type EditorSegment = {
  id: string;
  start_tick: number;
  end_tick: number;
  pov_steam_id: string | null;
};

const active = ref(false);
const segments = ref<EditorSegment[]>([]);
const selectedId = ref<string | null>(null);

const previewing = ref(false);
const previewSegmentIndex = ref<number>(-1);
let previewWatcherStop: (() => void) | null = null;

export function useClipEditor() {
  const store = useDemoPlaybackStore();
  const { seek, switchToSlot, play, pause } = useDemoPlayback();

  const totalTicks = computed(() => Math.max(1, store.totalTicks || 0));
  const tickRate = computed(() => store.tickRate || 64);

  const sortedSegments = computed(() =>
    [...segments.value].sort((a, b) => a.start_tick - b.start_tick),
  );

  const totalSelectedTicks = computed(() =>
    segments.value.reduce(
      (acc, s) => acc + Math.max(0, s.end_tick - s.start_tick),
      0,
    ),
  );

  const isValid = computed(
    () => segments.value.length > 0 && totalSelectedTicks.value > 0,
  );

  function open() {
    active.value = true;
    if (segments.value.length === 0) {
      const at = Math.min(store.currentTick, totalTicks.value - 1);
      const span = tickRate.value * 30;
      const end = Math.min(at + span, totalTicks.value);
      segments.value = [
        {
          id: crypto.randomUUID(),
          start_tick: Math.max(0, at),
          end_tick: end,
          pov_steam_id: store.spectatedSteamId ?? null,
        },
      ];
      selectedId.value = segments.value[0].id;
    }
  }

  function close() {
    active.value = false;
    stopPreview();
  }

  function reset() {
    segments.value = [];
    selectedId.value = null;
    stopPreview();
  }

  function addSegmentAt(tick: number, span?: number) {
    const at = Math.max(0, Math.min(tick, totalTicks.value - 1));
    const len = span ?? tickRate.value * 10;
    const end = Math.min(at + len, totalTicks.value);
    if (end - at < 1) return null;
    const seg: EditorSegment = {
      id: crypto.randomUUID(),
      start_tick: at,
      end_tick: end,
      pov_steam_id: store.spectatedSteamId ?? null,
    };
    segments.value = [...segments.value, seg].sort(
      (a, b) => a.start_tick - b.start_tick,
    );
    selectedId.value = seg.id;
    return seg;
  }

  function addSegmentRange(startTick: number, endTick: number) {
    const a = Math.max(0, Math.min(startTick, totalTicks.value));
    const b = Math.max(0, Math.min(endTick, totalTicks.value));
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const minSpan = Math.max(1, Math.round(tickRate.value * 0.5));
    if (hi - lo < minSpan) return null;
    return addSegmentAt(lo, hi - lo);
  }

  function removeSegment(id: string) {
    segments.value = segments.value.filter((s) => s.id !== id);
    if (selectedId.value === id) {
      selectedId.value = segments.value[0]?.id ?? null;
    }
  }

  function splitSegmentAtPlayhead(id: string) {
    const seg = segments.value.find((s) => s.id === id);
    if (!seg) return;
    const at = store.currentTick;
    const minSpan = Math.max(1, Math.round(tickRate.value * 0.5));
    if (at <= seg.start_tick + minSpan || at >= seg.end_tick - minSpan) {
      return;
    }
    const right: EditorSegment = {
      id: crypto.randomUUID(),
      start_tick: at,
      end_tick: seg.end_tick,
      pov_steam_id: seg.pov_steam_id,
    };
    seg.end_tick = at;
    segments.value = [...segments.value, right].sort(
      (a, b) => a.start_tick - b.start_tick,
    );
    selectedId.value = right.id;
  }

  function setSegmentPov(id: string, povSteamId: string | null) {
    const seg = segments.value.find((s) => s.id === id);
    if (!seg) return;
    seg.pov_steam_id = povSteamId;
  }

  function moveSegmentEdge(id: string, edge: "left" | "right", tick: number) {
    const seg = segments.value.find((s) => s.id === id);
    if (!seg) return;
    const minSpan = Math.max(1, Math.round(tickRate.value * 0.5));
    if (edge === "left") {
      seg.start_tick = Math.max(0, Math.min(tick, seg.end_tick - minSpan));
    } else {
      seg.end_tick = Math.max(
        seg.start_tick + minSpan,
        Math.min(tick, totalTicks.value),
      );
    }
  }

  function moveSegmentBody(id: string, deltaTick: number) {
    const seg = segments.value.find((s) => s.id === id);
    if (!seg) return;
    const span = seg.end_tick - seg.start_tick;
    let nextStart = seg.start_tick + deltaTick;
    nextStart = Math.max(0, Math.min(nextStart, totalTicks.value - span));
    seg.start_tick = nextStart;
    seg.end_tick = nextStart + span;
  }

  function commitSort() {
    segments.value = [...segments.value].sort(
      (a, b) => a.start_tick - b.start_tick,
    );
  }

  function startPreview() {
    if (previewing.value) return;
    if (!isValid.value) return;
    previewing.value = true;
    const sorted = sortedSegments.value;
    previewSegmentIndex.value = 0;
    const head = sorted[0];
    if (head.pov_steam_id) {
      const slot = store.specSlots.find(
        (s) => s.steam_id === head.pov_steam_id,
      );
      if (slot) switchToSlot(slot.slot);
    }
    seek(head.start_tick);
    play();
    previewWatcherStop = watch(
      () => [store.currentTick, store.paused] as const,
      ([tick, paused]) => {
        if (!previewing.value) return;
        // Operator paused from the transport bar (or anywhere else) —
        // treat it as ending the preview so the two stay in sync.
        if (paused) {
          stopPreview();
          return;
        }
        const segs = sortedSegments.value;
        const cur = segs[previewSegmentIndex.value];
        if (!cur) {
          stopPreview();
          return;
        }
        if (tick >= cur.end_tick) {
          const nextIndex = previewSegmentIndex.value + 1;
          const next = segs[nextIndex];
          if (!next) {
            // stopPreview() pauses the demo on the way out.
            stopPreview();
            return;
          }
          previewSegmentIndex.value = nextIndex;
          if (next.pov_steam_id) {
            const slot = store.specSlots.find(
              (s) => s.steam_id === next.pov_steam_id,
            );
            if (slot) switchToSlot(slot.slot);
          }
          seek(next.start_tick);
        }
      },
    );
  }

  function stopPreview() {
    const wasPreviewing = previewing.value;
    previewing.value = false;
    previewSegmentIndex.value = -1;
    if (previewWatcherStop) {
      previewWatcherStop();
      previewWatcherStop = null;
    }
    // Stopping a preview should leave the demo paused — whether the
    // operator hit "Stop", the preview ran to its end, or they paused
    // from the transport bar below. Stop the watcher first (above) so
    // this pause() can't re-enter through the paused watch. Guard on
    // paused so we don't fire a redundant pause when already paused
    // (e.g. the user is the one who paused us).
    if (wasPreviewing && !store.paused) pause();
  }

  return {
    active,
    segments,
    sortedSegments,
    selectedId,
    previewing,
    previewSegmentIndex,
    totalSelectedTicks,
    isValid,
    totalTicks,
    tickRate,

    open,
    close,
    reset,

    addSegmentAt,
    addSegmentRange,
    removeSegment,
    splitSegmentAtPlayhead,
    setSegmentPov,
    moveSegmentEdge,
    moveSegmentBody,
    commitSort,

    startPreview,
    stopPreview,
  };
}
