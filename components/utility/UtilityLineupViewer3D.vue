<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import Replay3DLite from "~/components/match/Replay3DLite.vue";
import UtilityExecuteTransport from "~/components/utility/UtilityExecuteTransport.vue";
import UtilityThrowStage from "~/components/utility/UtilityThrowStage.vue";
import { useRadarProjection } from "~/composables/useRadarProjection";
import { normalizeMapName } from "~/utilities/mapAssets";
import { lineupSmokeVoxels } from "~/utilities/lineupSmokeVoxels";
import type { StageSmokeVoxels } from "~/utilities/replayStage/types";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import {
  utilityStageThrow,
  utilityStageThrower,
} from "~/utilities/replayStage/utilityFrame";
import {
  UTILITY_TYPE_COLORS,
  utilityLanding,
  utilityOrigin,
  normalizeTrajectory,
  replayUtilityType,
  replayTeamForSide,
} from "~/utilities/utilityDisplay";
import { SMOKE_BLOOM_SECS } from "~/utils/smokeVolume";
import type { UtilityLineup, UtilityTrajectoryPoint } from "~/types/utility";

const props = defineProps<{
  lineup: UtilityLineup;
  /** Fills the box it is put in -- the map's square -- instead of 16:10. */
  fill?: boolean;
}>();

// One synthetic grenade, so Replay3DLite renders a lineup with exactly the same
// code path it renders a demo with. Nothing about the renderer is utility-aware.
const SYNTHETIC_GID = 1;
const TICK_RATE = 64;

const radarFailed = ref(false);
const { radarSrc, calibration, projectCalibrated } = useRadarProjection(
  () => props.lineup.map_name,
  {
    radarFailed,
    volumePoints: () => {
      const landing = utilityLanding(props.lineup);
      const origin = utilityOrigin(props.lineup);
      return landing ? [origin, landing] : [origin];
    },
  },
);

const runtimeConfig = useRuntimeConfig();
const meshCdn = (runtimeConfig.public.mapMeshCdn as string) || "";
const apiDomain = runtimeConfig.public.apiDomain as string;

const mapName = computed(() => normalizeMapName(props.lineup.map_name) || null);

const replayType = computed(() => replayUtilityType(props.lineup.utility_type));
const throwerTeam = computed(() => replayTeamForSide(props.lineup.side));

const trajectory = computed<UtilityTrajectoryPoint[]>(() => {
  const preview = normalizeTrajectory(props.lineup.trajectory_preview);
  if (preview.length >= 2) {
    return preview;
  }
  const landing = utilityLanding(props.lineup);
  if (!landing) {
    return [];
  }
  return [
    {
      // double precision arrives as a string; three.js wants numbers.
      x: Number(props.lineup.origin_x),
      y: Number(props.lineup.origin_y),
      z: Number(props.lineup.eye_z ?? props.lineup.origin_z),
    },
    landing,
  ];
});

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
const progress = ref(0);
const settledMs = ref(0);
const running = ref(false);
let frame: number | null = null;
let startedAt = 0;

const lengthMs = computed(() => flightMs.value + SETTLE_MS);
const position = computed(
  () => (progress.value * flightMs.value + settledMs.value) / 1000,
);

function show(elapsed: number) {
  progress.value = Math.min(1, elapsed / flightMs.value);
  settledMs.value = Math.max(0, elapsed - flightMs.value);
}

function tickFrame(now: number) {
  // A frame's timestamp can predate the play() that scheduled it, and a
  // negative progress indexed the trajectory from the end -- undefined.x.
  const elapsed = Math.max(0, now - startedAt);
  show(Math.min(elapsed, lengthMs.value));
  if (elapsed < lengthMs.value) {
    frame = requestAnimationFrame(tickFrame);
    return;
  }
  frame = null;
  running.value = false;
}

function play(fromMs = 0) {
  if (frame !== null) {
    cancelAnimationFrame(frame);
  }
  show(fromMs);
  startedAt = performance.now() - fromMs;
  running.value = true;
  frame = requestAnimationFrame(tickFrame);
}

function replay() {
  play(0);
}

