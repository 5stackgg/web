<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  AlertTriangle,
  ArrowLeft,
  Crosshair,
  MapPin,
  Sparkles,
  Square,
  Telescope,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "~/components/ui/toast";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import UtilitySegmented from "~/components/utility/UtilitySegmented.vue";
import UtilityTechniqueIcon from "~/components/utility/UtilityTechniqueIcon.vue";
import UtilityThrowIcon from "~/components/utility/UtilityThrowIcon.vue";
import UtilityPracticeButton from "~/components/utility/UtilityPracticeButton.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  UTILITY_DISCOVERY_OPTIONAL,
  cancelUtilityDiscoveryMutation,
  discoverUtilityLineupsMutation,
  myUtilityDiscoveriesSubscription,
  previewUtilitySmokeQuery,
  saveUtilityDiscoveryResultMutation,
  utilityDiscoverySubscription,
} from "~/graphql/utilityDiscoveryGraphql";
import { utilityLineupsQuery } from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import {
  notOpenedHere,
  openedHere,
  stepOutOf,
} from "~/composables/useBackDismiss";
import { useAuthStore } from "~/stores/AuthStore";
import {
  UTILITY_SIDES,
  UTILITY_THROW_STRENGTHS,
  UTILITY_TYPE_COLORS,
  utilityThrowButtonsKey,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityBoardShape,
  UtilityPanelBoard,
} from "~/utilities/utilityDisplay";
import {
  SMOKE_UPSAMPLE,
  decodeSmokeVolume,
  smokeFootprint,
  traceContour,
  upsampleFootprint,
} from "~/utils/smokeVolume";
import type {
  UtilityLineup,
  UtilitySide,
  UtilityThrowStrength,
  UtilityTrajectoryPoint,
} from "~/types/utility";
import type {
  UtilityDiscovery,
  UtilityDiscoveryDirection,
  UtilityDiscoveryGait,
  UtilityDiscoveryResult,
  UtilityDiscoverySummary,
  UtilityDiscoveryTechnique,
  UtilitySmokePreview,
} from "~/types/utilityDiscovery";

const props = defineProps<{
  mapName: string;
  canPractice?: boolean;
}>();

const emit = defineEmits<{
  (event: "board", state: UtilityPanelBoard): void;
  (event: "open-lineup", id: string): void;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const SMOKE_COLOR = UTILITY_TYPE_COLORS.Smoke ?? "#32d6e0";
const AREA_COLOR = "#f5b544";
// Mirrors UtilityDiscoveryService.MAX_AREA_SIDE.
const MAX_AREA_SIDE = 2048;
const DEFAULT_AREA_SIDE = 512;
// A radar pixel has no height. The area is sent as a band around the guess,
// and the search stands each spot on the floor nearest its middle.
const AREA_BAND = 384;
// A smoke's settled radius, for a spot whose bloom could not be measured.
const SMOKE_RADIUS = 144;
const RADII = [
  { key: "32", label: "tight", value: 32 },
  { key: "64", label: "close", value: 64 },
  { key: "128", label: "loose", value: 128 },
];
const DIRECTIONS: Array<{ key: UtilityDiscoveryDirection; keycap: string }> = [
  { key: "forward", keycap: "W" },
  { key: "left", keycap: "A" },
  { key: "back", keycap: "S" },
  { key: "right", keycap: "D" },
];
const ACTIVE = ["Predicting", "Queued", "Verifying"];
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Point = { x: number; y: number; z: number };

const mySteamId = computed(() => auth.me?.steam_id ?? null);

const openId = computed(() => {
  const id = route.query.discover;
  return typeof id === "string" && UUID.test(id) ? id : null;
});

function setOpen(id: string | null, mode: "push" | "replace") {
  const query = { ...route.query } as Record<string, unknown>;
  if (id) {
    query.discover = id;
  } else {
    delete query.discover;
  }
  const to = { path: route.path, query: query as any, hash: route.hash };
  if (mode === "push") {
    void router.push({ ...to, state: openedHere("discover") });
  } else {
    void router.replace(
      id ? to : { ...to, state: notOpenedHere("discover") },
    );
  }
}

function open(id: string) {
  setOpen(id, openId.value ? "replace" : "push");
}

function back() {
  stepOutOf(router, "discover", () => setOpen(null, "replace"));
}

const pickZ = ref(0);

async function seedHeight() {
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery(),
      variables: {
        where: {
          map_name: { _eq: props.mapName },
          can_view: { _eq: true },
        },
        order_by: [{ upvotes: order_by.desc }],
        limit: 60,
        offset: 0,
      },
      fetchPolicy: "cache-first",
    });
    const grounds = (((data as any)?.utility_lineups ?? []) as UtilityLineup[])
      .map((lineup) => Number(lineup.origin_z))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (grounds.length) {
      pickZ.value = Math.round(grounds[Math.floor(grounds.length / 2)]);
    }
  } catch (error) {
    console.error("[utility] discover height seed error:", error);
  }
}

