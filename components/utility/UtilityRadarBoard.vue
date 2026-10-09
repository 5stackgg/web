<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowReactive,
  useId,
  watch,
} from "vue";
import { useElementSize, useMediaQuery } from "@vueuse/core";
import { MapPinOff, Maximize2, Minus, Plus, Tags } from "lucide-vue-next";
import RadarCallouts from "~/components/common/RadarCallouts.vue";
import UtilityLineupHoverPreview from "~/components/utility/UtilityLineupHoverPreview.vue";
import { useUtilityPeek } from "~/composables/useUtilityPeek";
import { useMapCallouts } from "~/composables/useMapCallouts";
import {
  useRadarProjection,
  type RadarPoint,
} from "~/composables/useRadarProjection";
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
import {
  TAP_MAX_MS,
  TAP_SLOP_PX,
  dragZoom,
  isDoubleTap,
  isTap,
  momentumStep,
  pinchView,
  releaseVelocity,
  type MapPoint,
  type MapSample,
  type MapView,
} from "~/utilities/mapGestures";
import {
  hitRadius,
  markInk,
  maxZoomFor,
  nearestMark,
} from "~/utilities/boardMarks";

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
    // The page draws the zoom row above the map instead; see defineExpose.
    controls?: boolean;
    // A radar the page before this one was already showing, so the board
    // opens on it instead of on the blueprint and a fade.
    seedSrc?: string | null;
    // Resting on a marker opens the lineup's peek, as resting on its row does.
    peek?: boolean;
    // Off for a board that is one picture in a column that scrolls: with it
    // on, a finger on the map moves the map and never the page under it.
    touch?: boolean;
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
    controls: true,
    peek: false,
    touch: true,
  },
);

