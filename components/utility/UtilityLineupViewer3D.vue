<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import ReplayStageUnavailable from "~/components/match/ReplayStageUnavailable.vue";
import UtilityExecuteTransport from "~/components/utility/UtilityExecuteTransport.vue";
import UtilityThrowStage from "~/components/utility/UtilityThrowStage.vue";
import { usePlaybackClock } from "~/composables/usePlaybackClock";
import { lineupSmokeVoxels } from "~/utilities/lineupSmokeVoxels";
import type { StageSmokeVoxels } from "~/utilities/replayStage/types";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import {
  utilityStageThrow,
  utilityStageThrower,
} from "~/utilities/replayStage/utilityFrame";
import { UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = defineProps<{
  lineup: UtilityLineup;
  /** Fills the box it is put in -- the map's square -- instead of 16:10. */
  fill?: boolean;
}>();

// The lineup is the one grenade on the stage.
const SYNTHETIC_GID = 1;

const runtimeConfig = useRuntimeConfig();
const apiDomain = runtimeConfig.public.apiDomain as string;

const flightMs = computed(() => {
  const recorded = props.lineup.flight_time_ms;
  if (recorded && recorded > 0) {
    return recorded;
  }
  return 2000;
});

// The throw plays like a video under its play bar: the flight, then four
// seconds for what it turns into, and it can be paused and scrubbed.
const SETTLE_MS = 4000;
const run = usePlaybackClock({
  length: () => (flightMs.value + SETTLE_MS) / 1000,
});
const elapsedMs = computed(() => (run.position.value ?? 0) * 1000);
const progress = computed(() => Math.min(1, elapsedMs.value / flightMs.value));
const settledMs = computed(() => Math.max(0, elapsedMs.value - flightMs.value));

// Pause it, carry on from where it stopped, or throw it again once done.
function toggle() {
  const at = run.position.value ?? 0;
  if (run.running.value) {
    run.pause();
  } else {
    run.play(at >= run.length.value ? 0 : at);
  }
}

const landingTick = computed(() => [
  {
    key: "lands",
    seconds: flightMs.value / 1000,
    color: UTILITY_TYPE_COLORS[props.lineup.utility_type] ?? "#fff",
  },
]);

function stop() {
  run.stop();
  if (throwTimer) {
    clearTimeout(throwTimer);
    throwTimer = null;
  }
}

// The camera flies in to the throw first and the grenade leaves the hand once
// it is there -- thrown while the map was still loading, it landed before
// anyone could see it.
let throwTimer: ReturnType<typeof setTimeout> | null = null;

function onFramed() {
  if (throwTimer) {
    clearTimeout(throwTimer);
  }
  throwTimer = setTimeout(() => {
    throwTimer = null;
    run.play(0);
  }, 200);
}

watch(
  () => props.lineup.id,
  () => stop(),
);

onBeforeUnmount(stop);

const avatars = computed(() => {
  const author = props.lineup.author;
  const url = resolveAvatarUrl(
    author?.custom_avatar_url || author?.avatar_url,
    apiDomain,
  );
  return url ? { [props.lineup.id]: url } : {};
});

// No WebGL2, or no model of this map: a message stands in the stage's place.
const stageUnavailable = ref<"unsupported" | "missing-map" | null>(null);

// The real smoke, when the plugin has recorded it; until then (or without
// one) the stage floods its own.
const smokeVoxels = ref<StageSmokeVoxels | null>(null);
watch(
  () => props.lineup.smoke_voxels_url,
  async (url) => {
    smokeVoxels.value = null;
    const voxels = await lineupSmokeVoxels(url);
    if (props.lineup.smoke_voxels_url === url) {
      smokeVoxels.value = voxels;
    }
  },
  { immediate: true },
);

const stageThrows = computed(() => {
  const entry = utilityStageThrow(props.lineup, {
    key: props.lineup.id,
    gid: SYNTHETIC_GID,
    voxels: smokeVoxels.value,
  });
  return entry ? [entry] : [];
});

const stageThrowers = computed(() => [
  utilityStageThrower(props.lineup, {
    id: props.lineup.id,
    name: props.lineup.name,
    avatarUrl: avatars.value[props.lineup.id] ?? null,
  }),
]);

// Before the throw, in flight and blooming, then a still once it has settled.
const stageTime = computed(() => {
  if (settledMs.value >= SETTLE_MS) {
    return null;
  }
  if (progress.value === 0 && settledMs.value === 0) {
    return -1;
  }
  return (progress.value * flightMs.value + settledMs.value) / 1000;
});
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-md border border-border bg-background"
    :class="fill ? 'h-full' : 'aspect-[16/10]'"
  >
    <UtilityThrowStage
      v-if="!stageUnavailable"
      :map-name="lineup.map_name"
      :throws="stageThrows"
      :throwers="stageThrowers"
      :time="stageTime"
      :controls="fill ? 64 : 56"
      @framed="onFramed"
      @fallback="(reason) => (stageUnavailable = reason)"
    />
    <ReplayStageUnavailable v-else :reason="stageUnavailable" />

    <UtilityExecuteTransport
      v-if="!stageUnavailable"
      class="absolute z-[10]"
      :class="fill ? 'inset-x-3 bottom-3' : 'inset-x-2 bottom-2'"
      :run="run"
      :running="run.running.value"
      :beats="landingTick"
      :label="$t('pages.utility.viewer.timeline')"
      @toggle="toggle"
      @seek="run.seek"
    />
  </div>
</template>