watch(() => props.mapName, () => void seedHeight(), { immediate: true });

const pickMode = ref<"landing" | "area">("landing");
const target = ref<Point | null>(null);
const noFloor = ref(false);
const previewing = ref(false);
const smoke = ref<UtilitySmokePreview | null>(null);
const corners = ref<{ a: Point; b: Point } | null>(null);
const radius = ref("64");
const standing = ref(true);
const jumpThrow = ref(true);
const directions = ref<UtilityDiscoveryDirection[]>([]);
const gait = ref<UtilityDiscoveryGait>("run");
const movingJump = ref(false);
const strengths = ref<UtilityThrowStrength[]>(["Full"]);
const submitting = ref(false);
const selectedId = ref<string | null>(null);
const hoveredId = ref<string | null>(null);

let previewToken = 0;
let previewTimer: ReturnType<typeof setTimeout> | null = null;

// The spot is only as good as its height, so a pick is measured before it is
// believed: the api puts it on its floor and blooms the smoke there.
async function measure(point: Point) {
  const token = ++previewToken;
  previewing.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: previewUtilitySmokeQuery,
      variables: { map_name: props.mapName, ...point },
      fetchPolicy: "no-cache",
      context: UTILITY_DISCOVERY_OPTIONAL,
    });
    if (token !== previewToken) {
      return;
    }
    const preview = (data as any)?.previewUtilitySmoke as
      | UtilitySmokePreview
      | null;
    if (!preview) {
      noFloor.value = true;
      smoke.value = null;
      return;
    }
    noFloor.value = false;
    target.value = { x: preview.x, y: preview.y, z: preview.z };
    smoke.value = preview.dx ? preview : null;
  } catch (error) {
    if (token === previewToken) {
      smoke.value = null;
    }
    console.error("[utility] discover smoke preview error:", error);
  } finally {
    if (token === previewToken) {
      previewing.value = false;
    }
  }
}

function setTarget(point: Point, debounce: boolean) {
  target.value = { x: point.x, y: point.y, z: pickZ.value };
  smoke.value = null;
  if (previewTimer) {
    clearTimeout(previewTimer);
  }
  if (!debounce) {
    void measure(target.value);
    return;
  }
  previewTimer = setTimeout(() => {
    if (target.value) {
      void measure(target.value);
    }
  }, 300);
}

function placeArea(centre: Point) {
  const side = corners.value
    ? {
        x: Math.abs(corners.value.b.x - corners.value.a.x),
        y: Math.abs(corners.value.b.y - corners.value.a.y),
      }
    : { x: DEFAULT_AREA_SIDE, y: DEFAULT_AREA_SIDE };
  corners.value = {
    a: { x: centre.x - side.x / 2, y: centre.y - side.y / 2, z: pickZ.value },
    b: { x: centre.x + side.x / 2, y: centre.y + side.y / 2, z: pickZ.value },
  };
}

// A corner dragged further than the search takes from the other one is held
// at that distance rather than refused.
function moveCorner(key: "a" | "b", point: Point) {
  if (!corners.value) {
    return;
  }
  const other = corners.value[key === "a" ? "b" : "a"];
  const clamp = (value: number, from: number) =>
    Math.min(from + MAX_AREA_SIDE, Math.max(from - MAX_AREA_SIDE, value));
  corners.value = {
    ...corners.value,
    [key]: {
      x: clamp(point.x, other.x),
      y: clamp(point.y, other.y),
      z: pickZ.value,
    },
  };
}

function onPick(point: Point) {
  if (pickMode.value === "landing") {
    setTarget(point, false);
    if (!corners.value) {
      pickMode.value = "area";
    }
    return;
  }
  placeArea(point);
}

function onMarkerGrab(key: string) {
  if (key === "landing") {
    pickMode.value = "landing";
  } else if (key === "area-a" || key === "area-b") {
    pickMode.value = "area";
  }
}