const emit = defineEmits<{
  (e: "select", id: string | null): void;
  (e: "hover", id: string | null): void;
  (e: "select-meta", key: string | null): void;
  (e: "hover-meta", key: string | null): void;
  (e: "pick", point: { x: number; y: number; z: number }): void;
  (e: "marker-grab", key: string): void;
  (e: "marker-drag", key: string, point: { x: number; y: number; z: number }): void;
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
const displaySrc = ref<string | null>(props.seedSrc ?? null);

// A map with a radar per room shows the room the throws are in: the selected
// lineup's, or else wherever most of what the board draws stands.
function boardVolumePoints(): RadarPoint[] {
  const selected = props.lineups.find(
    (lineup) => lineup.id === props.selectedId,
  );
  const points: RadarPoint[] = [];
  for (const lineup of selected ? [selected] : props.lineups) {
    points.push(utilityOrigin(lineup));
    const landing = utilityLanding(lineup);
    if (landing) {
      points.push(landing);
    }
  }
  if (selected) {
    return points;
  }
  for (const spot of props.metaSpots ?? []) {
    points.push(spot.landing ?? spot.origin);
  }
  for (const marker of props.markers ?? []) {
    points.push(marker.point);
  }
  for (const segment of props.segments ?? []) {
    points.push(segment.from, segment.to);
  }
  return points;
}

const {
  radarSrc,
  hasCalibration,
  projectCalibrated,
  unprojectCalibrated,
  CANVAS,
} = useRadarProjection(() => props.mapName, {
  radarFailed,
  volumePoints: boardVolumePoints,
});

const { callouts, hasCallouts } = useMapCallouts(() => props.mapName);

// The board loads the callouts itself rather than taking them as a prop: it
// already knows which map it is showing, and the composable serves every board
// on the page from one request.
const CALLOUTS_KEY = "5s.utility.show_callouts";
const showCallouts = ref(false);

onMounted(() => {
  try {
    showCallouts.value = localStorage.getItem(CALLOUTS_KEY) === "1";
  } catch {
    // private browsing -- the default stands
  }
});

watch(showCallouts, (on) => {
  try {
    localStorage.setItem(CALLOUTS_KEY, on ? "1" : "0");
  } catch {
    // private browsing -- the toggle still works for this session
  }
});

watch(
  radarSrc,
  (next) => {
    // No radar for this map at all: there is nothing to hold on to, and holding
    // the previous map would be a lie about which map you are looking at. Not
    // known yet is not none, though: until the calibrations are read the board
    // keeps the radar it was opened on.
    if (!next) {
      if (!hasCalibration.value || radarFailed.value) {
        displaySrc.value = null;
      }
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
  // How far the smoke blooms or the fire spreads, in board units, so the open
  // lineup can show the ground it actually covers.
  footprint: number | null;
};

// World units. A smoke fills ~144 units around where it pops; a molotov's fire
// spreads ~120. The rest cover no ground worth drawing.
const FOOTPRINT_UNITS: Partial<Record<string, number>> = {
  Smoke: 144,
  Molotov: 120,
};

// Gradient ids have to be unique on the page, and a lineup's preview mounts a
// second board beside this one.
const uid = useId();

const markerEls = shallowReactive(new Map<string, Element>());

function trackMarker(id: string, el: unknown) {
  if (el instanceof Element) {
    markerEls.set(id, el);
  } else {
    markerEls.delete(id);
  }
}

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
    const reach = FOOTPRINT_UNITS[lineup.utility_type];
    const edge =
      land && landing && reach
        ? projectCalibrated({ ...land, x: land.x + reach })
        : null;
    out.push({
      id: lineup.id,
      color: UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff",
      origin,
      landing,
      path,
      footprint:
        edge && landing ? Math.hypot(edge.x - landing.x, edge.y - landing.y) : null,
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

// The page closes its own layers on Escape too (selection, spot filter), and
// both listeners sit on window. The board mounts first so it hears the key
// first; marking the event handled stops one press closing two layers.
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && !event.defaultPrevented && openCluster.value) {
    event.preventDefault();
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
  draggable: boolean;
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
      draggable: marker.draggable ?? false,
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
const ZOOM_CEILING = 6;

const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const viewportRef = ref<HTMLElement | null>(null);
const { width: frameWidth } = useElementSize(viewportRef);

// How far in is worth going depends on the picture: see maxZoomFor.
const radarWidth = ref(0);
const maxZoom = computed(() =>
  maxZoomFor(radarWidth.value, frameWidth.value, ZOOM_CEILING),
);

// What the peek must not cover: the throw as drawn -- the marker and its
// line, which live in separate layers -- clipped to the part of the board
// that is on screen.
function peekLine(lineupId: string): DOMRect | null {
  const root = viewportRef.value;
  if (!root) {
    return null;
  }
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  root
    .querySelectorAll(`[data-peek-line="${lineupId}"]`)
    .forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return;
      }
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    });
  return right > left && bottom > top
    ? new DOMRect(left, top, right - left, bottom - top)
    : null;
}

let releasePeekBoard: (() => void) | null = null;

watch(
  () => props.peek,
  (enabled) => {
    releasePeekBoard?.();
    releasePeekBoard =
      enabled && import.meta.client
        ? useUtilityPeek().registerBoard({
            rect: () => viewportRef.value?.getBoundingClientRect() ?? null,
            line: peekLine,
          })
        : null;
  },
  { immediate: true },
);

onBeforeUnmount(() => releasePeekBoard?.());
const svgRef = ref<SVGSVGElement | null>(null);
const panning = ref(false);

let dragged = false;
let captured = false;

// How far the pointer may wander before a press counts as a pan rather than a
// pick. Measured from where the press started, not between consecutive move
// events -- a slow drag never moves far enough in any single event, so it used
// to pan the map and then register a pick at the end of it.
const DRAG_SLOP = 3;

// The zoom the board is LAID OUT at, as opposed to the one it is drawn at.
// At rest they are the same and the board really is that many times the
// frame's size, so the radar and everything on it are painted at the size
// they are seen at. A scale transform alone leaves that to the browser, and
// one that keeps the board on a layer of its own paints it once at 1x and
// stretches the bitmap: a soft map, and marks that were sub-pixel when
// painted turning up as faint smudges. While something is moving the
// difference rides the transform instead, which costs no layout, and the
// board is laid out again where it comes to rest.
const laidZoom = ref(1);

const boardStyle = computed(() => {
  const laid = laidZoom.value;
  const moving = panning.value || easing.value || gliding.value;
  return {
    width: `${laid * 100}%`,
    height: `${laid * 100}%`,
    left: `${(1 - laid) * 50}%`,
    top: `${(1 - laid) * 50}%`,
    transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value / laid})`,
    transformOrigin: "center center",
    // will-change pins the layer's raster at the scale it was promoted at.
    // It buys smoothness during a drag and costs sharpness the rest of the
    // time, so it is only on while something is actually moving.
    willChange: moving ? "transform" : "auto",
    transition: easing.value
      ? `transform ${ZOOM_EASE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : "none",
  };
});

// The whole board is magnified as one, which is right for the map and wrong
// for everything drawn on it: at 4x a 2px ring stroke is 8px of ink and a
// 14px count is 56px of type sitting across half a bombsite. Anything that is
// ink rather than distance is multiplied by this, so it holds its size on
// screen at every zoom -- and on every board: the svg is stretched to the
// frame, so on a phone the same numbers used to come out a third the size.
// Radii do NOT -- a meta ring's radius is how far apart the throws in that
// cluster actually landed, which is a distance on the map and has to scale
// with it.
//
// A finger covers what it points at, so under one the marks are drawn
// larger. Whatever is drawn, what is hit has a size of its own that it never
// goes under: 44px for a finger, 24px for a mouse.
const coarse = useMediaQuery("(pointer: coarse)");
const ink = computed(() =>
  markInk(zoom.value, frameWidth.value, CANVAS, coarse.value),
);
const reach = computed(() =>
  hitRadius(zoom.value, frameWidth.value, CANVAS, coarse.value),
);
// Only a finger's reach is wide enough to take in things that are not marks
// of their own: a ring whose size is a distance on the map.
const touchReach = computed(() => (coarse.value ? reach.value : 0));

function hit(size: number) {
  return Math.max(size * ink.value, reach.value);
}

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
  stopWheel();
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
  stopWheel();
  cancelAnimationFrame(glideFrame);
});

