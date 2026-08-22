<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
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

// The zoom stack is pinned to the shell, not to the square, so a class from
// the call site still has to land on the square -- that is where the frame is.
defineOptions({ inheritAttrs: false });

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

// One map failing must not condemn the next one.
watch(
  () => props.mapName,
  () => (radarFailed.value = false),
);

/**
 * What is actually painted, as opposed to what the map name says should be.
 *
 * The two are the same thing right up until you switch maps -- and then the
 * next PNG is still in flight, which used to leave a 740px hole in the middle
 * of the page for as long as it took. The incoming radar is decoded off-screen
 * first and only handed to the board once it is ready, so the board keeps the
 * map you were on and then dissolves into the next one. A probe rather than the
 * element's own `load` because a cached PNG can be `complete` before Vue has
 * bound the listener, which would strand the fade at zero.
 */
const displaySrc = ref<string | null>(null);

const {
  radarSrc,
  hasCalibration,
  projectCalibrated,
  unprojectCalibrated,
  CANVAS,
} = useRadarProjection(() => props.mapName, { radarFailed });

watch(
  radarSrc,
  (next) => {
    // No radar for this map at all: there is nothing to hold on to, and holding
    // the previous map would be a lie about which map you are looking at.
    if (!next) {
      displaySrc.value = null;
      return;
    }

    if (next === displaySrc.value) {
      return;
    }

    const probe = new Image();
    probe.decoding = "async";
    probe.onload = () => {
      if (radarSrc.value === next) {
        displaySrc.value = next;
      }
    };
    probe.onerror = () => {
      if (radarSrc.value === next) {
        radarFailed.value = true;
      }
    };
    probe.src = next;
  },
  { immediate: true },
);

// Whether the board is showing the map it is supposed to be showing. Between
// two maps it is not, and nothing that belongs to the incoming map may be drawn
// over the outgoing one -- so the overlay waits and the map arrives bare, then
// fills in.
const boardReady = computed(
  () => !!radarSrc.value && displaySrc.value === radarSrc.value,
);

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
  // How far into the bloom this ring lands. Precomputed rather than derived in
  // the template so the stagger travels with the marker and not with its index
  // in whatever list the threshold happens to leave behind.
  delay: string;
  /** The cluster this ring belongs to; its own key when it stands alone. */
  cluster: string;
  /** How many rings share that cluster, this one included. */
  clusterSize: number;
  /** The one ring that stands for its cluster while the cluster is closed. */
  lead: boolean;
  /** Where the ring sits once its cluster is fanned open, in map units. */
  fan: { x: number; y: number };
  /** The point the leader line runs back to -- the cluster's real centre. */
  anchor: { x: number; y: number };
};

// Past a dozen rings a stagger stops reading as one gesture and starts reading
// as lag, so the step flattens rather than the map filling in for a second.
const META_STEP_MS = 22;
const META_STEP_CAP = 12;

// Two rings whose centres are closer than the larger radius are not merely
// untidy -- the smaller one's centre sits inside the larger one's hit circle,
// so it cannot be clicked at any zoom. That is the condition worth grouping on,
// and it is transitive: A overlapping B overlapping C is one cluster even when
// A and C do not touch.
const META_FAN_MIN_GAP = 0.62;
// Breathing room between two fanned rings, in map units. Rings that merely
// touch still read as one shape.
const META_FAN_PAD = 5;
// A fan wide enough to seat every ring can still be too wide to be a gesture.
// Past this the rings start to overlap again rather than the fan swallowing
// the map -- the count on the badge is the honest answer for a pile that big.
const META_FAN_MAX_REACH = 240;
// Must match the .meta-shift transform transition in the stylesheet.
const META_FAN_MS = 320;

function clusterMetaMarkers(list: MetaMarker[]): Map<string, string[]> {
  const parent = list.map((_, index) => index);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const distance = Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y);
      if (distance < Math.max(a.radius, b.radius)) {
        parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map<string, string[]>();
  for (let i = 0; i < list.length; i++) {
    const root = list[find(i)].key;
    const members = groups.get(root);
    if (members) {
      members.push(list[i].key);
    } else {
      groups.set(root, [list[i].key]);
    }
  }
  return groups;
}