function onMarkerDrag(key: string, point: Point) {
  if (key === "landing") {
    setTarget(point, true);
  } else if (key === "area-a") {
    moveCorner("a", point);
  } else if (key === "area-b") {
    moveCorner("b", point);
  }
}

const techniques = computed<UtilityDiscoveryTechnique[]>(() => {
  const out: UtilityDiscoveryTechnique[] = [];
  if (standing.value) {
    out.push({ direction: null, gait: null, jump_throw: false });
  }
  if (jumpThrow.value) {
    out.push({ direction: null, gait: null, jump_throw: true });
  }
  for (const direction of directions.value) {
    out.push({ direction, gait: gait.value, jump_throw: movingJump.value });
  }
  return out;
});

function toggleDirection(direction: UtilityDiscoveryDirection) {
  directions.value = directions.value.includes(direction)
    ? directions.value.filter((entry) => entry !== direction)
    : [...directions.value, direction];
}

function toggleStrength(strength: UtilityThrowStrength) {
  strengths.value = strengths.value.includes(strength)
    ? strengths.value.filter((entry) => entry !== strength)
    : [...strengths.value, strength];
}

const canSubmit = computed(
  () =>
    !!target.value &&
    !noFloor.value &&
    !previewing.value &&
    !!corners.value &&
    techniques.value.length > 0 &&
    strengths.value.length > 0,
);

async function submit() {
  if (!canSubmit.value || !target.value || !corners.value) {
    return;
  }
  submitting.value = true;
  try {
    const { a, b } = corners.value;
    const { data } = await getGraphqlClient().mutate({
      mutation: discoverUtilityLineupsMutation,
      variables: {
        map_name: props.mapName,
        target_x: target.value.x,
        target_y: target.value.y,
        target_z: target.value.z,
        radius: Number(radius.value),
        area: {
          min_x: Math.min(a.x, b.x),
          min_y: Math.min(a.y, b.y),
          min_z: pickZ.value - AREA_BAND,
          max_x: Math.max(a.x, b.x),
          max_y: Math.max(a.y, b.y),
          max_z: pickZ.value + AREA_BAND,
        },
        techniques: techniques.value,
        strengths: strengths.value,
      },
    });
    const answer = (data as any)?.discoverUtilityLineups as {
      discovery_id: string | null;
      status: string;
      predicted: number;
      message: string | null;
    } | null;
    if (!answer?.discovery_id) {
      return;
    }
    if (answer.status === "Failed" || answer.predicted === 0) {
      toast({
        title: t("pages.utility.discover.nothing_found"),
        description: answer.message ?? undefined,
        variant: answer.status === "Failed" ? "destructive" : "default",
      });
    }
    open(answer.discovery_id);
  } catch (error) {
    toast({
      title: t("pages.utility.discover.failed"),
      description: (error as Error)?.message,
      variant: "destructive",
    });
  } finally {
    submitting.value = false;
  }
}

const discovery = ref<UtilityDiscovery | null>(null);
const loadingDiscovery = ref(false);
let discoverySub: { unsubscribe(): void } | null = null;

function fillFrom(found: UtilityDiscovery) {
  if (target.value) {
    return;
  }
  target.value = { x: found.target_x, y: found.target_y, z: found.target_z };
  void measure(target.value);
  corners.value = {
    a: { x: found.area.min.x, y: found.area.min.y, z: pickZ.value },
    b: { x: found.area.max.x, y: found.area.max.y, z: pickZ.value },
  };
  radius.value =
    RADII.find((entry) => entry.value >= found.radius)?.key ?? radius.value;
  strengths.value = found.strengths.length ? [...found.strengths] : ["Full"];
  standing.value = found.techniques.some(
    (entry) => !entry.direction && !entry.jump_throw,
  );
  jumpThrow.value = found.techniques.some(
    (entry) => !entry.direction && entry.jump_throw,
  );
  const moving = found.techniques.filter((entry) => entry.direction);
  directions.value = moving.map((entry) => entry.direction!);
  if (moving.length) {
    gait.value = moving[0].gait ?? "run";
    movingJump.value = moving[0].jump_throw;
  }
}

