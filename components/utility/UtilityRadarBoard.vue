<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { MapPinOff, Maximize2, Minus, Plus } from "lucide-vue-next";
import { useRadarProjection } from "~/composables/useRadarProjection";
import {
  UTILITY_TYPE_COLORS,
  utilityLanding,
  utilityOrigin,
  normalizeTrajectory,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityBoardSegment,
  UtilityMetaSpot,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    mapName: string;
    lineups: UtilityLineup[];
    selectedId?: string | null;
    hoveredId?: string | null;
    showAllLines?: boolean;
    // Mined clusters, drawn under the library's own markers.
    metaSpots?: UtilityMetaSpot[];
    selectedMetaKey?: string | null;
    hoveredMetaKey?: string | null;
    metaInteractive?: boolean;
    // Point-picking mode: the whole board becomes one target and every marker
    // stops taking clicks, so a pick never lands on a lineup instead.
    picking?: boolean;
    // A picked pixel has no height of its own; this is the world Z it is read
    // at, which on Nuke and Vertigo also decides which level it belongs to.
    pickZ?: number;
    markers?: UtilityBoardMarker[];
    segments?: UtilityBoardSegment[];
    selectedSegmentKey?: string | null;
  }>(),
  {
    selectedId: null,
    hoveredId: null,
    showAllLines: false,
    metaSpots: () => [],
    selectedMetaKey: null,
    metaInteractive: false,
    picking: false,
    pickZ: 0,
    markers: () => [],
    segments: () => [],
    selectedSegmentKey: null,
  },
);

const emit = defineEmits<{
  (e: "select", id: string | null): void;
  (e: "hover", id: string | null): void;
  (e: "select-meta", key: string | null): void;
  (e: "hover-meta", key: string | null): void;
  (e: "pick", point: { x: number; y: number; z: number }): void;
  (e: "select-segment", key: string): void;
}>();

const radarFailed = ref(false);
const {
  radarSrc,
  hasCalibration,
  projectCalibrated,
  unprojectCalibrated,
  CANVAS,
} = useRadarProjection(() => props.mapName, { radarFailed });

type Marker = {
  id: string;
  color: string;
  origin: { x: number; y: number };
  landing: { x: number; y: number } | null;
  path: string | null;
};

const markers = computed<Marker[]>(() => {
  const out: Marker[] = [];
  for (const lineup of props.lineups) {
    const origin = projectCalibrated(utilityOrigin(lineup));
    if (!origin) {
      continue;
    }
    const land = utilityLanding(lineup);
    const landing = land ? projectCalibrated(land) : null;
    const preview = normalizeTrajectory(lineup.trajectory_preview)
      .map((point) => projectCalibrated(point))
      .filter((point): point is { x: number; y: number } => point !== null);
    const path =
      preview.length >= 2
        ? preview
            .map((point, index) => {
              const command = index === 0 ? "M" : "L";
              return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
            })
            .join(" ")
        : null;
    out.push({
      id: lineup.id,
      color: UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff",
      origin,
      landing,
      path,
    });
  }
  return out;
});

type MetaMarker = {
  key: string;
  color: string;
  throwers: number;
  point: { x: number; y: number };
  origin: { x: number; y: number } | null;
  radius: number;
  weight: number;
};

const metaMarkers = computed<MetaMarker[]>(() => {
  const spots = props.metaSpots ?? [];
  if (!spots.length) {
    return [];
  }
  const busiest = Math.max(...spots.map((spot) => spot.throwers), 1);
  const out: MetaMarker[] = [];
  for (const spot of spots) {
    const origin = projectCalibrated(spot.origin);
    const landing = spot.landing ? projectCalibrated(spot.landing) : null;
    const point = landing ?? origin;
    if (!point) {
      continue;
    }
    // Area, not radius, tracks the count: a linear radius makes a popular spot
    // swallow the map.
    out.push({
      key: spot.key,
      color: UTILITY_TYPE_COLORS[spot.utilityType] ?? "#ffffff",
      throwers: spot.throwers,
      point,
      origin: landing ? origin : null,
      radius: 10 + 20 * Math.sqrt(spot.throwers / busiest),
      // Size alone does not separate a 45-thrower spot from a 12-thrower one
      // once both are rings on a busy map. Weight drives ink as well, so the
      // popular spot reads as the solid one.
      weight: Math.sqrt(spot.throwers / busiest),
    });
  }
  return out;
});