// Accurate until it cannot be. Two spots thrown from the same corridor want
// the same bearing, and honouring both exactly stacks them right back up.
//
// This unwraps the circle into a line rather than relaxing in place. An
// in-place pass has to compare each ring against its neighbour AND against the
// wrap-around pair, and every push it applies invalidates the ordering those
// comparisons were based on -- it silently converges on arrangements that
// violate the very gap it is enforcing. Unwrapped, the constraint is a single
// forward sweep that cannot be wrong, and the only special case is the seam.
function separateAngles(angles: number[], minGap: number): number[] {
  const span = Math.PI * 2;
  const count = angles.length;
  if (count < 2) {
    return angles.slice();
  }

  const order = angles
    .map((angle, index) => ({ angle, index }))
    .sort((a, b) => a.angle - b.angle);

  // More rings than the circle can seat at this gap: no arrangement satisfies
  // it, so stop pretending and spread them evenly about where they wanted to
  // be. Bearings stop being readable long before this, but the alternative is
  // a pass that never converges.
  if (count * minGap >= span) {
    const mean = order[0].angle;
    const out: number[] = [];
    order.forEach((entry, slot) => {
      out[entry.index] = mean + (slot * span) / count;
    });
    return out;
  }

  // Forward sweep: each ring sits at least a gap past the one before it.
  const laid = order.map((entry) => entry.angle);
  for (let i = 1; i < count; i++) {
    laid[i] = Math.max(laid[i], laid[i - 1] + minGap);
  }

  // The seam between last and first is the one pair the sweep cannot see.
  // Compressing toward the mean keeps every ring near its true bearing instead
  // of shunting the whole fan around the circle.
  const overshoot = laid[count - 1] - laid[0] - (span - minGap);
  if (overshoot > 0) {
    const scale = (span - minGap) / (laid[count - 1] - laid[0]);
    const pivot = laid[0];
    for (let i = 0; i < count; i++) {
      laid[i] = pivot + (laid[i] - pivot) * scale;
    }
    // Scaling can re-violate the gap between close pairs, so seat them evenly
    // rather than ship an arrangement that breaks the guarantee.
    for (let i = 1; i < count; i++) {
      if (laid[i] - laid[i - 1] < minGap - 1e-6) {
        for (let k = 0; k < count; k++) {
          laid[k] = laid[0] + (k * (span - minGap)) / (count - 1);
        }
        break;
      }
    }
  }

  // Put the fan back over the bearings it came from: the sweep only ever
  // pushes forward, which would drift the whole group clockwise.
  const wantedMid = (order[0].angle + order[count - 1].angle) / 2;
  const laidMid = (laid[0] + laid[count - 1]) / 2;
  const shift = wantedMid - laidMid;

  const out: number[] = [];
  order.forEach((entry, slot) => {
    out[entry.index] = laid[slot] + shift;
  });
  return out;
}

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
      delay: `${Math.min(out.length, META_STEP_CAP) * META_STEP_MS}ms`,
      // Filled in by the clustering pass below; a ring is its own cluster of
      // one until something is found to be sitting on top of it.
      cluster: spot.key,
      clusterSize: 1,
      lead: true,
      fan: { x: point.x, y: point.y },
      anchor: { x: point.x, y: point.y },
    });
  }

  // The fan is placed here rather than in the template so the geometry is
  // computed once per marker set instead of once per member per render.
  const byKey = new Map(out.map((marker) => [marker.key, marker]));
  for (const [root, keys] of clusterMetaMarkers(out)) {
    const members = keys
      .map((key) => byKey.get(key))
      .filter((marker): marker is MetaMarker => !!marker);
    for (const marker of members) {
      marker.cluster = root;
      marker.clusterSize = members.length;
    }
    if (members.length < 2) {
      continue;
    }
    // A closed cluster has to BE one ring, not look like one. Every member was
    // drawn at its own point regardless, so a pile of three rendered as three
    // rings of ink and three counts stamped over each other -- unreadable, and
    // exactly what the badge is there to stand in for. The widest member is
    // the one that reads, so it speaks for the cluster and the rest wait
    // underneath it until the fan opens.
    let lead = members[0];
    for (const marker of members) {
      if (marker.radius > lead.radius) {
        lead = marker;
      }
    }
    for (const marker of members) {
      marker.lead = marker === lead;
    }
    // The anchor is where the cluster actually is. Rings travel away from it
    // and the leader lines run back to it, so it has to be the real centre and
    // not whichever member happened to be first.
    const anchor = {
      x: members.reduce((sum, m) => sum + m.point.x, 0) / members.length,
      y: members.reduce((sum, m) => sum + m.point.y, 0) / members.length,
    };
    // Far enough out that the biggest ring clears the pile, in map units --
    // the rings themselves are map-scale, so a screen-scale fan would tear
    // apart at one zoom and overlap again at another.
    //
    // How far out that is depends on how many rings have to fit and how big
    // they are, which a constant cannot know. The separation pass never seats
    // a pair closer than `gap`, and two rings `gap` apart on a circle of
    // `reach` are a chord 2*reach*sin(gap/2) apart -- so the two widest rings
    // decide the reach. Fixing it instead is what left a fourteen-spot cluster
    // fanning open into the same unreadable pile it started as.
    const widest = Math.max(...members.map((m) => m.radius));
    const average =
      members.reduce((sum, m) => sum + m.radius, 0) / members.length;
    const gap = Math.min(META_FAN_MIN_GAP, (Math.PI * 2) / members.length);
    const ranked = members.map((m) => m.radius).sort((a, b) => b - a);
    const reach = Math.min(
      META_FAN_MAX_REACH,
      Math.max(
        widest + average + 14,
        (ranked[0] + ranked[1] + META_FAN_PAD) / (2 * Math.sin(gap / 2)),
      ),
    );

    // The whole point of the fan: a ring leaves toward the place you would
    // stand to throw it. A cluster member with no separate origin -- landing
    // and origin collapsed to the same point -- has no bearing to honour, so
    // it takes an even slot and the separation pass sorts out the rest.
    const angles = members.map((marker, index) => {
      if (!marker.origin) {
        return -Math.PI / 2 + (index * Math.PI * 2) / members.length;
      }
      return Math.atan2(
        marker.origin.y - marker.point.y,
        marker.origin.x - marker.point.x,
      );
    });
    const spread = separateAngles(angles, gap);
    members.forEach((marker, index) => {
      marker.anchor = anchor;
      marker.fan = {
        x: anchor.x + Math.cos(spread[index]) * reach,
        y: anchor.y + Math.sin(spread[index]) * reach,
      };
    });
  }
  return out;
});

