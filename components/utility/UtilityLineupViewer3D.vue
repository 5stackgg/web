<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Slider } from "~/components/ui/slider";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import Replay3DLite from "~/components/match/Replay3DLite.vue";
import { useRadarProjection } from "~/composables/useRadarProjection";
import { normalizeMapName } from "~/utilities/mapAssets";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import {
  utilityLanding,
  utilityOrigin,
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
  // A frame's timestamp can predate the replay() that scheduled it, and a
  // negative progress indexed the trajectory from the end -- undefined.x.
  const elapsed = Math.max(0, now - startedAt);
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

function stop() {
  if (frame !== null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
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

onMounted(() => {
  void loadTrajectory();
});

watch(
  () => props.lineup.id,
  () => {
    stop();
    void loadTrajectory();
  },
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
// and framing only that cut the flash off the top. Built from the lineup's own
// preview, not the full trajectory that loads after it, so the frame does not
// shift (and restart the throw) when the detailed path arrives.
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

// A view mesh cuts walls at a height above their own floor; ~160u keeps the
// walls a throw has to clear while still opening interior ceilings. The .tri
// fallback keeps its own plane-based default.
const VIEW_CEILING = 58;
const TRI_CEILING = 70;
const meshKind = ref<"view" | "tri" | "radar" | null>(null);
const ceilingChoice = ref<number | null>(null);
const ceiling = computed(
  () =>
    ceilingChoice.value ??
    (meshKind.value === "view" ? VIEW_CEILING : TRI_CEILING),
);

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
      :smoke-volumes="smokeVolumes"
      :tick="tick"
      :tick-rate="TICK_RATE"
      :ceiling="ceiling"
      :auto-ceiling-z="autoCeilingZ"
      cam-mode="orbit"
      :frame="cameraFrame"
      @mesh="(kind) => (meshKind = kind)"
      @framed="onFramed"
    />

    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 z-[10] flex items-end justify-between gap-4 p-3"
    >
      <button
        type="button"
        class="pointer-events-auto inline-flex h-8 items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-black/60 px-3 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] backdrop-blur transition-colors hover:bg-black/80"
        @click="replay()"
      >
        <!-- One glyph for "throw it again": the arc a grenade flies, out of
             the hand and over to an arrowhead. A play triangle that turned
             into a rotate arrow mid-throw said two different things. -->
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="h-4 w-4"
        >
          <path d="M2.4 12.4C3.6 6.2 8 3.2 13.4 5.6" />
          <path d="M10.2 3.5l3.2 2.1l-2 3.2" />
          <circle cx="2.4" cy="12.6" r="1.4" fill="currentColor" stroke="none" />
        </svg>
        {{ $t("pages.utility.viewer.replay_throw") }}
      </button>

      <!-- One line, the height of the button beside it: a roof glyph where
           the word was, the word on its tooltip. A label stacked over the
           slider made this the tallest thing on the picture. -->
      <div
        class="pointer-events-auto flex h-8 w-36 items-center gap-2.5 rounded-md border border-border/60 bg-black/60 pl-2.5 pr-3 backdrop-blur"
      >
        <FiveStackToolTip as-child side="top" :delay-duration="120">
          <template #trigger>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4 shrink-0 text-white/75"
              role="img"
              :aria-label="$t('pages.utility.viewer.roof')"
            >
              <!-- A roof, and the line it is cut at. -->
              <path d="M1.5 8 8 2.5 14.5 8" />
              <path d="M3.5 12.5h9" stroke-dasharray="1.5 2.5" />
            </svg>
          </template>
          {{ $t("pages.utility.viewer.roof") }}
        </FiveStackToolTip>
        <Slider
          class="min-w-0 flex-1"
          :model-value="[ceiling]"
          :min="0"
          :max="100"
          :step="1"
          :aria-label="$t('pages.utility.viewer.roof')"
          @update:model-value="
            (value) => (ceilingChoice = value?.[0] ?? ceiling)
          "
        />
      </div>
    </div>
  </div>
</template>