function pause() {
  if (frame !== null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
  running.value = false;
}

// Pause it, carry on from where it stopped, or throw it again once done.
function toggle() {
  const at = position.value * 1000;
  if (running.value) {
    pause();
  } else {
    play(at >= lengthMs.value ? 0 : at);
  }
}

function seek(seconds: number) {
  const at = Math.min(lengthMs.value, Math.max(0, seconds * 1000));
  show(at);
  if (running.value) {
    startedAt = performance.now() - at;
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
  if (frame !== null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
  running.value = false;
  if (throwTimer) {
    clearTimeout(throwTimer);
    throwTimer = null;
  }
  progress.value = 0;
  settledMs.value = 0;
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
    replay();
  }, 200);
}

watch(
  () => props.lineup.id,
  () => stop(),
);

onBeforeUnmount(stop);

// Room around the throw for what it turns into: a smoke's cloud, a fire's
// spread, a flash's burst.
const BURST_UNITS: Partial<Record<string, number>> = {
  Smoke: 180,
  Molotov: 150,
};

// Where the camera settles: over the middle of the whole arc, looking from
// behind the thrower toward where it lands. The arc's height counts as much as
// its length -- a pop flash thrown straight up barely moves across the ground,
// and framing only that cut the flash off the top.
const cameraFrame = computed(() => {
  const origin = utilityOrigin(props.lineup);
  const landing = utilityLanding(props.lineup);
  const points = [
    origin,
    ...(landing ? [landing] : []),
    ...normalizeTrajectory(props.lineup.trajectory_preview),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  const across = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const tall = Math.max(...zs) - Math.min(...zs);
  const burst = BURST_UNITS[props.lineup.utility_type] ?? 110;
  return {
    x: (Math.max(...xs) + Math.min(...xs)) / 2,
    y: (Math.max(...ys) + Math.min(...ys)) / 2,
    z: (Math.max(...zs) + Math.min(...zs)) / 2,
    span: Math.max(across, tall * 1.3) + burst * 2 + 200,
    heading: landing
      ? Math.atan2(landing.y - origin.y, landing.x - origin.x)
      : null,
    // 45° off the line of the throw, so the arc reads as an arc.
    swing: Math.PI / 4,
  };
});

const landed = computed(() => progress.value >= 1);

const bloom = computed(() =>
  Math.min(1, settledMs.value / 1000 / SMOKE_BLOOM_SECS),
);

function pointAtProgress(fraction: number): UtilityTrajectoryPoint {
  const points = trajectory.value;
  if (points.length === 0) {
    return {
      x: Number(props.lineup.origin_x),
      y: Number(props.lineup.origin_y),
      z: 0,
    };
  }
  const index = Math.max(
    0,
    Math.min(points.length - 1, Math.floor(fraction * (points.length - 1))),
  );
  return points[index];
}

const players = computed(() => [
  {
    steamId: props.lineup.id,
    team: throwerTeam.value,
    alive: true,
    x: Number(props.lineup.origin_x),
    y: Number(props.lineup.origin_y),
    z: Number(props.lineup.origin_z),
    yaw: Number(props.lineup.view_yaw ?? 0),
    pitch: Number(props.lineup.view_pitch ?? 0),
    health: 100,
    armor: 0,
  },
]);

const names = computed(() => ({ [props.lineup.id]: props.lineup.name }));

const avatars = computed(() => {
  const author = props.lineup.author;
  const url = resolveAvatarUrl(
    author?.custom_avatar_url || author?.avatar_url,
    apiDomain,
  );
  return url ? { [props.lineup.id]: url } : {};
});

const grenadeTrajectories = computed(() => {
  const points = trajectory.value;
  if (points.length < 2) {
    return [];
  }
  return [
    {
      gid: SYNTHETIC_GID,
      pts: points.map((point, index) => ({
        t: point.t ?? index / (points.length - 1),
        x: point.x,
        y: point.y,
        z: point.z,
      })),
    },
  ];
});

// The arc tube comes from `inFlight` rather than a selected `roundUtilities`
// entry: a selected utility also draws a thrower ghost, which would sit exactly
// on top of the player token already standing at the throw origin.
const inFlight = computed(() => {
  const points = trajectory.value;
  if (points.length < 2) {
    return [];
  }
  const head = pointAtProgress(progress.value);
  const last = points[points.length - 1];
  return [
    {
      key: props.lineup.id,
      gid: SYNTHETIC_GID,
      type: replayType.value,
      fromX: points[0].x,
      fromY: points[0].y,
      toX: last.x,
      toY: last.y,
      x: head.x,
      y: head.y,
      z: head.z,
      progress: progress.value,
    },
  ];
});

const grenades = computed(() => {
  if (!landed.value) {
    return [];
  }
  const landing = utilityLanding(props.lineup);
  if (!landing) {
    return [];
  }
  return [
    {
      rx: landing.x,
      ry: landing.y,
      rz: landing.z,
      type: replayType.value,
      life: 1,
      bloom: bloom.value,
      grenade_id: SYNTHETIC_GID,
      thrower_team: throwerTeam.value,
    },
  ];
});

// The renderer derives its roof cut from the tallest player it has seen, and a
// lineup only has one. Take the highest point of the throw instead, so the cut
// never slices through the arc it is meant to show.
const autoCeilingZ = computed(() => {
  let highest = Math.max(
    Number(props.lineup.origin_z),
    Number(props.lineup.eye_z ?? props.lineup.origin_z),
    Number(props.lineup.land_z ?? props.lineup.origin_z),
  );
  for (const point of trajectory.value) {
    if (point.z > highest) {
      highest = point.z;
    }
  }
  return highest + 400;
});

// The fallback renderer's roof cut: on a view mesh ~160u above each floor
// keeps the walls a throw has to clear while still opening interior
// ceilings; the .tri keeps its own plane-based default. The stage ghosts
// roofs by itself.
const VIEW_CEILING = 58;
const TRI_CEILING = 70;
const meshKind = ref<"view" | "tri" | "radar" | null>(null);
const ceiling = computed(() =>
  meshKind.value === "view" ? VIEW_CEILING : TRI_CEILING,
);

// Only reached if the mesh 404s mid-flight and the renderer drops back to the
// flat radar plane; in mesh mode nothing calls this.
function project(point: { x: number; y: number; z?: number }) {
  return projectCalibrated(point) ?? { x: 0, y: 0 };
}

const tick = computed(() =>
  Math.round(((progress.value * flightMs.value) / 1000) * TICK_RATE),
);

// The replay stage draws it unless this browser or map cannot; then the
// renderer above does, as it always has.
const stageFailed = ref(false);

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
      v-if="!stageFailed"
      :map-name="lineup.map_name"
      :throws="stageThrows"
      :throwers="stageThrowers"
      :time="stageTime"
      :controls="fill ? 64 : 56"
      @mesh="(kind) => (meshKind = kind)"
      @framed="onFramed"
      @fallback="stageFailed = true"
    />
    <Replay3DLite
      v-else
      :map-name="mapName"
      :mesh-cdn="meshCdn"
      :radar-src="radarSrc"
      :resolution="calibration?.resolution ?? 1"
      :project="project"
      :players="players"
      :names="names"
      :avatars="avatars"
      :grenade-trajectories="grenadeTrajectories"
      :in-flight="inFlight"
      :grenades="grenades"
      :tick="tick"
      :tick-rate="TICK_RATE"
      :ceiling="ceiling"
      :auto-ceiling-z="autoCeilingZ"
      cam-mode="orbit"
      :frame="cameraFrame"
      @mesh="(kind) => (meshKind = kind)"
      @framed="onFramed"
    />

    <UtilityExecuteTransport
      class="absolute z-[10]"
      :class="fill ? 'inset-x-3 bottom-3' : 'inset-x-2 bottom-2'"
      :position="position"
      :started-at="null"
      :length="lengthMs / 1000"
      :running="running"
      :beats="landingTick"
      :label="$t('pages.utility.viewer.timeline')"
      @toggle="toggle"
      @seek="seek"
    />
  </div>
</template>