function zoomAt(next: number, clientX?: number, clientY?: number) {
  const rect = viewportRef.value?.getBoundingClientRect();
  const target = Math.min(maxZoom.value, Math.max(MIN_ZOOM, next));
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

// A wheel says how far, not only which way: a notched wheel sends one big
// delta per click, a Magic Mouse or trackpad sends dozens of small ones a
// second. A fixed 15% per event zoomed the second kind several times too fast,
// and every step landed in one frame, which read as the map jumping. The
// distance now moves a target and the board glides after it -- a share of the
// remaining way each frame, so a stream of events stays one smooth motion.
const WHEEL_RATE = 0.0025;
// A trackpad pinch arrives as a ctrl-wheel with much smaller deltas.
const PINCH_RATE = 0.01;
// One accelerated flick must not cross the whole range in a single event.
const WHEEL_DELTA_CAP = 60;
// Time constant of the glide; frame-rate independent, so 120Hz is not faster.
const WHEEL_GLIDE_MS = 50;

let wheelTarget = 1;
let wheelX = 0;
let wheelY = 0;
let wheelFrame = 0;
let wheelLast = 0;
const wheeling = ref(false);

function stopWheel() {
  cancelAnimationFrame(wheelFrame);
  wheelFrame = 0;
  wheelLast = 0;
  wheeling.value = false;
}

function glideWheel(now: number) {
  const dt = wheelLast ? Math.min(64, now - wheelLast) : 16;
  wheelLast = now;
  const remaining = Math.log(wheelTarget / zoom.value);
  if (Math.abs(remaining) < 0.002) {
    zoomAt(wheelTarget, wheelX, wheelY);
    stopWheel();
    return;
  }
  zoomAt(
    zoom.value * Math.exp(remaining * (1 - Math.exp(-dt / WHEEL_GLIDE_MS))),
    wheelX,
    wheelY,
  );
  wheelFrame = requestAnimationFrame(glideWheel);
}

function onWheel(event: WheelEvent) {
  event.preventDefault();
  const unit =
    event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  const delta = Math.max(
    -WHEEL_DELTA_CAP,
    Math.min(WHEEL_DELTA_CAP, event.deltaY * unit),
  );
  const rate = event.ctrlKey ? PINCH_RATE : WHEEL_RATE;
  if (!wheelFrame) {
    wheelTarget = zoom.value;
  }
  wheelTarget = Math.min(
    maxZoom.value,
    Math.max(MIN_ZOOM, wheelTarget * Math.exp(-delta * rate)),
  );
  wheelX = event.clientX;
  wheelY = event.clientY;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    zoomAt(wheelTarget, wheelX, wheelY);
    return;
  }
  if (!wheelFrame) {
    wheeling.value = true;
    wheelFrame = requestAnimationFrame(glideWheel);
  }
}

// One path for mouse, pen and fingers. What a press turns out to be is decided
// as it goes: it stays a tap until it wanders or lingers, becomes a pan when
// it moves, a pinch when a second finger lands, and a one-finger zoom when it
// is the second tap of a double tap that drags instead of lifting.
//
// Capture is deliberately NOT taken on the press. While a pointer capture is
// set, the compatibility click is dispatched at the capturing element instead
// of the element under the pointer -- so capturing the viewport on press meant
// the click never reached the <svg> beneath it, and picking a point silently
// stopped working at any zoom above 1. It is taken on the first real movement
// instead, by which time the gesture is a pan and there is no click to lose.
type Press = {
  id: number;
  type: string;
  x: number;
  y: number;
  t: number;
  moved: number;
};

const TAP_ZOOM_STEP = 2;
const FLING_MIN = 0.05;

const pointers = new Map<number, { x: number; y: number }>();
let press: Press | null = null;
let pinch: {
  ids: [number, number];
  view: MapView;
  from: [MapPoint, MapPoint];
  t: number;
  still: boolean;
} | null = null;
// A second finger was down at some point, so nothing in this gesture is a tap.
let pinched = false;
let lastTap: MapSample | null = null;
let tapZoom: { zoom: number; y: number; x: number } | null = null;
let samples: MapSample[] = [];
// A gesture that was not a tap must not select what it ended on.
let swallowClick = false;
const gliding = ref(false);

watch([zoom, panning, easing, gliding, wheeling], () => {
  if (
    !panning.value &&
    !easing.value &&
    !gliding.value &&
    !wheeling.value
  ) {
    laidZoom.value = zoom.value;
  }
});

// A smaller picture, or a narrower frame, can bring the limit in under where
// the board already is.
watch(maxZoom, (limit) => {
  if (zoom.value > limit) {
    zoomAt(limit);
  }
});

function framePoint(clientX: number, clientY: number): MapPoint {
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect) {
    return { x: 0, y: 0 };
  }
  return {
    x: clientX - rect.left - rect.width / 2,
    y: clientY - rect.top - rect.height / 2,
  };
}

function frameSize() {
  const rect = viewportRef.value?.getBoundingClientRect();
  return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
}

