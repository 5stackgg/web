<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Play, RotateCcw } from "lucide-vue-next";
import { Slider } from "~/components/ui/slider";
import Replay3DLite from "~/components/match/Replay3DLite.vue";
import { useRadarProjection } from "~/composables/useRadarProjection";
import { meshUrlForMap, normalizeMapName } from "~/utilities/mapAssets";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import {
  utilityLanding,
  normalizeTrajectory,
  replayUtilityType,
  replayTeamForSide,
} from "~/utilities/utilityDisplay";
import { SMOKE_BLOOM_SECS } from "~/utils/smokeVolume";
import type { SmokeVolume } from "~/utils/smokeVolume";
import type { UtilityLineup, UtilityTrajectoryPoint } from "~/types/utility";

const props = defineProps<{
  lineup: UtilityLineup;
}>();

// One synthetic grenade, so Replay3DLite renders a lineup with exactly the same
// code path it renders a demo with. Nothing about the renderer is utility-aware.
const SYNTHETIC_GID = 1;
const TICK_RATE = 64;

const radarFailed = ref(false);
const { radarSrc, calibration, projectCalibrated } = useRadarProjection(
  () => props.lineup.map_name,
  { radarFailed },
);

const runtimeConfig = useRuntimeConfig();
const meshCdn = runtimeConfig.public.mapMeshCdn as string;
const apiDomain = runtimeConfig.public.apiDomain as string;

const mapMeshUrl = computed(() => {
  const name = normalizeMapName(props.lineup.map_name);
  return meshUrlForMap(meshCdn, name ?? "");
});

const replayType = computed(() => replayUtilityType(props.lineup.utility_type));
const throwerTeam = computed(() => replayTeamForSide(props.lineup.side));

const fullTrajectory = ref<UtilityTrajectoryPoint[] | null>(null);
const smokeVolume = ref<SmokeVolume | null>(null);

const trajectory = computed<UtilityTrajectoryPoint[]>(() => {
  if (fullTrajectory.value?.length) {
    return fullTrajectory.value;
  }
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

async function loadTrajectory() {
  fullTrajectory.value = null;
  smokeVolume.value = null;
  // The size is written with the file and is safe to select; the S3 key is
  // not something the browser needs to know.
  if (!props.lineup.trajectory_size) {
    return;
  }
  try {
    const response = await fetch(
      `https://${apiDomain}/utility/${props.lineup.id}/trajectory`,
      { credentials: "include" },
    );
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    const points = normalizeTrajectory(payload?.points ?? payload);
    if (points.length >= 2) {
      fullTrajectory.value = points;
    }
    const volume = payload?.smoke_volume ?? payload?.smokeVolume ?? null;
    if (volume) {
      smokeVolume.value = { ...volume, gid: SYNTHETIC_GID } as SmokeVolume;
    }
  } catch {
    fullTrajectory.value = null;
  }
}

const flightMs = computed(() => {
  const recorded = props.lineup.flight_time_ms;
  if (recorded && recorded > 0) {
    return recorded;
  }
  return 2000;
});

const progress = ref(0);
const settledMs = ref(0);
let frame: number | null = null;
let startedAt = 0;

function tickFrame(now: number) {
  const elapsed = now - startedAt;
  progress.value = Math.min(1, elapsed / flightMs.value);
  settledMs.value = Math.max(0, elapsed - flightMs.value);
  if (settledMs.value < 4000) {
    frame = requestAnimationFrame(tickFrame);
    return;
  }
  frame = null;
}

function replay() {
  if (frame !== null) {
    cancelAnimationFrame(frame);
  }
  progress.value = 0;
  settledMs.value = 0;
  startedAt = performance.now();
  frame = requestAnimationFrame(tickFrame);
}

onMounted(() => {
  void loadTrajectory();
  replay();
});

watch(
  () => props.lineup.id,
  () => {
    void loadTrajectory();
    replay();
  },
);

onBeforeUnmount(() => {
  if (frame !== null) {
    cancelAnimationFrame(frame);
  }
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
  const index = Math.min(
    points.length - 1,
    Math.floor(fraction * (points.length - 1)),
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

const smokeVolumes = computed(() =>
  smokeVolume.value ? [smokeVolume.value] : [],
);

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

const ceiling = ref(70);

// Only reached if the mesh 404s mid-flight and the renderer drops back to the
// flat radar plane; in mesh mode nothing calls this.
function project(point: { x: number; y: number; z?: number }) {
  return projectCalibrated(point) ?? { x: 0, y: 0 };
}

const tick = computed(() =>
  Math.round(((progress.value * flightMs.value) / 1000) * TICK_RATE),
);
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-md border border-border bg-[#08101f]"
    style="aspect-ratio: 16 / 10"
  >
    <Replay3DLite
      :map-mesh-url="mapMeshUrl"
      :radar-src="radarSrc"
      :resolution="calibration?.resolution ?? 1"
      :project="project"
      :players="players"
      :names="names"
      :avatars="avatars"
      :grenade-trajectories="grenadeTrajectories"
      :in-flight="inFlight"
      :grenades="grenades"
      :smoke-volumes="smokeVolumes"
      :tick="tick"
      :tick-rate="TICK_RATE"
      :ceiling="ceiling"
      :auto-ceiling-z="autoCeilingZ"
      cam-mode="orbit"
    />

    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 z-[10] flex items-end justify-between gap-4 p-3"
    >
      <button
        type="button"
        class="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-black/60 px-3 py-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] backdrop-blur transition-colors hover:bg-black/80"
        @click="replay()"
      >
        <component :is="landed ? RotateCcw : Play" class="h-3.5 w-3.5" />
        {{ $t("pages.utility.viewer.replay_throw") }}
      </button>

      <div
        class="pointer-events-auto flex w-40 flex-col gap-1 rounded-md border border-border/60 bg-black/60 px-3 py-2 backdrop-blur"
      >
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-white/70"
        >
          {{ $t("pages.utility.viewer.roof") }}
        </span>
        <Slider
          :model-value="[ceiling]"
          :min="0"
          :max="100"
          :step="1"
          @update:model-value="(value) => (ceiling = value?.[0] ?? 70)"
        />
      </div>
    </div>
  </div>
</template>