watch(
  openId,
  (id) => {
    discoverySub?.unsubscribe();
    discoverySub = null;
    discovery.value = null;
    selectedId.value = null;
    if (!id) {
      return;
    }
    loadingDiscovery.value = true;
    discoverySub = getGraphqlClient()
      .subscribe({
        query: utilityDiscoverySubscription,
        variables: { id },
        context: UTILITY_DISCOVERY_OPTIONAL,
      })
      .subscribe({
        next: ({ data }) => {
          loadingDiscovery.value = false;
          const found = (data as any)?.utility_discoveries_by_pk as
            | UtilityDiscovery
            | null;
          discovery.value = found ?? null;
          if (found) {
            fillFrom(found);
          }
        },
        error: (error) => {
          loadingDiscovery.value = false;
          console.error("[utility] discovery subscription error:", error);
        },
      });
  },
  { immediate: true },
);

const recent = ref<UtilityDiscoverySummary[]>([]);
let recentSub: { unsubscribe(): void } | null = null;

watch(
  [() => props.mapName, mySteamId],
  ([map, steamId]) => {
    recentSub?.unsubscribe();
    recentSub = null;
    recent.value = [];
    if (!steamId) {
      return;
    }
    recentSub = getGraphqlClient()
      .subscribe({
        query: myUtilityDiscoveriesSubscription,
        variables: { map, steamId },
        context: UTILITY_DISCOVERY_OPTIONAL,
      })
      .subscribe({
        next: ({ data }) => {
          recent.value = ((data as any)?.utility_discoveries ??
            []) as UtilityDiscoverySummary[];
        },
        error: (error) => {
          console.error("[utility] recent discoveries error:", error);
        },
      });
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  discoverySub?.unsubscribe();
  recentSub?.unsubscribe();
  if (previewTimer) {
    clearTimeout(previewTimer);
  }
});

const active = computed(
  () => !!discovery.value && ACTIVE.includes(discovery.value.status),
);

async function cancel() {
  if (!discovery.value) {
    return;
  }
  try {
    await getGraphqlClient().mutate({
      mutation: cancelUtilityDiscoveryMutation,
      variables: { discovery_id: discovery.value.id },
    });
  } catch (error) {
    toast({
      title: (error as Error)?.message,
      variant: "destructive",
    });
  }
}

const results = computed(() => {
  const rows = discovery.value?.results ?? [];
  const order = { verified: 0, predicted: 1, missed: 2 } as const;
  return rows
    .filter((row) => row.status !== "missed")
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        ease(a).rank - ease(b).rank ||
        a.rank - b.rank,
    );
});

const missedCount = computed(
  () =>
    (discovery.value?.results ?? []).filter((row) => row.status === "missed")
      .length,
);


// How far the landing moves for a quarter of a degree of aim error either
// way. Measured on the server once landed, predicted until then.
function ease(row: UtilityDiscoveryResult): {
  key: "easy" | "medium" | "hard" | "unknown";
  rank: number;
} {
  const spread =
    row.status === "verified" ? row.forgiveness : row.predicted_spread;
  if (spread === null || spread === undefined || spread < 0 || spread >= 9999) {
    return { key: "unknown", rank: 3 };
  }
  if (spread <= 32) {
    return { key: "easy", rank: 0 };
  }
  if (spread <= 96) {
    return { key: "medium", rank: 1 };
  }
  return { key: "hard", rank: 2 };
}

function landing(row: UtilityDiscoveryResult): Point {
  return row.status === "verified" && row.land_x !== null
    ? { x: row.land_x, y: row.land_y!, z: row.land_z! }
    : {
        x: row.predicted_land_x,
        y: row.predicted_land_y,
        z: row.predicted_land_z,
      };
}

function keys(row: UtilityDiscoveryResult): string | null {
  if (!row.move_direction) {
    return null;
  }
  const keycap =
    DIRECTIONS.find((entry) => entry.key === row.move_direction)?.keycap ?? "";
  return row.move_gait === "walk" ? `Shift + ${keycap}` : keycap;
}

const saveName = ref("");
const saveSide = ref<UtilitySide>("TERRORIST");

watch(selectedId, () => {
  saveName.value = "";
});

async function save(row: UtilityDiscoveryResult) {
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: saveUtilityDiscoveryResultMutation,
      variables: {
        result_id: row.id,
        name: saveName.value.trim(),
        side: saveSide.value,
      },
    });
    const id = (data as any)?.saveUtilityDiscoveryResult?.lineup_id as
      | string
      | undefined;
    if (id) {
      toast({ title: t("pages.utility.discover.saved") });
    }
  } catch (error) {
    toast({
      title: (error as Error)?.message,
      variant: "destructive",
    });
  }
}

