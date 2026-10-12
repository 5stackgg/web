<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import ReplayStage from "~/components/match/ReplayStage.vue";
import { useReplayStageSlot } from "~/composables/useReplayStageSlot";
import {
  buildUtilityFrame,
  fitStageShot,
  utilityStageLevel,
  utilityStageShot,
} from "~/utilities/replayStage/utilityFrame";
import type { UtilityStageThrow } from "~/utilities/replayStage/utilityFrame";
import type {
  StagePlayer,
  StageView,
  Vec3,
} from "~/utilities/replayStage/types";

/**
 * A lineup or an execute thrown on the replay stage: the match replay's maps,
 * smokes, fire and camera. Whoever owns the clock hands it `time`; this
 * frames the throws once the map is in and draws the moment it is given.
 */
const props = withDefaults(
  defineProps<{
    mapName: string;
    throws: UtilityStageThrow[];
    throwers: StagePlayer[];
    /** Seconds into the run, -1 before it, null for the finished picture. */
    time: number | null;
    /** CSS px at the bottom the owner's controls cover; the shot avoids it. */
    controls?: number;
  }>(),
  { controls: 0 },
);

const emit = defineEmits<{
  // The camera has arrived, so a run started now is a run you can see.
  (e: "framed"): void;
  // No WebGL2, or no model of this map: the owner says so in its place.
  (e: "fallback", reason: "unsupported" | "missing-map"): void;
}>();

// Steeper than the replay's 64°: a throw usually clears a building, and from
// lower behind the thrower that building hides the cloud or fire it lands in.
const SHOT_PITCH = (70 * Math.PI) / 180;
// Room (CSS px) for the lower half of a timer badge over its cloud.
const BADGE_PX = 30;
// The camera's flight in from the whole map.
const FLY_IN_MS = 800;
// ReplayStage's fade in.
const FADE_MS = 500;

const active = useReplayStageSlot();
const stageEl = ref<InstanceType<typeof ReplayStage> | null>(null);
const view = ref<StageView>("3d");
// What the stage last drew, shown while another holds the page's one stage.
const poster = ref<string | null>(null);
let pose: { eye: Vec3; target: Vec3 } | null = null;
let ready = false;
let timers: Array<ReturnType<typeof setTimeout>> = [];
let offViewKey: (() => void) | null = null;

const frame = computed(() =>
  buildUtilityFrame(props.throws, props.throwers, props.time),
);
const shot = computed(() => utilityStageShot(props.throws));
// The detailed flight landing later moves the shot a few units, not enough
// to fly the camera in again.
const shotKey = computed(() => {
  const s = shot.value;
  if (!s) {
    return "";
  }
  const key = [Math.round(s.heading * 20), Math.round(s.floor / 32)];
  for (const axis of ["x", "y", "z"] as const) {
    const values = s.points.map((point) => point[axis]);
    key.push(
      Math.round(Math.min(...values) / 32),
      Math.round(Math.max(...values) / 32),
    );
  }
  return key.join();
});
const level = computed(() => utilityStageLevel(props.mapName, props.throws));

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms));
}

function frameShot() {
  const camera = stageEl.value?.camera;
  const stage = stageEl.value?.stage;
  if (!camera || !stage) {
    return;
  }
  const s = shot.value;
  if (s) {
    // 2D keeps north up and looks straight down.
    const flat = stage.ctx.view === "2d";
    const lens = stage.ctx.camera;
    const tanV = Math.tan((lens.fov * Math.PI) / 360);
    const fit = fitStageShot(
      s.points,
      flat ? 0 : s.heading,
      flat ? Math.PI / 2 : SHOT_PITCH,
      tanV,
      lens.aspect,
      s.floor,
      {
        top: Math.min(0.2, BADGE_PX / stage.ctx.height),
        bottom: Math.min(0.3, props.controls / stage.ctx.height),
      },
    );
    // `focus` takes the ground that has to fit, and backs off to show it.
    const radius = fit.distance * tanV * Math.min(1, lens.aspect);
    camera.focus(fit.target, radius, true, {
      heading: s.heading,
      pitch: SHOT_PITCH,
    });
  } else {
    camera.frameMap(true);
  }
  later(() => emit("framed"), FLY_IN_MS);
}

function onReady() {
  const camera = stageEl.value?.camera;
  if (!camera) {
    return;
  }
  ready = true;
  offViewKey?.();
  offViewKey = camera.onViewKey(() => {
    view.value = view.value === "3d" ? "2d" : "3d";
  });
  // Back from another stage: where it was left, not flown in again.
  if (pose) {
    camera.place(pose.eye, pose.target);
    pose = null;
  } else {
    frameShot();
  }
  later(() => (poster.value = null), FADE_MS);
}

watch(stageEl, (el) => el?.whenReady(onReady));
watch(shotKey, () => ready && frameShot());

// Another view took the page's stage: keep a picture of this one, and where
// the camera was, until it comes back.
watch(active, (on, was) => {
  const el = stageEl.value;
  if (on || !was || !ready || !el?.stage) {
    return;
  }
  const stage = el.stage;
  ready = false;
  pose = el.camera?.pose() ?? null;
  stage.render();
  poster.value = stage.ctx.renderer.domElement.toDataURL("image/jpeg", 0.85);
});

onBeforeUnmount(() => {
  timers.forEach(clearTimeout);
  timers = [];
  offViewKey?.();
});
</script>

<template>
  <div class="absolute inset-0">
    <img
      v-if="poster"
      :src="poster"
      alt=""
      class="pointer-events-none absolute inset-0 h-full w-full object-cover"
    />
    <ReplayStage
      v-if="active"
      ref="stageEl"
      class="absolute inset-0"
      :map-name="mapName"
      :frame="frame"
      :view="view"
      :level="level"
      level-layout="single"
      @unsupported="emit('fallback', 'unsupported')"
      @missing-map="emit('fallback', 'missing-map')"
    />
  </div>
</template>