// Which cluster is currently fanned open. One at a time: two open fans on the
// same map cross each other's leader lines and neither is readable.
const openCluster = ref<string | null>(null);

const metaClusters = computed(() => {
  const seen = new Map<string, MetaMarker>();
  for (const marker of metaMarkers.value) {
    if (marker.clusterSize > 1 && marker.lead) {
      seen.set(marker.cluster, marker);
    }
  }
  return [...seen.values()];
});

function metaFanned(marker: MetaMarker) {
  return marker.clusterSize > 1 && openCluster.value === marker.cluster;
}

// A ring in a closed cluster is unreachable, so the first click opens the fan
// rather than selecting whatever happened to be on top. Once it is open every
// ring is its own target again and a click means what it always meant.
// Rings sweep across the map while a fan opens or closes, and a stationary
// cursor sits inside one after another as they pass -- each crossing fires
// mouseenter/mouseleave, each of those flips metaLit, and the whole cluster
// strobes. So nothing is HOVERABLE until the movement has stopped -- but it
// stays clickable throughout. Taking pointer events off the whole layer for
// the length of the animation also ate every click that landed in it, which
// is a ring that just does not open however many times you press it.
const fanning = ref(false);
let fanTimer: ReturnType<typeof setTimeout> | null = null;

function beginFan(next: string | null) {
  fanning.value = true;
  if (fanTimer) {
    clearTimeout(fanTimer);
  }
  fanTimer = setTimeout(() => {
    fanning.value = false;
    fanTimer = null;
  }, META_FAN_MS);
  openCluster.value = next;
  emit("hover-meta", null);
}

onBeforeUnmount(() => {
  if (fanTimer) {
    clearTimeout(fanTimer);
  }
});

// A closed cluster's rings sit at the cluster's centre rather than at their own
// points. The badge is drawn there and the leader lines run back to there, so
// it is also the place the fan should open from and close back into.
function metaTarget(marker: MetaMarker) {
  if (metaFanned(marker)) {
    return marker.fan;
  }
  if (marker.clusterSize > 1) {
    return marker.anchor;
  }
  return marker.point;
}

function metaTransform(marker: MetaMarker) {
  const target = metaTarget(marker);
  return `translate(${target.x - marker.point.x}px, ${target.y - marker.point.y}px)`;
}

// ...and once they are stacked on one point, only the lead ring can be drawn.
// Drawing the rest means N rings of ink and N counts printed over each other,
// which is the pile the badge replaces. They stay visible while the fan is
// moving -- that is the slide -- and while something outside the board is
// pointing at one, so hovering a row in the rail still lights its own ring.
function metaStacked(marker: MetaMarker) {
  return (
    marker.clusterSize > 1 &&
    !marker.lead &&
    !metaFanned(marker) &&
    !fanning.value &&
    !metaLit(marker.key)
  );
}

// Opening a fan or picking a ring makes everything else context. The rings you
// did not ask about drop back rather than disappear -- where a throw lands only
// means something next to the other places it lands.
function metaMuted(marker: MetaMarker) {
  if (props.selectedMetaKey) {
    return marker.key !== props.selectedMetaKey;
  }
  if (openCluster.value) {
    return marker.cluster !== openCluster.value;
  }
  return false;
}

function onMetaHover(key: string | null) {
  if (fanning.value) {
    return;
  }
  emit("hover-meta", key);
}