function draft(row: UtilityDiscoveryResult) {
  return {
    map_name: props.mapName,
    utility_type: "Smoke",
    side: saveSide.value,
    technique: row.technique,
    throw_strength: row.strength,
    origin: { x: row.stand_x, y: row.stand_y, z: row.stand_z },
    landing: landing(row),
    view_yaw: row.yaw,
    view_pitch: row.pitch,
  };
}

function startOver() {
  back();
}

const resultLineups = computed<UtilityLineup[]>(() =>
  results.value.map((row) => {
    const land = landing(row);
    return {
      id: row.id,
      map_name: props.mapName,
      utility_type: "Smoke",
      side: saveSide.value,
      technique: row.technique,
      throw_strength: row.strength,
      origin_x: row.stand_x,
      origin_y: row.stand_y,
      origin_z: row.stand_z,
      eye_z: row.eye_z,
      view_yaw: row.yaw,
      view_pitch: row.pitch,
      land_x: land.x,
      land_y: land.y,
      land_z: land.z,
      trajectory_preview: row.path?.length
        ? row.path.map(
            (point) => [point.x, point.y, point.z] as [number, number, number],
          )
        : null,
    } as unknown as UtilityLineup;
  }),
);

function ring(centre: Point, r: number, steps = 40): UtilityTrajectoryPoint[] {
  const out: UtilityTrajectoryPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    out.push({
      x: centre.x + Math.cos(angle) * r,
      y: centre.y + Math.sin(angle) * r,
      z: centre.z,
    });
  }
  return out;
}

const footprint = computed<UtilityTrajectoryPoint[][] | null>(() => {
  const preview = smoke.value;
  const at = target.value;
  if (!preview || !at || !preview.dx || !preview.dy || !preview.dz) {
    return null;
  }
  const decoded = decodeSmokeVolume({
    start_tick: 0,
    ox: preview.ox!,
    oy: preview.oy!,
    oz: preview.oz!,
    vs: preview.vs!,
    dx: preview.dx,
    dy: preview.dy,
    dz: preview.dz,
    den: preview.den ?? undefined,
  });
  if (!decoded) {
    return null;
  }
  const up = upsampleFootprint(
    decoded,
    smokeFootprint(decoded),
    SMOKE_UPSAMPLE,
  );
  const loops = traceContour(up.view, up.mask, 0.4);
  return loops.length
    ? loops.map((loop) => loop.map((point) => ({ ...point, z: at.z })))
    : null;
});

const shapes = computed<UtilityBoardShape[]>(() => {
  const out: UtilityBoardShape[] = [];
  if (corners.value) {
    const { a, b } = corners.value;
    out.push({
      key: "area",
      color: AREA_COLOR,
      fillOpacity: 0.06,
      dashed: true,
      rings: [
        [
          { x: a.x, y: a.y, z: pickZ.value },
          { x: b.x, y: a.y, z: pickZ.value },
          { x: b.x, y: b.y, z: pickZ.value },
          { x: a.x, y: b.y, z: pickZ.value },
        ],
      ],
    });
  }
  if (target.value && !noFloor.value) {
    out.push({
      key: "smoke",
      color: SMOKE_COLOR,
      fillOpacity: footprint.value ? 0.22 : 0.08,
      dashed: !footprint.value,
      rings: footprint.value ?? [ring(target.value, SMOKE_RADIUS)],
    });
    out.push({
      key: "radius",
      color: "#e6ebf5",
      fillOpacity: 0,
      dashed: true,
      rings: [ring(target.value, Number(radius.value), 24)],
    });
  }
  return out;
});

const markers = computed<UtilityBoardMarker[]>(() => {
  const out: UtilityBoardMarker[] = [];
  const editing = !openId.value;
  if (target.value) {
    out.push({
      key: "landing",
      point: target.value,
      color: noFloor.value ? "#ef4444" : SMOKE_COLOR,
      label: t("pages.utility.discover.landing_short"),
      draggable: editing,
    });
  }
  if (corners.value && editing) {
    out.push(
      {
        key: "area-a",
        point: corners.value.a,
        color: AREA_COLOR,
        shape: "cross",
        draggable: true,
      },
      {
        key: "area-b",
        point: corners.value.b,
        color: AREA_COLOR,
        shape: "cross",
        draggable: true,
      },
    );
  }
  return out;
});

