<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Slider } from "~/components/ui/slider";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import Replay3DLite from "~/components/match/Replay3DLite.vue";
import { useRadarProjection } from "~/composables/useRadarProjection";
import { normalizeMapName } from "~/utilities/mapAssets";
import {
  executeFlightSeconds,
  utilityLanding,
  utilityOrigin,
  normalizeTrajectory,
  replayUtilityType,
  replayTeamForSide,
} from "~/utilities/utilityDisplay";
import { SMOKE_BLOOM_SECS } from "~/utils/smokeVolume";
import type { SmokeVolume } from "~/utils/smokeVolume";
import type { UtilityLineup, UtilityTrajectoryPoint } from "~/types/utility";

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
    /** Seconds into the run, or null while it is not being played. */
    clock: number | null;
    /**
     * The `performance.now()` the run started at. The clock moves in tenths,
     * which is fine for a label and a stutter for a grenade in the air, so
     * between its ticks the scene reads the same run off its start.
     */
    startedAt?: number | null;
    /** Fills the box it is put in -- the map's square -- instead of 16:10. */
    fill?: boolean;
  }>(),
  { startedAt: null, fill: false },
);

const emit = defineEmits<{
  // The camera has arrived, so a run started now is a run you can see.
  (e: "framed"): void;
}>();

// Replay3DLite keeps twelve tokens and twelve arcs. An execute can be written
// longer than that; past it the newest throws are the ones drawn.
const SCENE_SLOTS = 12;
const TICK_RATE = 64;

const runtimeConfig = useRuntimeConfig();
const meshCdn = (runtimeConfig.public.mapMeshCdn as string) || "";
const apiDomain = runtimeConfig.public.apiDomain as string;

const sceneMap = computed(() => normalizeMapName(props.mapName) || null);

// The detailed path and the measured cloud of each lineup, by lineup id. Both
// arrive after the scene does; until then a throw flies its preview.
const fullTrajectories = ref<Record<string, UtilityTrajectoryPoint[]>>({});
const smokeVolumesByLineup = ref<Record<string, SmokeVolume>>({});

function previewOf(lineup: UtilityLineup): UtilityTrajectoryPoint[] {
  const preview = normalizeTrajectory(lineup.trajectory_preview);
  if (preview.length >= 2) {
    return preview;
  }
  const landing = utilityLanding(lineup);
  if (!landing) {
    return [];
  }
  return [
    {
      // double precision arrives as a string; three.js wants numbers.
      x: Number(lineup.origin_x),
      y: Number(lineup.origin_y),
      z: Number(lineup.eye_z ?? lineup.origin_z),
    },
    landing,
  ];
}

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
        flight: executeFlightSeconds(lineup),
        type: replayUtilityType(lineup.utility_type),
        team: replayTeamForSide(lineup.side),
        origin: utilityOrigin(lineup),
        landing: utilityLanding(lineup),
        points: fullTrajectories.value[lineup.id] ?? previewOf(lineup),
      };
    })
    .sort((a, b) => a.start - b.start || a.gid - b.gid),
);

// Only used if the mesh fails mid-flight and the renderer drops to the flat
// radar. Declared after the throws it reads.
const radarFailed = ref(false);
const { radarSrc, calibration, projectCalibrated } = useRadarProjection(
  () => props.mapName,
  {
    radarFailed,
    volumePoints: () =>
      throws.value.map((entry) => entry.landing ?? entry.origin),
  },
);

let loadToken = 0;
async function loadTrajectories(lineups: UtilityLineup[]) {
  const token = ++loadToken;
  // The size is written with the file and is safe to select; the S3 key is
  // not something the browser needs to know.
  const wanted = lineups.filter(
    (lineup) => lineup.trajectory_size && !fullTrajectories.value[lineup.id],
  );
  await Promise.all(
    wanted.map(async (lineup) => {
      try {
        const response = await fetch(
          `https://${apiDomain}/utility/${lineup.id}/trajectory`,
          { credentials: "include" },
        );
        if (!response.ok || token !== loadToken) {
          return;
        }
        const payload = await response.json();
        if (token !== loadToken) {
          return;
        }
        const points = normalizeTrajectory(payload?.points ?? payload);
        if (points.length >= 2) {
          fullTrajectories.value = {
            ...fullTrajectories.value,
            [lineup.id]: points,
          };
        }
        const volume = payload?.smoke_volume ?? payload?.smokeVolume ?? null;
        if (volume) {
          smokeVolumesByLineup.value = {
            ...smokeVolumesByLineup.value,
            [lineup.id]: volume as SmokeVolume,
          };
        }
      } catch {
        // The preview already flies; the detail is only a better line.
      }
    }),
  );
}