function onMetaClick(marker: MetaMarker) {
  if (marker.clusterSize > 1 && openCluster.value !== marker.cluster) {
    beginFan(marker.cluster);
    return;
  }
  emit("select-meta", marker.key);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && openCluster.value) {
    beginFan(null);
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

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
  shape: "dot" | "cross" | "badge";
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
      shape: marker.shape ?? "dot",
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
  () => `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
);

// The whole board is scaled by one CSS transform, which is right for the map
// and wrong for everything drawn on it: at 4x a 2px ring stroke is 8px of ink
// and a 14px count is 56px of type sitting across half a bombsite. Anything
// that is ink rather than distance divides by this, so it holds the same weight
// on screen at every zoom. Radii do NOT -- a meta ring's radius is how far
// apart the throws in that cluster actually landed, which is a distance on the
// map and has to scale with it.
const ink = computed(() => 1 / zoom.value);

// The fan is a transient read, never a mode. Anything that changes what is on
// the map underneath it -- a new zoom, a threshold sweep, the overlay going
// away -- closes it. It has to live below `zoom`: watch evaluates its sources
// the moment it is created, so naming a ref declared further down the file
// reads it inside its own temporal dead zone and the component throws on
// setup.
watch([zoom, () => props.metaSpots], () => {
  if (openCluster.value) {
    beginFan(null);
  }
});

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
// A zoom step is a jump: the transform goes from 1 to 1.4 in a single frame and
// the whole map teleports. Easing it is only safe when the steps are discrete,
// though -- a wheel fires dozens of times a second and a running transition
// would spend every one of them chasing a target that already moved, which
// reads as the map sliding around after you stop. So the ease is armed by the
// callers that step (the buttons, reset) and never by the wheel or a drag.
const easing = ref(false);
let easeTimer: ReturnType<typeof setTimeout> | null = null;

const ZOOM_EASE_MS = 260;

function easeZoom(run: () => void) {
  easing.value = true;
  if (easeTimer) {
    clearTimeout(easeTimer);
  }
  easeTimer = setTimeout(() => {
    easing.value = false;
    easeTimer = null;
  }, ZOOM_EASE_MS);
  run();
}

onBeforeUnmount(() => {
  if (easeTimer) {
    clearTimeout(easeTimer);
  }
});

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
  // Ring clicks are @click.stop, so anything arriving here is the bare map --
  // which is the outside of an open fan.
  if (openCluster.value) {
    beginFan(null);
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
  <!-- The map fits the viewport; the box around it does not have to. This is a
       square, so a max-WIDTH is how you cap its height -- capping the height
       directly would leave the width at 100% and stretch the radar. Bounded
       this way the map scales down on a short window until the whole thing is
       visible without scrolling, and mx-auto centres it in a box that keeps its
       full width for the controls pinned along its edges. -->
  <div class="relative w-full">
    <div
      ref="viewportRef"
      v-bind="$attrs"
      class="relative mx-auto aspect-square w-full max-w-[calc(100vh-12rem)] overflow-hidden rounded-md border border-border bg-card/40"
      :class="zoom > 1 ? (panning ? 'cursor-grabbing' : 'cursor-grab') : ''"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- Full bleed. Insetting this to clear the floating chrome cost far more
         than it bought: the map is square, so shortening it vertically shrinks
         it in BOTH axes and leaves wide empty margins. The name and the legend
         carry their own text shadows for exactly this reason. -->
      <div
        class="absolute inset-0"
        :style="{
          transform: boardTransform,
          transformOrigin: 'center center',
          // will-change pins the layer's raster at the scale it was promoted
          // at, so a zoomed-in board stayed a 1x bitmap blown up -- the dashed
          // rings furred and the thrower counts went soft. It buys smoothness
          // during a drag and costs sharpness the rest of the time, so it is
          // only on while a drag is actually happening; letting go re-rasterises
          // the vectors at the scale you are looking at them.
          willChange: panning || easing ? 'transform' : 'auto',
          transition: easing
            ? `transform ${ZOOM_EASE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
            : 'none',
        }"
      >
        <!-- A blueprint grid under the map, not a grey card. Before the first radar
         arrives this square is 740px of nothing with a border around it, which
         reads as a panel that failed rather than one that is still loading. -->
        <div
          v-if="!displaySrc"
          aria-hidden="true"
          class="utility-board-pending absolute inset-0"
        />

        <!-- Both halves of a map change are absolutely positioned on the same
         square, so this is a true cross-fade rather than a swap: the outgoing
         map fades out from where it is while the incoming one -- already
         decoded, so it cannot flash -- fades up underneath it. -->
        <Transition
          enter-active-class="transition-opacity [transition-duration:280ms] ease-out motion-reduce:!transition-none"
          leave-active-class="transition-opacity [transition-duration:280ms] ease-out motion-reduce:!transition-none"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <img
            v-if="displaySrc"
            :key="displaySrc"
            :src="displaySrc"
            alt=""
            class="absolute inset-0 h-full w-full select-none object-cover"
            draggable="false"
          />
        </Transition>

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
          v-if="boardReady"
          class="absolute inset-0 h-full w-full"
          :class="picking ? 'cursor-crosshair' : ''"
          :viewBox="`0 0 ${CANVAS} ${CANVAS}`"
          preserveAspectRatio="none"
          @click="onBoardClick"
        >
          <g
            :class="
              metaInteractive && !picking
                ? 'cursor-pointer'
                : 'pointer-events-none'
            "
          >
            <!-- Mined spots used to appear and vanish on a hard cut: toggling the
             overlay dumped forty rings onto the map in one frame, and nudging
             the threshold swapped a dozen of them the same way, which reads as
             the map redrawing rather than as an answer to the control. They now
             bloom outward from wherever the cursor left off, each ring scaling
             up about its own centre, stepped so the cluster fills in. The step
             caps at twelve rings -- past that a stagger stops reading as one
             gesture and starts reading as lag. -->
            <!-- Outside the TransitionGroup, deliberately. Anything nested inside
             one becomes a transitioning member: these got adopted, took the
             meta-enter-from class and stuck at opacity 0 forever. They are
             siblings, and they come first so the rings stack over their own
             leader lines rather than under them. -->
            <!-- The leader lines live outside the travelling groups on purpose.
             A line runs from a point that stays put to one that moves, so it
             cannot ride either end; instead it is drawn at the fanned position
             from the start and fades in while the ring slides out along it.
             The ring IS the animation -- the line is just the path it took. -->
            <g v-if="openCluster" class="pointer-events-none">
              <template v-for="meta of metaMarkers" :key="`lead-${meta.key}`">
                <line
                  v-if="metaFanned(meta)"
                  :x1="meta.anchor.x"
                  :y1="meta.anchor.y"
                  :x2="meta.fan.x"
                  :y2="meta.fan.y"
                  :stroke="meta.color"
                  stroke-opacity="0.4"
                  :stroke-width="1.2 * ink"
                  :stroke-dasharray="`${3 * ink} ${4 * ink}`"
                  class="meta-lead"
                />
              </template>
            </g>

            <!-- Where the cluster really is, held on screen while its members are
             out: without it the fan reads as five spots rather than as one
             place five throws land. -->
            <template
              v-for="cluster of metaClusters"
              :key="`anchor-${cluster.cluster}`"
            >
              <circle
                v-if="openCluster === cluster.cluster"
                :cx="cluster.anchor.x"
                :cy="cluster.anchor.y"
                :r="2.5 * ink"
                :fill="cluster.color"
                fill-opacity="0.85"
                class="meta-lead pointer-events-none"
              />
            </template>

            <!-- The line back to where the throw is made from. It cannot ride
             inside the marker: that group travels when a cluster stacks or
             fans out, and an origin is a fixed place on the map. Carried
             along, the line swung around with the ring and pointed at wherever
             it had moved from instead of at the spot you stand on. Only the
             landing end follows the ring. -->
            <g class="pointer-events-none">
              <template v-for="meta of metaMarkers" :key="`origin-${meta.key}`">
                <line
                  v-if="meta.origin && metaLit(meta.key)"
                  :x1="meta.origin.x"
                  :y1="meta.origin.y"
                  :x2="metaTarget(meta).x"
                  :y2="metaTarget(meta).y"
                  :stroke="meta.color"
                  :stroke-opacity="metaMuted(meta) ? 0.2 : 0.6"
                  :stroke-width="3 * ink"
                  stroke-linecap="round"
                  :stroke-dasharray="`${6 * ink} ${10 * ink}`"
                />
              </template>
            </g>

            <TransitionGroup name="meta" tag="g">
              <g
                v-for="meta of metaMarkers"
                :key="`meta-${meta.key}`"
                :style="{ '--meta-delay': meta.delay }"
                class="meta-marker"
                :class="[
                  metaStacked(meta) ? 'meta-marker--stacked' : '',
                  metaMuted(meta) ? 'meta-marker--muted' : '',
                ]"
                @click.stop="onMetaClick(meta)"
                @mouseenter="onMetaHover(meta.key)"
                @mouseleave="onMetaHover(null)"
              >
                <!-- The travel is on an inner group and not on the TransitionGroup
             child itself. A transform transition on the child is the exact
             signal TransitionGroup reads as "this list FLIP-animates its
             moves", and its FLIP writes an inline transform and then clears
             it -- taking the bound one with it. The binding is only re-applied
             when its value next changes, so a ring silently drops back to its
             untranslated point and sits there, out of register with the badge
             and the leader lines. One level down, nothing reaches it. -->
                <g
                  class="meta-shift"
                  :style="{ transform: metaTransform(meta) }"
                >
                  <!-- The ring is a 2px dashed stroke, which is nearly impossible to
               point at. The disc inside it is the real hit target. -->
                  <circle
                    :cx="meta.point.x"
                    :cy="meta.point.y"
                    :r="meta.radius"
                    fill="transparent"
                  />
                  <circle
                    :cx="meta.point.x"
                    :cy="meta.point.y"
                    :r="meta.radius"
                    :fill="meta.color"
                    :fill-opacity="
                      metaLit(meta.key) ? 0.12 : 0.04 + meta.weight * 0.08
                    "
                    :stroke="meta.color"
                    :stroke-opacity="
                      metaLit(meta.key) ? 0.95 : 0.16 + meta.weight * 0.54
                    "
                    :stroke-width="
                      (metaLit(meta.key) ? 4 : 1.2 + meta.weight * 2.2) * ink
                    "
                    :stroke-dasharray="`${5 * ink} ${6 * ink}`"
                  />
                  <text
                    v-if="metaLit(meta.key) || meta.radius > 20"
                    :x="meta.point.x"
                    :y="meta.point.y + 6 * ink"
                    text-anchor="middle"
                    :fill="meta.color"
                    :fill-opacity="
                      metaLit(meta.key) ? 1 : 0.35 + meta.weight * 0.6
                    "
                    :font-size="(14 + meta.weight * 10) * ink"
                    font-weight="bold"
                    font-family="monospace"
                  >
                    {{ meta.throwers }}
                  </text>
                </g>
              </g>
            </TransitionGroup>

            <!-- A pile of rings looks like one ring, so a closed cluster carries
             its count. This is the only thing telling you there is anything to
             open; it goes the moment the fan does. -->
            <g
              v-for="cluster of metaClusters"
              :key="`badge-${cluster.cluster}`"
            >
              <g
                v-if="openCluster !== cluster.cluster"
                class="meta-badge cursor-pointer"
                :class="metaMuted(cluster) ? 'meta-marker--muted' : ''"
                @click.stop="beginFan(cluster.cluster)"
              >
                <circle
                  :cx="cluster.anchor.x + cluster.radius * 0.72"
                  :cy="cluster.anchor.y - cluster.radius * 0.72"
                  :r="9 * ink"
                  fill="#05070b"
                  fill-opacity="0.92"
                  :stroke="cluster.color"
                  :stroke-width="1.6 * ink"
                />
                <text
                  :x="cluster.anchor.x + cluster.radius * 0.72"
                  :y="cluster.anchor.y - cluster.radius * 0.72"
                  text-anchor="middle"
                  dominant-baseline="central"
                  :fill="cluster.color"
                  :font-size="10 * ink"
                  font-weight="bold"
                  font-family="monospace"
                  class="pointer-events-none"
                >
                  {{ cluster.clusterSize }}
                </text>
              </g>
            </g>
          </g>

          <!-- Throws arrive and leave rather than blink. Hovering an execute in
           the rail swaps the whole set at once, and a hard cut there reads as a
           glitch on the map instead of an answer to the cursor. Opacity only:
           SVG geometry tweens would run on the main thread while the panel
           beside it is mounting. -->
          <TransitionGroup name="mk" tag="g">
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
                :stroke-width="(activeId === marker.id ? 4 : 2) * ink"
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
                :stroke-width="(activeId === marker.id ? 4 : 2) * ink"
                stroke-linecap="round"
                :stroke-dasharray="`${10 * ink} ${8 * ink}`"
              />

              <circle
                v-if="marker.landing"
                :cx="marker.landing.x"
                :cy="marker.landing.y"
                :r="(activeId === marker.id ? 13 : 9) * ink"
                :fill="marker.color"
                :fill-opacity="activeId === marker.id ? 0.9 : 0.45"
                stroke="#05070b"
                :stroke-width="2 * ink"
              />

              <!-- The throw origin is the part a player has to stand on, so it is
             drawn as a hard square while the landing stays a soft dot. -->
              <rect
                :x="marker.origin.x - (activeId === marker.id ? 9 : 6) * ink"
                :y="marker.origin.y - (activeId === marker.id ? 9 : 6) * ink"
                :width="(activeId === marker.id ? 18 : 12) * ink"
                :height="(activeId === marker.id ? 18 : 12) * ink"
                :fill="marker.color"
                :fill-opacity="activeId === marker.id ? 1 : 0.65"
                stroke="#05070b"
                :stroke-width="2 * ink"
              />
            </g>
          </TransitionGroup>

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
                :stroke-width="22 * ink"
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
                :stroke-width="
                  (selectedSegmentKey === segment.key ? 6 : 4) * ink
                "
                :stroke-dasharray="
                  segment.dashed ? `${12 * ink} ${10 * ink}` : undefined
                "
                stroke-linecap="round"
                class="pointer-events-none"
              />
              <circle
                :cx="segment.from.x"
                :cy="segment.from.y"
                :r="9 * ink"
                :fill="segment.color"
                stroke="#05070b"
                :stroke-width="2 * ink"
                class="pointer-events-none"
              />
              <circle
                :cx="segment.to.x"
                :cy="segment.to.y"
                :r="9 * ink"
                fill="#05070b"
                :stroke="segment.color"
                :stroke-width="4 * ink"
                class="pointer-events-none"
              />
              <text
                v-if="segment.label"
                :x="(segment.from.x + segment.to.x) / 2"
                :y="(segment.from.y + segment.to.y) / 2 - 12 * ink"
                text-anchor="middle"
                :fill="segment.color"
                :font-size="20 * ink"
                font-family="monospace"
                class="pointer-events-none"
              >
                {{ segment.label }}
              </text>
            </g>

            <TransitionGroup name="badge" tag="g">
              <g
                v-for="marker of drawnMarkers"
                :key="`point-${marker.key}`"
                class="pointer-events-none"
                :style="{
                  transformOrigin: `${marker.point.x}px ${marker.point.y}px`,
                }"
              >
                <template v-if="marker.shape === 'cross'">
                  <line
                    :x1="marker.point.x - 12 * ink"
                    :y1="marker.point.y"
                    :x2="marker.point.x + 12 * ink"
                    :y2="marker.point.y"
                    :stroke="marker.color"
                    :stroke-width="4 * ink"
                    stroke-linecap="round"
                  />
                  <line
                    :x1="marker.point.x"
                    :y1="marker.point.y - 12 * ink"
                    :x2="marker.point.x"
                    :y2="marker.point.y + 12 * ink"
                    :stroke="marker.color"
                    :stroke-width="4 * ink"
                    stroke-linecap="round"
                  />
                </template>
                <!-- A numbered token, dark so the map reads through the ring and
               the digit never fights the marker it is counting. -->
                <template v-else-if="marker.shape === 'badge'">
                  <circle
                    :cx="marker.point.x"
                    :cy="marker.point.y"
                    :r="14 * ink"
                    fill="#05070b"
                    fill-opacity="0.88"
                    :stroke="marker.color"
                    :stroke-width="3 * ink"
                  />
                  <text
                    v-if="marker.label"
                    :x="marker.point.x"
                    :y="marker.point.y"
                    text-anchor="middle"
                    dominant-baseline="central"
                    :fill="marker.color"
                    :font-size="17 * ink"
                    font-weight="bold"
                    font-family="monospace"
                  >
                    {{ marker.label }}
                  </text>
                </template>
                <circle
                  v-else
                  :cx="marker.point.x"
                  :cy="marker.point.y"
                  :r="10 * ink"
                  :fill="marker.color"
                  stroke="#05070b"
                  :stroke-width="2 * ink"
                />
                <text
                  v-if="marker.label && marker.shape !== 'badge'"
                  :x="marker.point.x + 16 * ink"
                  :y="marker.point.y - 12 * ink"
                  :fill="marker.color"
                  :font-size="20 * ink"
                  font-family="monospace"
                >
                  {{ marker.label }}
                </text>
              </g>
            </TransitionGroup>
          </g>
        </svg>
      </div>
    </div>

    <!-- Top corner, not the middle of the right edge. Centred, the stack grows
         a third button the moment you zoom in, and on a short board that puts
         it over the type chips and the threshold knob along the bottom. The
         map's top edge is free -- the name and the practice button sit in a
         reserved band above the map, not on it -- so it can grow downwards from
         here and never reach the controls at any board size.

         It hangs off the SHELL, not off the square. The square is capped by
         the window height and centred, so on a wide board it stops short of
         the frame -- pinning the stack to it walked the buttons inwards
         whenever the map ran out of width. The shell is always the full width
         of the box, so the stack sits in the same corner at every size. -->
    <div
      v-if="displaySrc"
      class="absolute right-2 top-2 flex flex-col overflow-hidden rounded-md border border-white/10 bg-background/80 [backdrop-filter:blur(10px)]"
      @pointerdown.stop
      @wheel.stop
    >
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
        :disabled="zoom >= 6"
        :title="$t('pages.utility.board.zoom_in')"
        @click.stop="easeZoom(() => zoomAt(zoom * 1.4))"
      >
        <Plus class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center border-t border-white/10 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
        :disabled="zoom <= 1"
        :title="$t('pages.utility.board.zoom_out')"
        @click.stop="easeZoom(() => zoomAt(zoom / 1.4))"
      >
        <Minus class="h-3.5 w-3.5" />
      </button>
      <button
        v-if="zoom > 1"
        type="button"
        class="flex h-7 w-7 items-center justify-center border-t border-white/10 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :title="$t('pages.utility.board.zoom_reset')"
        @click.stop="easeZoom(() => resetView())"
      >
        <Maximize2 class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* What the board looks like before there is a map on it. Static on purpose:
   this square is the biggest thing on the page, and anything that pulses or
   sweeps at that size is the flash it was meant to replace. */