type DrawnSegment = {
  key: string;
  color: string;
  label: string | null;
  dashed: boolean;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

const drawnSegments = computed<DrawnSegment[]>(() => {
  const out: DrawnSegment[] = [];
  for (const segment of props.segments ?? []) {
    const from = projectCalibrated(segment.from);
    const to = projectCalibrated(segment.to);
    if (!from || !to) {
      continue;
    }
    out.push({
      key: segment.key,
      color: segment.color ?? "#ffffff",
      label: segment.label ?? null,
      dashed: segment.dashed === true,
      from,
      to,
    });
  }
  return out;
});

type DrawnMarker = {
  key: string;
  color: string;
  label: string | null;
  cross: boolean;
  point: { x: number; y: number };
};

const drawnMarkers = computed<DrawnMarker[]>(() => {
  const out: DrawnMarker[] = [];
  for (const marker of props.markers ?? []) {
    const point = projectCalibrated(marker.point);
    if (!point) {
      continue;
    }
    out.push({
      key: marker.key,
      color: marker.color ?? "#ffffff",
      label: marker.label ?? null,
      cross: marker.shape === "cross",
      point,
    });
  }
  return out;
});

// preserveAspectRatio="none" over a square container makes the viewBox a plain
// linear scale of the rendered box, so the click maps back without any letterbox
// Zoom rides a CSS transform on a wrapper ABOVE the svg, which is what keeps
// picking honest: getBoundingClientRect reports the transformed box, so the
// click handler's normalised fraction stays correct at any zoom without
// knowing a thing about it.
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const viewportRef = ref<HTMLElement | null>(null);
const panning = ref(false);

let dragged = false;
let lastX = 0;
let lastY = 0;

const boardTransform = computed(
  () =>
    `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
);

// Panning past the edge would reveal the background behind the map, so the
// offset is clamped to whatever the current zoom actually overflows by.
function clampPan() {
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect) {
    return;
  }
  const slackX = (rect.width * (zoom.value - 1)) / 2;
  const slackY = (rect.height * (zoom.value - 1)) / 2;
  panX.value = Math.min(slackX, Math.max(-slackX, panX.value));
  panY.value = Math.min(slackY, Math.max(-slackY, panY.value));
}

// Zooming toward the pointer rather than the centre: the thing under the
// cursor is the thing being looked at, so it should stay put.
function zoomAt(next: number, clientX?: number, clientY?: number) {
  const rect = viewportRef.value?.getBoundingClientRect();
  const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
  if (rect && clientX !== undefined && clientY !== undefined) {
    const originX = clientX - rect.left - rect.width / 2;
    const originY = clientY - rect.top - rect.height / 2;
    const ratio = target / zoom.value;
    panX.value = originX - (originX - panX.value) * ratio;
    panY.value = originY - (originY - panY.value) * ratio;
  }
  zoom.value = target;
  if (target === MIN_ZOOM) {
    panX.value = 0;
    panY.value = 0;
  }
  clampPan();
}

function onWheel(event: WheelEvent) {
  event.preventDefault();
  zoomAt(
    zoom.value * (event.deltaY < 0 ? 1.15 : 1 / 1.15),
    event.clientX,
    event.clientY,
  );
}

function onPointerDown(event: PointerEvent) {
  if (zoom.value <= MIN_ZOOM || event.button !== 0) {
    return;
  }
  panning.value = true;
  dragged = false;
  lastX = event.clientX;
  lastY = event.clientY;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!panning.value) {
    return;
  }
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    dragged = true;
  }
  panX.value += dx;
  panY.value += dy;
  lastX = event.clientX;
  lastY = event.clientY;
  clampPan();
}

function onPointerUp(event: PointerEvent) {
  if (!panning.value) {
    return;
  }
  panning.value = false;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
}

function resetView() {
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
}

// A new map is a new view; keeping the old pan would open it somewhere random.
watch(
  () => props.mapName,
  () => resetView(),
);

// correction.
function onBoardClick(event: MouseEvent) {
  // A drag that ended on the map is a pan, not a pick.
  if (dragged) {
    dragged = false;
    return;
  }
  if (!props.picking) {
    emit("select", null);
    return;
  }
  const target = event.currentTarget as SVGSVGElement | null;
  if (!target) {
    return;
  }
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const world = unprojectCalibrated(
    {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS,
    },
    props.pickZ,
  );
  if (!world) {
    return;
  }
  emit("pick", world);
}

const activeId = computed(() => props.hoveredId ?? props.selectedId ?? null);

// A mined cluster reads the same whether you picked it or are only pointing at
// it: the question both answer is "which one is this".
function metaLit(key: string) {
  return props.selectedMetaKey === key || props.hoveredMetaKey === key;
}

function isLit(id: string) {
  return props.showAllLines || activeId.value === id;
}

// The lit lineup is drawn last so its line and markers sit over the rest of the
// board rather than under whatever happens to come after it in the list.
const orderedMarkers = computed(() => {
  const lit: Marker[] = [];
  const rest: Marker[] = [];
  for (const marker of markers.value) {
    if (activeId.value === marker.id) {
      lit.push(marker);
    } else {
      rest.push(marker);
    }
  }
  return [...rest, ...lit];
});
</script>

<template>
  <div
    ref="viewportRef"
    class="relative w-full aspect-square overflow-hidden rounded-md border border-border bg-card/40"
    :class="zoom > 1 ? (panning ? 'cursor-grabbing' : 'cursor-grab') : ''"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      class="absolute inset-0"
      :style="{
        transform: boardTransform,
        transformOrigin: 'center center',
        willChange: zoom > 1 ? 'transform' : 'auto',
      }"
    >
    <img
      v-if="radarSrc"
      :src="radarSrc"
      alt=""
      class="absolute inset-0 h-full w-full object-cover select-none"
      draggable="false"
      @error="radarFailed = true"
    />

    <div
      v-if="!radarSrc && !hasCalibration"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
    >
      <MapPinOff class="h-6 w-6 text-muted-foreground" />
      <span
        class="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground"
      >
        {{ $t("pages.utility.board.no_radar") }}
      </span>
    </div>

    <svg
      v-if="radarSrc"
      class="absolute inset-0 h-full w-full"
      :class="picking ? 'cursor-crosshair' : ''"
      :viewBox="`0 0 ${CANVAS} ${CANVAS}`"
      preserveAspectRatio="none"
      @click="onBoardClick"
    >
      <g
        :class="
          metaInteractive && !picking ? 'cursor-pointer' : 'pointer-events-none'
        "
      >
        <g
          v-for="meta of metaMarkers"
          :key="`meta-${meta.key}`"
          @click.stop="emit('select-meta', meta.key)"
          @mouseenter="emit('hover-meta', meta.key)"
          @mouseleave="emit('hover-meta', null)"
        >
          <!-- The ring is a 2px dashed stroke, which is nearly impossible to
               point at. The disc inside it is the real hit target. -->
          <circle
            :cx="meta.point.x"
            :cy="meta.point.y"
            :r="meta.radius"
            fill="transparent"
          />
          <line
            v-if="meta.origin && metaLit(meta.key)"
            :x1="meta.origin.x"
            :y1="meta.origin.y"
            :x2="meta.point.x"
            :y2="meta.point.y"
            :stroke="meta.color"
            stroke-opacity="0.6"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray="6 10"
          />
          <circle
            :cx="meta.point.x"
            :cy="meta.point.y"
            :r="meta.radius"
            :fill="meta.color"
            :fill-opacity="metaLit(meta.key) ? 0.12 : 0.04 + meta.weight * 0.08"
            :stroke="meta.color"
            :stroke-opacity="metaLit(meta.key) ? 0.95 : 0.16 + meta.weight * 0.54"
            :stroke-width="metaLit(meta.key) ? 4 : 1.2 + meta.weight * 2.2"
            stroke-dasharray="5 6"
          />
          <text
            v-if="metaLit(meta.key) || meta.radius > 20"
            :x="meta.point.x"
            :y="meta.point.y + 6"
            text-anchor="middle"
            :fill="meta.color"
            :fill-opacity="metaLit(meta.key) ? 1 : 0.35 + meta.weight * 0.6"
            :font-size="14 + meta.weight * 10"
            font-weight="bold"
            font-family="monospace"
          >
            {{ meta.throwers }}
          </text>
        </g>
      </g>

      <g
        v-for="marker of orderedMarkers"
        :key="marker.id"
        :class="picking ? 'pointer-events-none' : 'cursor-pointer'"
        @click.stop="emit('select', marker.id)"
        @mouseenter="emit('hover', marker.id)"
        @mouseleave="emit('hover', null)"
      >
        <path
          v-if="marker.path && isLit(marker.id)"
          :d="marker.path"
          fill="none"
          :stroke="marker.color"
          :stroke-opacity="activeId === marker.id ? 0.95 : 0.4"
          :stroke-width="activeId === marker.id ? 4 : 2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <line
          v-else-if="marker.landing && isLit(marker.id)"
          :x1="marker.origin.x"
          :y1="marker.origin.y"
          :x2="marker.landing.x"
          :y2="marker.landing.y"
          :stroke="marker.color"
          :stroke-opacity="activeId === marker.id ? 0.95 : 0.4"
          :stroke-width="activeId === marker.id ? 4 : 2"
          stroke-linecap="round"
          stroke-dasharray="10 8"
        />

        <circle
          v-if="marker.landing"
          :cx="marker.landing.x"
          :cy="marker.landing.y"
          :r="activeId === marker.id ? 13 : 9"
          :fill="marker.color"
          :fill-opacity="activeId === marker.id ? 0.9 : 0.45"
          stroke="#05070b"
          stroke-width="2"
        />

        <!-- The throw origin is the part a player has to stand on, so it is
             drawn as a hard square while the landing stays a soft dot. -->
        <rect
          :x="marker.origin.x - (activeId === marker.id ? 9 : 6)"
          :y="marker.origin.y - (activeId === marker.id ? 9 : 6)"
          :width="activeId === marker.id ? 18 : 12"
          :height="activeId === marker.id ? 18 : 12"
          :fill="marker.color"
          :fill-opacity="activeId === marker.id ? 1 : 0.65"
          stroke="#05070b"
          stroke-width="2"
        />
      </g>

      <g :class="picking ? 'pointer-events-none' : ''">
        <g v-for="segment of drawnSegments" :key="`segment-${segment.key}`">
          <!-- A transparent fat line under the visible one: a 4px stroke is
               almost impossible to hit with a mouse. -->
          <line
            v-if="!picking"
            :x1="segment.from.x"
            :y1="segment.from.y"
            :x2="segment.to.x"
            :y2="segment.to.y"
            stroke="transparent"
            stroke-width="22"
            class="cursor-pointer"
            @click.stop="emit('select-segment', segment.key)"
          />
          <line
            :x1="segment.from.x"
            :y1="segment.from.y"
            :x2="segment.to.x"
            :y2="segment.to.y"
            :stroke="segment.color"
            :stroke-opacity="selectedSegmentKey === segment.key ? 1 : 0.7"
            :stroke-width="selectedSegmentKey === segment.key ? 6 : 4"
            :stroke-dasharray="segment.dashed ? '12 10' : undefined"
            stroke-linecap="round"
            class="pointer-events-none"
          />
          <circle
            :cx="segment.from.x"
            :cy="segment.from.y"
            r="9"
            :fill="segment.color"
            stroke="#05070b"
            stroke-width="2"
            class="pointer-events-none"
          />
          <circle
            :cx="segment.to.x"
            :cy="segment.to.y"
            r="9"
            fill="#05070b"
            :stroke="segment.color"
            stroke-width="4"
            class="pointer-events-none"
          />
          <text
            v-if="segment.label"
            :x="(segment.from.x + segment.to.x) / 2"
            :y="(segment.from.y + segment.to.y) / 2 - 12"
            text-anchor="middle"
            :fill="segment.color"
            font-size="20"
            font-family="monospace"
            class="pointer-events-none"
          >
            {{ segment.label }}
          </text>
        </g>

        <g
          v-for="marker of drawnMarkers"
          :key="`point-${marker.key}`"
          class="pointer-events-none"
        >
          <template v-if="marker.cross">
            <line
              :x1="marker.point.x - 12"
              :y1="marker.point.y"
              :x2="marker.point.x + 12"
              :y2="marker.point.y"
              :stroke="marker.color"
              stroke-width="4"
              stroke-linecap="round"
            />
            <line
              :x1="marker.point.x"
              :y1="marker.point.y - 12"
              :x2="marker.point.x"
              :y2="marker.point.y + 12"
              :stroke="marker.color"
              stroke-width="4"
              stroke-linecap="round"
            />
          </template>
          <circle
            v-else
            :cx="marker.point.x"
            :cy="marker.point.y"
            r="10"
            :fill="marker.color"
            stroke="#05070b"
            stroke-width="2"
          />
          <text
            v-if="marker.label"
            :x="marker.point.x + 16"
            :y="marker.point.y - 12"
            :fill="marker.color"
            font-size="20"
            font-family="monospace"
          >
            {{ marker.label }}
          </text>
        </g>
      </g>
    </svg>
    </div>

    <div
      v-if="radarSrc"
      class="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-md border border-white/10 bg-background/80 [backdrop-filter:blur(10px)]"
      @pointerdown.stop
      @wheel.stop
    >
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
        :disabled="zoom >= 6"
        :title="$t('pages.utility.board.zoom_in')"
        @click.stop="zoomAt(zoom * 1.4)"
      >
        <Plus class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center border-t border-white/10 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
        :disabled="zoom <= 1"
        :title="$t('pages.utility.board.zoom_out')"
        @click.stop="zoomAt(zoom / 1.4)"
      >
        <Minus class="h-3.5 w-3.5" />
      </button>
      <button
        v-if="zoom > 1"
        type="button"
        class="flex h-7 w-7 items-center justify-center border-t border-white/10 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :title="$t('pages.utility.board.zoom_reset')"
        @click.stop="resetView()"
      >
        <Maximize2 class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