function takes(event: PointerEvent) {
  if (event.pointerType === "mouse") {
    return event.button === 0;
  }
  return props.touch;
}

function capture(event: PointerEvent, id = event.pointerId) {
  (event.currentTarget as HTMLElement).setPointerCapture?.(id);
  captured = true;
}

let glideFrame = 0;
let glideLast = 0;
let glideVelocity: MapPoint = { x: 0, y: 0 };

function stopGlide() {
  cancelAnimationFrame(glideFrame);
  glideFrame = 0;
  glideLast = 0;
  gliding.value = false;
}

// The fling after a pan: it slows the whole way, and an axis that meets the
// edge of the map gives up its speed there instead of pushing against it.
function glide(now: number) {
  const dt = glideLast ? Math.min(64, now - glideLast) : 16;
  glideLast = now;
  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const step = momentumStep(glideVelocity, dt, reduced ? 90 : undefined);
  const wantX = panX.value + step.dx;
  const wantY = panY.value + step.dy;
  panX.value = wantX;
  panY.value = wantY;
  clampPan();
  glideVelocity = {
    x: panX.value === wantX ? step.velocity.x : 0,
    y: panY.value === wantY ? step.velocity.y : 0,
  };
  if (step.done || (glideVelocity.x === 0 && glideVelocity.y === 0)) {
    stopGlide();
    return;
  }
  glideFrame = requestAnimationFrame(glide);
}

function beginPinch(event: PointerEvent) {
  const [a, b] = [...pointers.entries()];
  pinch = {
    ids: [a[0], b[0]],
    view: { zoom: zoom.value, x: panX.value, y: panY.value },
    from: [framePoint(a[1].x, a[1].y), framePoint(b[1].x, b[1].y)],
    t: event.timeStamp,
    still: true,
  };
  pinched = true;
  swallowClick = true;
  tapZoom = null;
  panning.value = true;
  capture(event, a[0]);
  capture(event, b[0]);
}

function onPointerDown(event: PointerEvent) {
  if (!takes(event)) {
    return;
  }
  stopWheel();
  stopGlide();
  easing.value = false;
  // The first finger down starts over. A pointer whose release never arrived
  // (the mark under it was redrawn mid-press) would otherwise sit here as a
  // second finger and turn the next pan into a pinch.
  if (event.isPrimary) {
    pointers.clear();
    pinch = null;
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    beginPinch(event);
    return;
  }
  if (pointers.size > 2) {
    return;
  }
  const tap = { t: event.timeStamp, x: event.clientX, y: event.clientY };
  press = { id: event.pointerId, type: event.pointerType, ...tap, moved: 0 };
  samples = [tap];
  pinched = false;
  dragged = false;
  captured = false;
  swallowClick = false;
  tapZoom =
    event.pointerType !== "mouse" && isDoubleTap(lastTap, tap)
      ? { zoom: zoom.value, x: tap.x, y: tap.y }
      : null;
}

function onPointerMove(event: PointerEvent) {
  const last = pointers.get(event.pointerId);
  if (!last) {
    return;
  }
  const at = { x: event.clientX, y: event.clientY };
  pointers.set(event.pointerId, at);

  if (pinch) {
    const a = pointers.get(pinch.ids[0]);
    const b = pointers.get(pinch.ids[1]);
    if (!a || !b) {
      return;
    }
    const to: [MapPoint, MapPoint] = [
      framePoint(a.x, a.y),
      framePoint(b.x, b.y),
    ];
    if (
      Math.hypot(to[0].x - pinch.from[0].x, to[0].y - pinch.from[0].y) >
        TAP_SLOP_PX ||
      Math.hypot(to[1].x - pinch.from[1].x, to[1].y - pinch.from[1].y) >
        TAP_SLOP_PX
    ) {
      pinch.still = false;
    }
    const view = pinchView(
      pinch.view,
      pinch.from,
      to,
      { min: MIN_ZOOM, max: maxZoom.value },
      frameSize(),
    );
    zoom.value = view.zoom;
    panX.value = view.x;
    panY.value = view.y;
    return;
  }

  if (!press || press.id !== event.pointerId) {
    return;
  }
  press.moved = Math.max(
    press.moved,
    Math.hypot(at.x - press.x, at.y - press.y),
  );
  if (!dragged) {
    if (press.moved <= (press.type === "mouse" ? DRAG_SLOP : TAP_SLOP_PX)) {
      return;
    }
    // With nothing to pan, a mouse press that wandered is still the click it
    // was meant as -- picking a point at 1x must not need a steady hand.
    if (press.type === "mouse" && zoom.value <= MIN_ZOOM) {
      return;
    }
    dragged = true;
    swallowClick = true;
    capture(event);
  }

  if (tapZoom) {
    zoomAt(
      dragZoom(tapZoom.zoom, at.y - tapZoom.y),
      tapZoom.x,
      tapZoom.y,
    );
    return;
  }
  if (zoom.value <= MIN_ZOOM) {
    return;
  }
  panning.value = true;
  panX.value += at.x - last.x;
  panY.value += at.y - last.y;
  clampPan();
  samples.push({ t: event.timeStamp, x: at.x, y: at.y });
  if (samples.length > 12) {
    samples.shift();
  }
}