watch(
  () =>
    [...new Set(throws.value.map((entry) => entry.lineup.id))].sort().join(),
  () => {
    const seen = new Set<string>();
    void loadTrajectories(
      throws.value
        .map((entry) => entry.lineup)
        .filter((lineup) => !seen.has(lineup.id) && seen.add(lineup.id)),
    );
  },
  { immediate: true },
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
  () => props.clock,
  (clock) => {
    if (clock === null) {
      stopFrames();
      time.value = played ? AFTER : BEFORE;
      return;
    }
    played = true;
    // While frames are arriving they are the smoother reading of the same
    // run. Without them -- a hidden tab, or a clock moved by hand -- the
    // clock's own value is the moment.
    if (performance.now() - lastFrameAt > 200) {
      time.value = clock;
    }
    if (frame === null && props.startedAt !== null) {
      frame = requestAnimationFrame(tickFrame);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopFrames();
  loadToken += 1;
});

// Room around a throw for what it turns into: a smoke's cloud, a fire's
// spread, a flash's burst.
const BURST_UNITS: Partial<Record<string, number>> = {
  Smoke: 180,
  Molotov: 150,
};

// One frame for the whole execute: every place somebody stands, every landing
// and every arc, seen from the throwers' side looking toward where it all
// lands. Built from the lineups' own previews and never from the detailed
// paths that load afterwards, so it is the same frame before, during and
// after a run -- the renderer flies in again whenever its frame changes.
const cameraFrame = computed(() => {
  const points: UtilityTrajectoryPoint[] = [];
  const origins: UtilityTrajectoryPoint[] = [];
  const landings: UtilityTrajectoryPoint[] = [];
  let burst = 110;
  for (const entry of throws.value) {
    origins.push(entry.origin);
    points.push(entry.origin, ...previewOf(entry.lineup));
    if (entry.landing) {
      landings.push(entry.landing);
      points.push(entry.landing);
    }
    burst = Math.max(burst, BURST_UNITS[entry.lineup.utility_type] ?? 110);
  }
  if (!points.length) {
    return null;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  const across = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const tall = Math.max(...zs) - Math.min(...zs);
  const centre = (list: UtilityTrajectoryPoint[], axis: "x" | "y") =>
    list.reduce((sum, point) => sum + point[axis], 0) / list.length;
  return {
    x: (Math.max(...xs) + Math.min(...xs)) / 2,
    y: (Math.max(...ys) + Math.min(...ys)) / 2,
    z: (Math.max(...zs) + Math.min(...zs)) / 2,
    span: Math.max(across, tall * 1.3) + burst * 2 + 200,
    heading: landings.length
      ? Math.atan2(
          centre(landings, "y") - centre(origins, "y"),
          centre(landings, "x") - centre(origins, "x"),
        )
      : null,
    // 45° off the line of the throws, so the arcs read as arcs.
    swing: Math.PI / 4,
  };
});

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
  return out.slice(0, SCENE_SLOTS);
});

const players = computed(() =>
  tokens.value.map(({ id, entry }) => ({
    steamId: id,
    team: entry.team,
    alive: true,
    x: entry.origin.x,
    y: entry.origin.y,
    z: entry.origin.z,
    yaw: Number(entry.lineup.view_yaw ?? 0),
    pitch: Number(entry.lineup.view_pitch ?? 0),
    health: 100,
    armor: 0,
  })),
);

const names = computed(() =>
  Object.fromEntries(tokens.value.map(({ id, name }) => [id, name])),
);

const grenadeTrajectories = computed(() =>
  throws.value
    .filter((entry) => entry.points.length >= 2)
    .map((entry) => ({
      gid: entry.gid,
      pts: entry.points.map((point, index) => ({
        t: point.t ?? index / (entry.points.length - 1),
        x: point.x,
        y: point.y,
        z: point.z,
      })),
    })),
);