.utility-board-pending {
  background-image:
    linear-gradient(hsl(var(--border) / 0.35) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--border) / 0.35) 1px, transparent 1px);
  background-size: 44px 44px;
  background-position: center;
  -webkit-mask-image: radial-gradient(
    circle at center,
    #000 25%,
    transparent 72%
  );
  mask-image: radial-gradient(circle at center, #000 25%, transparent 72%);
}

/* Every scale below goes through transform-box: fill-box. Without it an SVG
   transform is measured from the canvas origin, so scaling a marker sitting at
   the far corner of the map does not grow it in place -- it flings it at the
   top-left and back. fill-box puts the origin in the shape's own bounding box,
   which is the only reason a dot can pop where it stands. */

/* The throws fade as a set, but each dot and each origin square lands on its
   own centre. The group cannot be the thing that scales: a marker is an origin
   and a landing that can sit half a map apart, and scaling that pair about the
   midpoint of the two slides both shapes along the throw instead of growing
   them. Only the endpoints scale; the line between them just fades. */
.mk-enter-active {
  transition: opacity 200ms ease-out;
}
.mk-leave-active {
  transition: opacity 120ms ease-in;
}
.mk-enter-from,
.mk-leave-to {
  opacity: 0;
}
.mk-enter-active :is(circle, rect),
.mk-leave-active :is(circle, rect) {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
.mk-leave-active :is(circle, rect) {
  transition-duration: 120ms;
  transition-timing-function: ease-in;
}
.mk-enter-from :is(circle, rect),
.mk-leave-to :is(circle, rect) {
  transform: scale(0.5);
}
/* A marker growing under a stationary cursor crosses its own hit edge, so it
   fires mouseenter/mouseleave at itself while it lands -- and every one of
   those flips the hovered styling, which is what the shake was. Nothing that
   is still arriving is hoverable. */
.mk-enter-active,
.mk-leave-active {
  pointer-events: none;
}

/* Mined spots bloom in on a stagger the marker carries itself (--meta-delay).
   Leaving is flat, quick and un-staggered: forty rings stepping out is a wipe,
   not an answer.

   The ring only opens the last of the way -- 0.88, not the 0.35 a solid dot can
   take. A dashed stroke is the one shape that cannot be scaled far: the dashes
   crawl around the circumference the whole way up and the stroke width tracks
   the scale, so a big scale shimmers rather than grows. And the easing does not
   overshoot. Thirteen rings each bouncing past their own size on a stagger is
   read as the map vibrating, not as the map answering.

   The thrower count does not scale with its ring. Type is where sub-pixel
   scaling shows worst, and it is the number you are trying to read. */
/* Backed off, not hidden -- a muted ring is still the answer to "what else is
   around here". Declared ahead of the enter/leave opacities so a ring arriving
   into a muted map still blooms up from nothing, and ahead of --stacked so a
   ring that is standing under its lead stays gone rather than half-there. */
.meta-marker--muted {
  opacity: 0.32;
}

.meta-enter-active {
  transition: opacity 240ms ease-out;
  transition-delay: var(--meta-delay, 0ms);
}
.meta-leave-active {
  transition: opacity 110ms ease-in;
}
.meta-enter-from,
.meta-leave-to {
  opacity: 0;
}
.meta-enter-active circle,
.meta-leave-active circle {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--meta-delay, 0ms);
}
.meta-leave-active circle {
  transition: transform 110ms ease-in;
}
.meta-enter-from circle,
.meta-leave-to circle {
  transform: scale(0.88);
}
/* Same reason as the throws: a ring growing under the cursor crosses its own
   hit edge and lights itself on and off while it lands. */