// Back inside the limits after a pinch that pulled past one.
function settleZoom(clientX: number, clientY: number) {
  if (zoom.value < MIN_ZOOM || zoom.value > maxZoom.value) {
    easeZoom(() => zoomAt(zoom.value, clientX, clientY));
  }
}

function endPinch(event: PointerEvent) {
  const ended = pinch;
  if (!ended) {
    return;
  }
  pinch = null;
  const a = pointers.get(ended.ids[0]) ?? {
    x: event.clientX,
    y: event.clientY,
  };
  const b = pointers.get(ended.ids[1]) ?? {
    x: event.clientX,
    y: event.clientY,
  };
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  // Two fingers down and up without moving: one step back out.
  if (ended.still && event.timeStamp - ended.t <= TAP_MAX_MS) {
    easeZoom(() => zoomAt(zoom.value / TAP_ZOOM_STEP, midX, midY));
  } else {
    settleZoom(midX, midY);
  }
}

function onPointerUp(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) {
    return;
  }
  const target = event.currentTarget as HTMLElement;
  if (pinch?.ids.includes(event.pointerId)) {
    endPinch(event);
  }
  pointers.delete(event.pointerId);
  if (captured) {
    target.releasePointerCapture?.(event.pointerId);
  }

  // A finger left on the map after a pinch carries on as a pan.
  if (pointers.size === 1 && pinched) {
    const [[id, at]] = [...pointers.entries()];
    press = {
      id,
      type: event.pointerType,
      x: at.x,
      y: at.y,
      t: event.timeStamp,
      moved: Infinity,
    };
    dragged = true;
    samples = [{ t: event.timeStamp, x: at.x, y: at.y }];
    return;
  }
  if (pointers.size > 0) {
    return;
  }

  const ended = press;
  press = null;
  panning.value = false;
  captured = false;
  if (!ended || ended.id !== event.pointerId) {
    tapZoom = null;
    return;
  }
  if (event.type === "pointercancel") {
    tapZoom = null;
    lastTap = null;
    return;
  }

  const tap = { t: event.timeStamp, x: event.clientX, y: event.clientY };
  if (tapZoom && dragged) {
    tapZoom = null;
    lastTap = null;
    return;
  }
  if (
    ended.type !== "mouse" &&
    !pinched &&
    isTap(ended.moved, event.timeStamp - ended.t)
  ) {
    if (tapZoom) {
      tapZoom = null;
      lastTap = null;
      swallowClick = true;
      easeZoom(() => zoomAt(zoom.value * TAP_ZOOM_STEP, tap.x, tap.y));
      return;
    }
    lastTap = tap;
    return;
  }
  tapZoom = null;
  lastTap = null;

  if (dragged && !pinched && zoom.value > MIN_ZOOM) {
    const velocity = releaseVelocity(samples, event.timeStamp);
    if (Math.hypot(velocity.x, velocity.y) > FLING_MIN) {
      glideVelocity = velocity;
      gliding.value = true;
      glideFrame = requestAnimationFrame(glide);
    }
  }
}

// Safari announces a pinch with its own gesture events and zooms the page on
// them unless they are refused, whatever touch-action says.
function refuseGesture(event: Event) {
  if (props.touch) {
    event.preventDefault();
  }
}

onMounted(() => {
  viewportRef.value?.addEventListener("gesturestart", refuseGesture, {
    passive: false,
  });
  viewportRef.value?.addEventListener("gesturechange", refuseGesture, {
    passive: false,
  });
});

function onClickCapture(event: MouseEvent) {
  if (swallowClick) {
    swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
  }
}

function resetView() {
  stopWheel();
  stopGlide();
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
}

const zoomIn = () => easeZoom(() => zoomAt(zoom.value * 1.4));
const zoomOut = () => easeZoom(() => zoomAt(zoom.value / 1.4));
const resetZoom = () => easeZoom(() => resetView());
const ready = computed(() => !!displaySrc.value);

defineExpose({
  ready,
  // The square the radar is drawn in, for a page that grows it out of -- or
  // hands it back to -- a smaller copy of itself.
  viewport: viewportRef,
  zoom,
  zoomIn,
  zoomOut,
  resetZoom,
  canZoomIn: computed(() => zoom.value < maxZoom.value),
  canZoomOut: computed(() => zoom.value > MIN_ZOOM),
  hasCallouts,
  showCallouts,
});

// A new map is a new view; keeping the old pan would open it somewhere random.
watch(
  () => props.mapName,
  () => resetView(),
);

// correction.

// Where a pointer is, in world units. The rect comes from the <svg>, which sits
// INSIDE the zoom transform, so it already describes the transformed box and
// none of this has to know the zoom exists.
function worldAt(clientX: number, clientY: number) {
  const target = svgRef.value;
  if (!target) {
    return null;
  }
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }
  return unprojectCalibrated(
    {
      x: ((clientX - rect.left) / rect.width) * CANVAS,
      y: ((clientY - rect.top) / rect.height) * CANVAS,
    },
    props.pickZ,
  );
}