watch(
  [openId, pickZ, markers, shapes, resultLineups, selectedId, hoveredId],
  () => {
    const browsing = !!openId.value;
    emit("board", {
      picking: !browsing,
      pickZ: pickZ.value,
      markers: markers.value,
      shapes: shapes.value,
      lineups: browsing ? resultLineups.value : [],
      selectedId: selectedId.value,
      hoveredId: hoveredId.value,
      peek: false,
      onPick,
      onMarkerGrab,
      onMarkerDrag,
      onSelect: (id) => {
        selectedId.value = id;
      },
      onHover: (id) => {
        hoveredId.value = id;
      },
    });
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- ============================ ONE SEARCH ============================ -->
    <template v-if="openId">
      <div class="flex items-center gap-2">
        <Button
          size="icon-sm"
          variant="ghost"
          :title="$t('pages.utility.discover.new_search')"
          @click="startOver()"
        >
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 text-sm font-medium">
            <span
              v-if="active"
              class="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-[hsl(var(--tac-amber))]"
            />
            {{
              discovery
                ? $t(`pages.utility.discover.status.${discovery.status}`)
                : $t("pages.utility.discover.loading")
            }}
          </div>
          <div
            v-if="discovery"
            class="font-mono text-[0.65rem] tabular-nums text-muted-foreground"
          >
            {{
              $t("pages.utility.discover.progress", {
                verified: discovery.verified,
                missed: discovery.missed,
                predicted: discovery.predicted,
              })
            }}
          </div>
        </div>
        <Button
          v-if="active"
          size="sm"
          variant="outline"
          @click="cancel()"
        >
          {{ $t("pages.utility.discover.cancel") }}
        </Button>
      </div>

      <p
        v-if="discovery?.status === 'Failed' && discovery.error"
        class="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
      >
        {{ discovery.error }}
      </p>

      <p
        v-if="
          discovery &&
          !active &&
          discovery.status !== 'Failed' &&
          results.length === 0
        "
        class="text-xs leading-snug text-muted-foreground"
      >
        {{ $t("pages.utility.discover.nothing_found") }}
      </p>

      <ul v-if="results.length" class="flex flex-col gap-1.5">
        <li
          v-for="(row, index) of results"
          :key="row.id"
          class="rounded-md border transition-colors"
          :class="
            selectedId === row.id
              ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.06)]'
              : 'border-border/70 hover:border-border'
          "
          @mouseenter="hoveredId = row.id"
          @mouseleave="hoveredId = null"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
            @click="selectedId = selectedId === row.id ? null : row.id"
          >
            <span
              class="w-5 shrink-0 text-center font-mono text-[0.7rem] tabular-nums text-muted-foreground"
            >
              {{ index + 1 }}
            </span>
            <UtilityTechniqueIcon
              :technique="row.technique"
              class="size-6 shrink-0"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 text-xs font-medium">
                <span class="truncate">
                  {{ $t(`pages.utility.techniques.${row.technique}`) }}
                </span>
                <span
                  v-if="keys(row)"
                  class="shrink-0 rounded border border-border px-1 font-mono text-[0.6rem] text-muted-foreground"
                >
                  {{ $t("pages.utility.discover.hold_keys", { keys: keys(row) }) }}
                </span>
                <FiveStackToolTip v-if="!row.measured" :size="14">
                  <template #trigger>
                    <AlertTriangle
                      class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
                    />
                  </template>
                  {{ $t("pages.utility.discover.unmeasured_tip") }}
                </FiveStackToolTip>
              </div>
              <div
                class="flex items-center gap-1.5 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
              >
                <span>{{
                  $t(`pages.utility.discover.ease.${ease(row).key}`)
                }}</span>
                <span>·</span>
                <span>{{
                  $t("pages.utility.discover.distance", {
                    distance: Math.round(
                      row.status === "verified"
                        ? (row.distance ?? 0)
                        : row.predicted_distance,
                    ),
                  })
                }}</span>
              </div>
            </div>
            <UtilityThrowIcon
              :strength="row.strength"
              :label="
                $t(
                  `pages.utility.throw_buttons.${utilityThrowButtonsKey(row.strength)}`,
                )
              "
              class="h-5 w-[0.875rem] shrink-0"
            />
            <span
              v-if="row.is_new"
              class="shrink-0 rounded-full bg-[hsl(var(--tac-amber)/0.15)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-[hsl(var(--tac-amber))]"
              :title="$t('pages.utility.discover.new_tip')"
            >
              {{ $t("pages.utility.discover.new") }}
            </span>
            <span
              class="shrink-0 rounded-full border px-1.5 py-0.5 text-[0.6rem] font-medium"
              :class="
                row.status === 'verified'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : 'border-dashed border-border text-muted-foreground'
              "
            >
              {{ $t(`pages.utility.discover.result_status.${row.status}`) }}
            </span>
          </button>

          <div
            v-if="selectedId === row.id"
            class="flex flex-col gap-2 border-t border-border/60 px-2.5 py-2"
          >
            <div
              class="font-mono text-[0.6rem] tabular-nums text-muted-foreground"
            >
              {{
                $t("pages.utility.discover.aim", {
                  yaw: row.yaw.toFixed(2),
                  pitch: row.pitch.toFixed(2),
                })
              }}
            </div>

            <template v-if="row.status === 'verified'">
              <Button
                v-if="row.utility_lineup_id"
                size="sm"
                variant="outline"
                @click="emit('open-lineup', row.utility_lineup_id)"
              >
                {{ $t("pages.utility.discover.open_lineup") }}
              </Button>
              <template v-else>
                <UtilitySegmented
                  v-model="saveSide"
                  even
                  :options="
                    UTILITY_SIDES.map((entry) => ({
                      key: entry,
                      label: $t(`pages.utility.sides.${entry}`),
                    }))
                  "
                />
                <Input
                  v-model="saveName"
                  class="h-8 text-xs"
                  maxlength="120"
                  :placeholder="$t('pages.utility.discover.save_name')"
                />
                <div class="flex gap-2">
                  <UtilityPracticeButton
                    v-if="canPractice"
                    :draft="draft(row)"
                    :map-name="mapName"
                    :label="$t('pages.utility.load.test')"
                    size="sm"
                    variant="outline"
                  />
                  <Button
                    size="sm"
                    class="tac-amber-cta flex-1"
                    @click="save(row)"
                  >
                    {{ $t("pages.utility.discover.save") }}
                  </Button>
                </div>
              </template>
            </template>
            <p v-else class="text-[0.65rem] leading-snug text-muted-foreground">
              {{ $t("pages.utility.discover.predicted_note") }}
            </p>
          </div>
        </li>
      </ul>

      <p
        v-if="missedCount"
        class="font-mono text-[0.6rem] tabular-nums text-muted-foreground"
      >
        {{ $t("pages.utility.discover.missed_count", { count: missedCount }) }}
      </p>

      <Button variant="outline" size="sm" @click="startOver()">
        {{ $t("pages.utility.discover.new_search") }}
      </Button>
    </template>

    <!-- ============================ THE ASK ============================ -->
    <template v-else>
      <p class="text-xs leading-snug text-muted-foreground">
        {{ $t("pages.utility.discover.intro") }}
      </p>

      <div
        class="grid grid-cols-2 overflow-hidden rounded-md border border-border"
      >
        <button
          v-for="(step, index) of (['landing', 'area'] as const)"
          :key="step"
          type="button"
          class="flex items-center justify-center gap-1.5 px-2 py-2 text-xs transition-colors"
          :class="[
            index > 0 ? 'border-l border-border' : '',
            pickMode === step
              ? 'bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
          ]"
          @click="pickMode = step"
        >
          <component
            :is="step === 'landing' ? MapPin : Square"
            class="h-3.5 w-3.5"
          />
          {{ $t(`pages.utility.discover.step_${step}`) }}
          <span
            v-if="step === 'landing' ? !!target : !!corners"
            class="h-1.5 w-1.5 rounded-full bg-emerald-400"
          />
        </button>
      </div>

      <p class="flex items-start gap-1.5 text-[0.7rem] leading-snug">
        <Crosshair class="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
        <span v-if="pickMode === 'landing' && noFloor" class="text-destructive">
          {{ $t("pages.utility.discover.no_floor") }}
        </span>
        <span v-else-if="pickMode === 'landing' && previewing">
          {{ $t("pages.utility.discover.previewing") }}
        </span>
        <span v-else class="text-muted-foreground">
          {{ $t(`pages.utility.discover.pick_${pickMode}`) }}
        </span>
      </p>

      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.discover.radius") }}
        </label>
        <UtilitySegmented
          v-model="radius"
          even
          :options="
            RADII.map((entry) => ({
              key: entry.key,
              label: $t(`pages.utility.discover.radius_${entry.label}`, {
                units: entry.value,
              }),
            }))
          "
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.discover.ways") }}
        </label>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="way of ([
              { key: 'standing', technique: 'Stationary', on: standing },
              { key: 'jump_throw', technique: 'Jump', on: jumpThrow },
            ] as const)"
            :key="way.key"
            type="button"
            :aria-pressed="way.on"
            class="flex h-11 items-center justify-center gap-2 rounded-md border text-xs font-medium transition-colors"
            :class="
              way.on
                ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                : 'border-border/70 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground'
            "
            @click="
              way.key === 'standing'
                ? (standing = !standing)
                : (jumpThrow = !jumpThrow)
            "
          >
            <UtilityTechniqueIcon :technique="way.technique" class="size-6" />
            {{ $t(`pages.utility.discover.${way.key}`) }}
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="text-[0.7rem] text-muted-foreground">
            {{ $t("pages.utility.discover.moving") }}
          </span>
          <FiveStackToolTip :size="14">
            <template #trigger>
              <AlertTriangle
                class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
              />
            </template>
            {{ $t("pages.utility.discover.unmeasured_tip") }}
          </FiveStackToolTip>
        </div>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="direction of DIRECTIONS"
            :key="direction.key"
            type="button"
            :aria-pressed="directions.includes(direction.key)"
            class="flex h-10 flex-col items-center justify-center rounded-md border text-[0.65rem] leading-tight transition-colors"
            :class="
              directions.includes(direction.key)
                ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                : 'border-border/70 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground'
            "
            @click="toggleDirection(direction.key)"
          >
            <span class="font-mono text-sm font-semibold">
              {{ direction.keycap }}
            </span>
            {{ $t(`pages.utility.discover.direction.${direction.key}`) }}
          </button>
        </div>
        <div v-if="directions.length" class="flex items-center gap-2">
          <UtilitySegmented
            v-model="gait"
            even
            class="flex-1"
            :options="[
              { key: 'walk', label: $t('pages.utility.discover.walk') },
              { key: 'run', label: $t('pages.utility.discover.run') },
            ]"
          />
          <button
            type="button"
            :aria-pressed="movingJump"
            class="h-8 shrink-0 rounded-md border px-2 text-[0.7rem] transition-colors"
            :class="
              movingJump
                ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                : 'border-border/70 text-muted-foreground hover:text-foreground'
            "
            @click="movingJump = !movingJump"
          >
            {{ $t("pages.utility.discover.with_jump") }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.throw_strength") }}
        </label>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="strength of UTILITY_THROW_STRENGTHS"
            :key="strength"
            type="button"
            :aria-pressed="strengths.includes(strength)"
            class="flex h-[3.25rem] flex-col items-center justify-center gap-1 rounded-md border text-[0.68rem] font-medium transition-colors"
            :class="
              strengths.includes(strength)
                ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                : 'border-border/70 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground'
            "
            @click="toggleStrength(strength)"
          >
            <UtilityThrowIcon
              :strength="strength"
              class="h-5 w-[0.875rem] shrink-0"
            />
            {{
              $t(`pages.utility.throw_buttons.${utilityThrowButtonsKey(strength)}`)
            }}
          </button>
        </div>
      </div>

      <Button
        class="tac-amber-cta"
        :disabled="!canSubmit"
        :loading="submitting"
        @click="submit()"
      >
        <Telescope class="mr-1.5 h-4 w-4" />
        {{ $t("pages.utility.discover.submit") }}
      </Button>

      <div v-if="recent.length" class="flex flex-col gap-1">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.discover.recent") }}
        </span>
        <button
          v-for="entry of recent"
          :key="entry.id"
          type="button"
          class="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-left text-xs hover:border-border hover:bg-muted/30"
          @click="open(entry.id)"
        >
          <Sparkles
            v-if="entry.verified > 0"
            class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
          />
          <span class="min-w-0 flex-1 truncate">
            {{ $t(`pages.utility.discover.status.${entry.status}`) }}
            <span class="font-mono tabular-nums text-muted-foreground">
              ·
              {{
                $t("pages.utility.discover.recent_counts", {
                  verified: entry.verified,
                  predicted: entry.predicted,
                })
              }}
            </span>
          </span>
          <TimeAgo
            :date="entry.created_at"
            hide-icon
            class="shrink-0 text-[0.65rem] text-muted-foreground"
          />
        </button>
      </div>
    </template>
  </div>
</template>