.meta-enter-active,
.meta-leave-active {
  pointer-events: none;
}

/* The members a closed cluster is standing in for. Hidden rather than moved
   out of the way: they are stacked on the lead ring's point, so drawing them
   would print N rings and N counts on the same pixels. No transition on the
   way in or out -- the slide is what reads as the fan opening, and an opacity
   animation here would not advance at all in a backgrounded tab. */
.meta-marker--stacked {
  opacity: 0;
  pointer-events: none;
}

/* The fan. Only the group travels -- transform on an SVG <g> is the one thing
   here that can move a whole marker, hit circle included, without touching a
   single geometry attribute, so the ring, its count and its target arrive
   together and stay in register the whole way out.

   It has to be the inner group. Put this transition on .meta-marker and
   TransitionGroup takes it as proof the list FLIP-animates, starts writing its
   own inline transform on the way through, and clears it when the move ends --
   which clears the bound one too. */
.meta-shift {
  transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* The lines and the anchor dot are drawn at their final positions from the
   first frame and simply fade up, because the ring sliding along them is what
   reads as the movement. Fading in slower than the slide would leave the ring
   arriving before its own leader line. */
/* The leader lines and the count badge do not fade, and that is the fix rather
   than the compromise. A keyframe animation does not advance while the tab is
   backgrounded -- it reports itself as running, sits at time 0, and holds the
   property it is animating -- so a fade here meant switching tabs mid-fan and
   coming back to invisible lines. Neither fill-mode nor a transition escapes
   that; only not animating opacity does.

   Nothing is lost. The line is the path the ring travels, so it belongs on
   screen before the ring sets off, not arriving alongside it. The slide is the
   animation; these are the thing it slides along. */

@media (prefers-reduced-motion: reduce) {
  .meta-shift {
    transition-duration: 1ms;
  }
}

.badge-enter-active {
  transition:
    opacity 200ms ease-out,
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.badge-leave-active {
  transition:
    opacity 120ms ease-in,
    transform 120ms ease-in;
}
.badge-enter-from,
.badge-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

@media (prefers-reduced-motion: reduce) {
  .mk-enter-active,
  .mk-leave-active,
  .meta-enter-active,
  .meta-leave-active,
  .badge-enter-active,
  .badge-leave-active {
    transition-duration: 1ms;
    transition-delay: 0ms;
  }
  /* The stagger has to go too, not just shrink: a delay is still a wait even
     when the fade it is holding back takes a millisecond. */
  .mk-enter-active :is(circle, rect),
  .mk-leave-active :is(circle, rect),
  .meta-enter-active circle,
  .meta-leave-active circle {
    transition-duration: 1ms;
    transition-delay: 0ms;
  }
}
</style>