// With a finger the targets are a fingertip wide and overlap wherever two
// marks are close, so the one that takes the tap is only the one drawn last.
// The tap goes to whichever is nearest instead.
function onMarkerClick(id: string, event: MouseEvent) {
  const rect = svgRef.value?.getBoundingClientRect();
  if (!coarse.value || !rect?.width || !rect.height) {
    emit("select", id);
    return;
  }
  const at = {
    x: ((event.clientX - rect.left) / rect.width) * CANVAS,
    y: ((event.clientY - rect.top) / rect.height) * CANVAS,
  };
  const points = markers.value.flatMap((marker) => [
    { id: marker.id, ...marker.origin },
    ...(marker.landing ? [{ id: marker.id, ...marker.landing }] : []),
  ]);
  emit("select", nearestMark(points, at, touchReach.value * 1.25) ?? id);
}

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
  const world = worldAt(event.clientX, event.clientY);
  if (!world) {
    return;
  }
  emit("pick", world);
}

// Grabbing one of the placed points. The press alone says "this is the end I
// mean" -- which is what makes the two ends re-pickable by clicking them, the
// thing the hint under the coordinates has always claimed -- and any movement
// after it drags that end instead of dropping a new point somewhere else.
const draggingKey = ref<string | null>(null);

function onMarkerDown(event: PointerEvent, marker: DrawnMarker) {
  if (!props.picking || !marker.draggable) {
    return;
  }
  event.stopPropagation();
  draggingKey.value = marker.key;
  emit("marker-grab", marker.key);
  (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
}

function onMarkerMove(event: PointerEvent) {
  const key = draggingKey.value;
  if (!key) {
    return;
  }
  event.stopPropagation();
  const world = worldAt(event.clientX, event.clientY);
  if (!world) {
    return;
  }
  emit("marker-drag", key, world);
}

function onMarkerUp(event: PointerEvent) {
  if (!draggingKey.value) {
    return;
  }
  event.stopPropagation();
  (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  draggingKey.value = null;
}

const activeId = computed(() => props.hoveredId ?? props.selectedId ?? null);

// A mined cluster reads the same whether you picked it or are only pointing at
// it: the question both answer is "which one is this".
function metaLit(key: string) {
  return props.selectedMetaKey === key || props.hoveredMetaKey === key;
}

// Lines live in their own layer above every marker, in two groups. Markers
// used to be re-sorted so the lit one came last, and moving a node in the DOM
// cancels whatever transition it was in -- which is why a hovered line and its
// marker could only ever pop. Nothing is reordered now, so everything eases.
//
// The open lineup keeps its line while the cursor is on another marker, just
// quieter: hovering is a look at something else, not a reason for the thing
// you are reading to vanish and come back.
const steadyTrails = computed(() =>
  markers.value.filter(
    (marker) =>
      marker.landing &&
      (props.showAllLines || marker.id === props.selectedId),
  ),
);

const hoverTrail = computed(() => {
  const id = props.hoveredId;
  if (!id || props.showAllLines || id === props.selectedId) {
    return [];
  }
  return markers.value.filter((marker) => marker.id === id && marker.landing);
});

// Scaled about its own centre, in the board's units.
function grow(point: { x: number; y: number }, by: number) {
  return {
    transform: `scale(${by})`,
    transformOrigin: `${point.x}px ${point.y}px`,
  };
}

// The open lineup's line draws itself from the thrower to the landing -- but
// only when it arrives new. A line already on screen because the cursor was
// on it when you clicked does not draw a second time.
const drawId = ref<string | null>(null);
let drawTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.selectedId,
  (id) => {
    drawId.value = id && id !== props.hoveredId ? id : null;
    if (drawTimer) {
      clearTimeout(drawTimer);
    }
    drawTimer = setTimeout(() => (drawId.value = null), 500);
  },
);

onBeforeUnmount(() => {
  if (drawTimer) {
    clearTimeout(drawTimer);
  }
});

function trailPath(marker: Marker) {
  if (marker.path) {
    return marker.path;
  }
  const end = marker.landing ?? marker.origin;
  return `M${marker.origin.x} ${marker.origin.y} L${end.x} ${end.y}`;
}
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
      :class="[
        zoom > 1 ? (panning ? 'cursor-grabbing' : 'cursor-grab') : '',
        touch
          ? 'touch-none select-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]'
          : '',
      ]"
      :data-no-sheet-drag="touch ? '' : undefined"
      @wheel="onWheel"
      @click.capture="onClickCapture"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- Full bleed. Insetting this to clear the floating chrome cost far more
         than it bought: the map is square, so shortening it vertically shrinks
         it in BOTH axes and leaves wide empty margins. The name and the legend
         carry their own text shadows for exactly this reason. -->
      <div data-board-layer class="absolute" :style="boardStyle">
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
            @load="
              radarWidth = ($event.target as HTMLImageElement).naturalWidth
            "
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
          ref="svgRef"
          class="absolute inset-0 h-full w-full"
          :class="picking ? 'cursor-crosshair' : ''"
          :viewBox="`0 0 ${CANVAS} ${CANVAS}`"
          preserveAspectRatio="none"
          @click="onBoardClick"
        >
          <!-- First in the stack: the map's own vocabulary is a backdrop for
           the lineups, never something drawn over them. -->
          <RadarCallouts
            v-if="showCallouts"
            :callouts="callouts"
            :project="projectCalibrated"
            :zoom="1 / ink"
          />
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
                    :r="Math.max(meta.radius, touchReach)"
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
                  v-if="coarse"
                  :cx="cluster.anchor.x + cluster.radius * 0.72"
                  :cy="cluster.anchor.y - cluster.radius * 0.72"
                  :r="hit(9)"
                  fill="transparent"
                />
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
              v-for="marker of markers"
              :key="marker.id"
              :ref="(el) => trackMarker(marker.id, el)"
              :data-peek-line="marker.id"
              :class="picking ? 'pointer-events-none' : 'cursor-pointer'"
              @click.stop="onMarkerClick(marker.id, $event)"
              @mouseenter="emit('hover', marker.id)"
              @mouseleave="emit('hover', null)"
            >
              <template v-if="marker.landing">
                <!-- The landing grows under the cursor rather than swapping to
                     a bigger ring. Where the open throw shows the ground it
                     covers, the ring steps back for it and the dot stays. -->
                <g
                  class="utility-glyph"
                  :style="grow(marker.landing, activeId === marker.id ? 1.55 : 1)"
                >
                  <g
                    class="utility-glyph-fade"
                    :opacity="activeId === marker.id && marker.footprint ? 0 : 1"
                  >
                    <circle
                      :cx="marker.landing.x"
                      :cy="marker.landing.y"
                      :r="8.5 * ink"
                      fill="none"
                      stroke="#05070b"
                      stroke-opacity="0.55"
                      :stroke-width="2 * ink"
                    />
                    <circle
                      :cx="marker.landing.x"
                      :cy="marker.landing.y"
                      :r="7 * ink"
                      fill="rgba(5, 7, 11, 0.35)"
                      :stroke="marker.color"
                      :stroke-opacity="activeId === marker.id ? 1 : 0.75"
                      :stroke-width="2 * ink"
                    />
                  </g>
                  <circle
                    :cx="marker.landing.x"
                    :cy="marker.landing.y"
                    :r="2.5 * ink"
                    :fill="marker.color"
                    :fill-opacity="activeId === marker.id ? 1 : 0.8"
                  />
                </g>
                <!-- The ring is smaller than the dot it replaced; the target
                     is not, and it does not grow with the ring -- a target
                     that moves under a still cursor hovers itself on and off. -->
                <circle
                  data-mark-hit
                  :cx="marker.landing.x"
                  :cy="marker.landing.y"
                  :r="hit(13)"
                  fill="transparent"
                />
              </template>

              <!-- The throw origin is the part a player has to stand on, so it is
             drawn as a hard square while the landing stays a soft ring. -->
              <g
                class="utility-glyph"
                :style="grow(marker.origin, activeId === marker.id ? 1.3 : 1)"
              >
                <rect
                  :x="marker.origin.x - 5.5 * ink"
                  :y="marker.origin.y - 5.5 * ink"
                  :width="11 * ink"
                  :height="11 * ink"
                  :rx="3 * ink"
                  :fill="marker.color"
                  :fill-opacity="activeId === marker.id ? 1 : 0.7"
                  stroke="#05070b"
                  :stroke-width="2 * ink"
                />
              </g>
              <circle
                data-mark-hit
                :cx="marker.origin.x"
                :cy="marker.origin.y"
                :r="hit(11)"
                fill="transparent"
              />
            </g>
          </TransitionGroup>

          <!-- Faint where it leaves the hand and solid where it lands, so the
               direction reads without an arrowhead, on a dark casing that
               keeps it legible across the white walls. The open smoke or
               molotov lands as the ground it covers, to the map's scale. -->
          <g class="pointer-events-none">
            <TransitionGroup
              v-for="(group, layer) of [steadyTrails, hoverTrail]"
              :key="layer"
              name="trail"
              tag="g"
            >
              <g
                v-for="marker of group"
                :key="marker.id"
                :data-peek-line="marker.id"
              >
                <defs>
                  <linearGradient
                    :id="`${uid}-trail-${marker.id}`"
                    gradientUnits="userSpaceOnUse"
                    :x1="marker.origin.x"
                    :y1="marker.origin.y"
                    :x2="marker.landing!.x"
                    :y2="marker.landing!.y"
                  >
                    <stop offset="0" :stop-color="marker.color" stop-opacity="0.05" />
                    <stop offset="0.55" :stop-color="marker.color" stop-opacity="0.55" />
                    <stop offset="1" :stop-color="marker.color" stop-opacity="1" />
                  </linearGradient>
                </defs>
                <path
                  :d="trailPath(marker)"
                  fill="none"
                  stroke="#05070b"
                  :stroke-opacity="activeId === marker.id ? 0.45 : 0.2"
                  :stroke-width="7 * ink"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  pathLength="1"
                  class="utility-trail-line"
                  :class="drawId === marker.id ? 'utility-trail-draw' : ''"
                />
                <path
                  :d="trailPath(marker)"
                  fill="none"
                  :stroke="`url(#${uid}-trail-${marker.id})`"
                  :stroke-opacity="activeId === marker.id ? 1 : 0.45"
                  :stroke-width="(activeId === marker.id ? 3.5 : 2) * ink"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  pathLength="1"
                  class="utility-trail-line"
                  :class="drawId === marker.id ? 'utility-trail-draw' : ''"
                />
                <Transition name="trail">
                  <circle
                    v-if="activeId === marker.id && marker.footprint"
                    :cx="marker.landing!.x"
                    :cy="marker.landing!.y"
                    :r="marker.footprint"
                    :fill="marker.color"
                    fill-opacity="0.16"
                    :stroke="marker.color"
                    stroke-opacity="0.85"
                    :stroke-width="1.5 * ink"
                  />
                </Transition>
              </g>
            </TransitionGroup>
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
                :stroke-width="2 * hit(11)"
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
                :class="
                  picking && marker.draggable
                    ? 'cursor-move'
                    : 'pointer-events-none'
                "
                :style="{
                  transformOrigin: `${marker.point.x}px ${marker.point.y}px`,
                }"
                @pointerdown="onMarkerDown($event, marker)"
                @pointermove="onMarkerMove"
                @pointerup="onMarkerUp"
                @pointercancel="onMarkerUp"
              >
                <!-- The drawn cross and dot are thin, and a point you cannot
                     hit is a point you cannot re-pick. This invisible disc is
                     what the pointer actually grabs. -->
                <circle
                  v-if="picking && marker.draggable"
                  :cx="marker.point.x"
                  :cy="marker.point.y"
                  :r="hit(18)"
                  fill="transparent"
                />
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
      v-if="displaySrc && controls"
      class="absolute right-2 top-2 flex flex-col overflow-hidden rounded-md border border-white/10 bg-background/80 [backdrop-filter:blur(10px)]"
      @pointerdown.stop
      @wheel.stop
    >
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
        :disabled="zoom >= maxZoom"
        :title="$t('pages.utility.board.zoom_in')"
        @click.stop="zoomIn"
      >
        <Plus class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center border-t border-white/10 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
        :disabled="zoom <= 1"
        :title="$t('pages.utility.board.zoom_out')"
        @click.stop="zoomOut"
      >
        <Minus class="h-3.5 w-3.5" />
      </button>
      <button
        v-if="zoom > 1"
        type="button"
        class="flex h-7 w-7 items-center justify-center border-t border-white/10 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :title="$t('pages.utility.board.zoom_reset')"
        @click.stop="resetZoom"
      >
        <Maximize2 class="h-3.5 w-3.5" />
      </button>
      <button
        v-if="hasCallouts"
        type="button"
        class="flex h-7 w-7 items-center justify-center border-t border-white/10 transition-colors hover:bg-muted/50 hover:text-foreground"
        :class="
          showCallouts ? 'bg-tac-amber/15 text-tac-amber' : 'text-muted-foreground'
        "
        :title="$t('pages.utility.board.callouts_tip')"
        @click.stop="showCallouts = !showCallouts"
      >
        <Tags class="h-3.5 w-3.5" />
      </button>
    </div>

    <template v-if="peek && !picking">
      <UtilityLineupHoverPreview
        v-for="lineup of lineups"
        :key="lineup.id"
        :lineup="lineup"
        :anchor="markerEls.get(lineup.id) ?? null"
        placement="pointer"
        :enabled="!panning"
      />
    </template>
  </div>
</template>

<style scoped>
/* Hover is a thing you do a dozen times a second across a busy site, so what
   it changes eases rather than cuts: a line fades in and out, a marker grows
   and settles, the open throw's line dims instead of vanishing. Short enough
   to keep up with the cursor. */
.trail-enter-active {
  transition: opacity 180ms ease-out;
}
.trail-leave-active {
  transition: opacity 120ms ease-in;
}
.trail-enter-from,
.trail-leave-to {
  opacity: 0;
}
.utility-trail-line {
  transition:
    stroke-opacity 160ms ease-out,
    stroke-width 160ms ease-out;
}
.utility-glyph {
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.utility-glyph-fade {
  transition: opacity 160ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .trail-enter-active,
  .trail-leave-active,
  .utility-trail-line,
  .utility-glyph,
  .utility-glyph-fade {
    transition-duration: 1ms;
  }
}

/* pathLength="1" on the trail makes one dash exactly the line's length, so it
   draws on with no measuring. */
.utility-trail-draw {
  stroke-dasharray: 1;
  animation: utility-trail-draw 420ms cubic-bezier(0.32, 0.72, 0, 1) both;
}

@keyframes utility-trail-draw {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .utility-trail-draw {
    animation: none;
  }
}

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