function pointAt(points: UtilityTrajectoryPoint[], fraction: number) {
  const index = Math.max(
    0,
    Math.min(points.length - 1, Math.floor(fraction * (points.length - 1))),
  );
  return points[index];
}

// Everything that has left a hand. A grenade that has landed stays in the
// list at the end of its path, because its entry here is also what draws the
// arc it flew -- the same way the single lineup's replay keeps its line.
const inFlight = computed(() => {
  const now = time.value;
  return throws.value
    .filter((entry) => entry.points.length >= 2 && entry.start <= now)
    .slice(-SCENE_SLOTS)
    .map((entry) => {
      const progress = Math.max(
        0,
        Math.min(1, (now - entry.start) / entry.flight),
      );
      const head = pointAt(entry.points, progress);
      const last = entry.points[entry.points.length - 1];
      return {
        key: entry.key,
        gid: entry.gid,
        type: entry.type,
        fromX: entry.points[0].x,
        fromY: entry.points[0].y,
        toX: last.x,
        toY: last.y,
        x: head.x,
        y: head.y,
        z: head.z,
        progress,
      };
    });
});

// What each one has turned into once it is down, for as long as the scene is
// up: an execute is read as the picture all of it makes together.
const grenades = computed(() => {
  const now = time.value;
  const out: Array<{
    rx: number;
    ry: number;
    rz: number;
    type: string;
    life: number;
    bloom: number;
    grenade_id: number;
    thrower_team: string;
  }> = [];
  for (const entry of throws.value) {
    const settled = now - (entry.start + entry.flight);
    if (!entry.landing || settled < 0) {
      continue;
    }
    out.push({
      rx: entry.landing.x,
      ry: entry.landing.y,
      rz: entry.landing.z,
      type: entry.type,
      life: 1,
      bloom: Math.min(1, settled / SMOKE_BLOOM_SECS),
      grenade_id: entry.gid,
      thrower_team: entry.team,
    });
  }
  return out;
});

// A cloud is measured per lineup and worn per step.
const smokeVolumes = computed(() => {
  const out: SmokeVolume[] = [];
  for (const entry of throws.value) {
    const volume = smokeVolumesByLineup.value[entry.lineup.id];
    if (volume) {
      out.push({ ...volume, gid: entry.gid } as SmokeVolume);
    }
  }
  return out;
});

// The renderer derives its roof cut from the tallest player it has seen. Take
// the highest point of any throw instead, so the cut never slices an arc.
const autoCeilingZ = computed(() => {
  let highest = Number.NEGATIVE_INFINITY;
  for (const entry of throws.value) {
    highest = Math.max(
      highest,
      entry.origin.z,
      Number(entry.lineup.eye_z ?? entry.lineup.origin_z),
      entry.landing?.z ?? entry.origin.z,
    );
    for (const point of entry.points) {
      if (point.z > highest) {
        highest = point.z;
      }
    }
  }
  return Number.isFinite(highest) ? highest + 400 : null;
});

// The same roof control the single lineup has, on the same defaults.
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

// When the last grenade is down, for the moments that have no number.
const runEnd = computed(() =>
  Math.max(0, ...throws.value.map((entry) => entry.start + entry.flight)),
);

const tick = computed(() => {
  const now = Number.isFinite(time.value) ? time.value : runEnd.value;
  return Math.round(Math.max(0, now) * TICK_RATE);
});

onMounted(() => {
  // Nothing to fly to: say so, or whatever waits on the camera waits forever.
  if (!cameraFrame.value) {
    emit("framed");
  }
});

defineExpose({ time, inFlight, grenades, players, cameraFrame });
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-md border border-border bg-[#08101f]"
    :class="fill ? 'h-full' : 'aspect-[16/10]'"
  >
    <Replay3DLite
      :map-name="sceneMap"
      :mesh-cdn="meshCdn"
      :radar-src="radarSrc"
      :resolution="calibration?.resolution ?? 1"
      :project="project"
      :players="players"
      :names="names"
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
      @framed="emit('framed')"
    />

    <!-- The dock under the card is what plays and stops this, so the only
         control on the picture is the roof. -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 z-[10] flex items-end justify-end p-3"
    >
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
