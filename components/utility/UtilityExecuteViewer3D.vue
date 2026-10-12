<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ReplayStageUnavailable from "~/components/match/ReplayStageUnavailable.vue";
import UtilityThrowStage from "~/components/utility/UtilityThrowStage.vue";
import { lineupSmokeVoxels } from "~/utilities/lineupSmokeVoxels";
import type { StageSmokeVoxels } from "~/utilities/replayStage/types";
import {
  utilityStageThrow,
  utilityStageThrower,
} from "~/utilities/replayStage/utilityFrame";
import type { UtilityStageThrow } from "~/utilities/replayStage/utilityFrame";
import type { UtilityLineup } from "~/types/utility";

/** What the scene needs of a step: what is thrown, when, and by whom. */
type Beat = {
  key: string;
  /** 0-based: one less than the number the step wears. */
  index: number;
  /** Null when the step points at a lineup this viewer cannot see. */
  lineup: UtilityLineup | null;
  seconds: number;
  who: string | null;
};

/**
 * An execute, thrown in the same scene a single lineup is replayed in: every
 * thrower standing where they throw from, every grenade leaving on its beat.
 *
 * The clock is not kept here. The panel that opened the execute runs it, so
 * the timeline in the card, the label in the dock and this scene are one
 * clock; this only draws the moment it is handed.
 */
const props = withDefaults(
  defineProps<{
    mapName: string;
    beats: Beat[];
    /** Seconds into the run, or null before it has been played. */
    clock: number | null;
    /**
     * The `performance.now()` the run started at while it runs, null while
     * it is paused. The clock moves in tenths, which is fine for a label and
     * a stutter for a grenade in the air, so between its ticks the scene
     * reads the same run off its start.
     */
    startedAt?: number | null;
    /** Fills the box it is put in -- the map's square -- instead of 16:10. */
    fill?: boolean;
    /** CSS px at the bottom the owner's controls cover; the shot avoids it. */
    controls?: number;
  }>(),
  { startedAt: null, fill: false, controls: 0 },
);

const emit = defineEmits<{
  // The camera has arrived, so a run started now is a run you can see.
  (e: "framed"): void;
}>();

// One entry per step that can be drawn, in the order they are thrown. Every
// step is its own grenade, so a lineup thrown twice is two of them.
const throws = computed(() =>
  props.beats
    .filter(
      (beat): beat is Beat & { lineup: UtilityLineup } => !!beat.lineup,
    )
    .map((beat) => {
      const lineup = beat.lineup;
      return {
        key: beat.key,
        gid: beat.index + 1,
        lineup,
        who: beat.who,
        start: beat.seconds,
      };
    })
    .sort((a, b) => a.start - b.start || a.gid - b.gid),
);

/**
 * The moment the scene draws. Before the first run nothing has been thrown;
 * once one has been played, standing still means the finished execute --
 * every grenade landed -- so that is what you are left looking at.
 */
const BEFORE = -1;
const AFTER = Number.POSITIVE_INFINITY;

const time = ref(BEFORE);
let played = false;
let frame: number | null = null;
let lastFrameAt = 0;

function tickFrame(now: number) {
  lastFrameAt = now;
  if (props.clock === null || props.startedAt === null) {
    frame = null;
    return;
  }
  // A frame's timestamp can predate the run it belongs to.
  time.value = Math.max(0, (now - props.startedAt) / 1000);
  frame = requestAnimationFrame(tickFrame);
}

function stopFrames() {
  if (frame !== null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
}

watch(
  () => [props.clock, props.startedAt] as const,
  ([clock, startedAt]) => {
    if (clock === null) {
      stopFrames();
      time.value = played ? AFTER : BEFORE;
      return;
    }
    played = true;
    // Paused, or scrubbed while paused: the clock is the moment.
    if (startedAt === null) {
      stopFrames();
      time.value = clock;
      return;
    }
    // While frames are arriving they are the smoother reading of the same
    // run. Without them -- a hidden tab -- the clock's own value is.
    if (performance.now() - lastFrameAt > 200) {
      time.value = clock;
    }
    if (frame === null) {
      frame = requestAnimationFrame(tickFrame);
    }
  },
  { immediate: true },
);

onBeforeUnmount(stopFrames);

// Somebody stands where each lineup is thrown from. A lineup thrown twice is
// one person on one spot, so it is one token.
const tokens = computed(() => {
  const seen = new Set<string>();
  const out: Array<{ id: string; name: string; entry: (typeof throws.value)[number] }> =
    [];
  for (const entry of throws.value) {
    if (seen.has(entry.lineup.id)) {
      continue;
    }
    seen.add(entry.lineup.id);
    out.push({
      id: `thrower-${entry.lineup.id}`,
      name: entry.who ?? entry.lineup.name,
      entry,
    });
  }
  return out;
});

onMounted(() => {
  // Nothing to fly to: say so, or whatever waits on the camera waits forever.
  if (!throws.value.length) {
    emit("framed");
  }
});

// No WebGL2, or no model of this map: a message stands in the stage's place,
// and the run goes ahead on the card's timeline without waiting for a camera.
const stageUnavailable = ref<"unsupported" | "missing-map" | null>(null);
function onUnavailable(reason: "unsupported" | "missing-map") {
  stageUnavailable.value = reason;
  emit("framed");
}

// Each smoke's real cloud, when the plugin has recorded it, by lineup.
const smokeVoxels = ref<Record<string, StageSmokeVoxels>>({});
watch(
  () => throws.value.map((entry) => entry.lineup),
  (lineups) => {
    for (const lineup of lineups) {
      const url = lineup.smoke_voxels_url;
      if (!url) {
        continue;
      }
      void lineupSmokeVoxels(url).then((voxels) => {
        if (voxels && lineup.smoke_voxels_url === url) {
          smokeVoxels.value = { ...smokeVoxels.value, [lineup.id]: voxels };
        }
      });
    }
  },
  { immediate: true },
);

const stageThrows = computed(() =>
  throws.value
    .map((entry) =>
      utilityStageThrow(entry.lineup, {
        key: entry.key,
        gid: entry.gid,
        start: entry.start,
        voxels: smokeVoxels.value[entry.lineup.id] ?? null,
      }),
    )
    .filter((entry): entry is UtilityStageThrow => !!entry),
);

const stageThrowers = computed(() =>
  tokens.value.map(({ id, name, entry }) =>
    utilityStageThrower(entry.lineup, { id, name }),
  ),
);

// Standing still after a run is the finished execute: the stage's still.
const stageTime = computed(() => (time.value === AFTER ? null : time.value));
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-md border border-border bg-background"
    :class="fill ? 'h-full' : 'aspect-[16/10]'"
  >
    <UtilityThrowStage
      v-if="!stageUnavailable"
      :map-name="mapName"
      :throws="stageThrows"
      :throwers="stageThrowers"
      :time="stageTime"
      :controls="controls"
      @framed="emit('framed')"
      @fallback="onUnavailable"
    />
    <ReplayStageUnavailable v-else :reason="stageUnavailable" />

    <slot />
  </div>
</template>
