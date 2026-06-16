<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card, CardContent } from "~/components/ui/card";
import { Empty, EmptyTitle, EmptyDescription } from "~/components/ui/empty";
import MatchSideFilter from "~/components/match/MatchSideFilter.vue";
import { useMatchSide } from "~/composables/useMatchSide";
import cleanMapName from "~/utilities/cleanMapName";
import { hasMeshForMap } from "~/utilities/mapAssets";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalFilterPillClasses,
  tacticalFilterPillActiveClasses,
} from "~/utilities/tacticalClasses";
import {
  fetchReplayBlob,
  normalizeBlobGrenades,
} from "~/composables/useReplayBlob";
import { matchHeatmapQuery } from "~/graphql/matchHeatmapGraphql";
import { matchMovementMapQuery } from "~/graphql/matchMovementPathsGraphql";
import RoundSelector from "~/components/match/RoundSelector.vue";

type MapSplit = {
  bounds: { top: number; bottom: number };
  offset: { x: number; y: number };
};
type RadarMeta = {
  resolution: number;
  offset: { x: number; y: number };
  splits?: MapSplit[];
};

type DotCategory = "kills" | "deaths" | "utility" | "util_damage";

type Dot = {
  category: DotCategory;
  steamId: string;
  round: number;
  utilityType: string | null;
  weight: number;
  x: number;
  y: number;
};

type Position = {
  round: number;
  tick: number;
  attacker_steam_id: string;
  attacker_team: "ct" | "t" | string | null;
  alive: boolean;
  x: number;
  y: number;
  z: number;
};

type RoundTick = {
  round: number;
  start_tick: number;
  end_tick: number;
  freeze_end_tick?: number;
};

type Path = {
  round: number;
  steamId: string;
  side: "ct" | "t" | string;
  points: { x: number; y: number }[];
};

const props = defineProps<{
  match: any;
  selectedMapId?: string | null;
}>();

const { t } = useI18n();
const side = useMatchSide();
const { client } = useApolloClient();

const CANVAS = 1024;
const RADAR_PX = 1024;

const KILL_COLOR = "#fbbf24";
const DEATH_COLOR = "rgb(239, 68, 68)";
const UTILITY_COLOR = "#38bdf8";
const UTIL_DAMAGE_COLOR = "rgb(249, 115, 22)";
const CT_COLOR = "#38bdf8";
const T_COLOR = "hsl(30, 100%, 55%)";
const MAX_POINTS = 12000;

const GRENADE_TYPE_BY_WEAPON: Record<string, string> = {
  hegrenade: "HighExplosive",
  molotov: "Molotov",
  inferno: "Molotov",
  incgrenade: "Molotov",
};

const UTILITY_TYPES = [
  { value: "HighExplosive", color: "rgb(239, 68, 68)" },
  { value: "Molotov", color: "rgb(249, 115, 22)" },
  { value: "Smoke", color: "rgb(148, 163, 184)" },
  { value: "Flash", color: "rgb(250, 204, 21)" },
  { value: "Decoy", color: "#38bdf8" },
] as const;

const WINDOW_OPTIONS = [10, 20, 30, 45];

const mode = ref<"heatmap" | "movement">("heatmap");
const renderStyle = ref<"heat" | "dots">("dots");

const calibrations = ref<Record<string, RadarMeta> | null>(null);
const radarFailed = ref(false);
const selectedMapId = ref<string | null>(null);

const selectedSteamId = ref<string>("all");
const selectedRound = ref<number | null>(null);

const loadedHeatmapMatchId = ref<string | null>(null);
const rawUtility = ref<any[]>([]);
const rawKills = ref<any[]>([]);
const rawDamages = ref<any[]>([]);

const blobLoading = ref(false);
const loadedDemoMapId = ref<string | null>(null);
const positions = ref<Position[]>([]);
const roundTicks = ref<RoundTick[]>([]);
const grenades = ref<any[]>([]);
const tickRate = ref(64);

// Throw→detonation trajectory lines (heatmap mode). Opt-in: loads the playback
// blob (the throw origin lives there, not in the DB) only when toggled on.
const showTrajectories = ref(false);

const activeLayer = ref<DotCategory>("utility");
const activeUtilityTypes = ref<Set<string>>(
  new Set(UTILITY_TYPES.map((u) => u.value)),
);

const sideFilter = ref<"both" | "ct" | "t">("both");
const teamFilter = ref<"all" | "lineup_1" | "lineup_2">("all");
const windowSeconds = ref<number>(30);

const matchMaps = computed<any[]>(() => props.match?.match_maps ?? []);

watch(
  () => props.selectedMapId,
  (value) => {
    if (value) {
      selectedMapId.value = value;
    }
  },
  { immediate: true },
);

watch(
  matchMaps,
  (maps) => {
    if (!maps.length) {
      selectedMapId.value = null;
      return;
    }
    const ids = maps.map((m) => m.id);
    if (!selectedMapId.value || !ids.includes(selectedMapId.value)) {
      selectedMapId.value = props.selectedMapId ?? ids[0];
    }
  },
  { immediate: true },
);

const activeMatchMap = computed<any | null>(() => {
  if (!matchMaps.value.length) {
    return null;
  }
  return (
    matchMaps.value.find((m) => m.id === selectedMapId.value) ??
    matchMaps.value[0]
  );
});

// Hide the map dropdown when there's nothing to switch between: a single map,
// or a map already chosen from the left-side match cards (passed via prop).
const showMapSelector = computed(
  () => matchMaps.value.length > 1 && !props.selectedMapId,
);

// The 2D replay lives in its own popout window (same launcher MatchMaps uses);
// from the analysis view we just point the operator at it for the active map.
// Gated on parsed demo metadata, since the replay needs position ticks.
const canOpen2dPlayback = computed(() =>
  (activeMatchMap.value?.demos ?? []).some(
    (d: any) => !!d.metadata_parsed_at && !!d.total_ticks,
  ),
);

function open2dPlayback() {
  const mapId = activeMatchMap.value?.id;
  if (!mapId) {
    return;
  }
  const popup = window.open(
    `/match-replay-popout/${mapId}`,
    `replay-popout-${mapId}`,
    "popup=yes,width=1100,height=900,resizable=yes,scrollbars=yes",
  );
  if (popup) {
    popup.focus();
  }
}

function open3dPlayback() {
  const mapId = activeMatchMap.value?.id;
  if (!mapId) {
    return;
  }
  const w = Math.min(1760, screen.availWidth);
  const h = Math.min(1040, screen.availHeight);
  const left = Math.max(0, (screen.availWidth - w) / 2);
  const top = Math.max(0, (screen.availHeight - h) / 2);
  const popup = window.open(
    `/match-3d-replay/${mapId}`,
    `replay-3d-${mapId}`,
    `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );
  if (popup) {
    popup.focus();
  }
}

const normalizedMap = computed(() =>
  (activeMatchMap.value?.map?.name || "")
    .trim()
    .toLowerCase()
    .replace(/_night$/, ""),
);

const calibration = computed<RadarMeta | null>(() => {
  if (!calibrations.value || !normalizedMap.value) {
    return null;
  }
  return calibrations.value[normalizedMap.value] ?? null;
});

const radarSrc = computed(() => {
  if (!calibration.value || !normalizedMap.value || radarFailed.value) {
    return null;
  }
  return `/radars/${normalizedMap.value}.png`;
});

const has2dRadar = computed(() =>
  calibrations.value === null ? true : !!calibration.value,
);

const has3dMesh = ref(true);
watch(
  () => activeMatchMap.value?.map?.name,
  async (name) => {
    if (!import.meta.client) {
      return;
    }
    if (!name) {
      has3dMesh.value = false;
      return;
    }
    has3dMesh.value = await hasMeshForMap(
      useRuntimeConfig().public.mapMeshCdn as string,
      name,
    );
  },
  { immediate: true },
);

onMounted(async () => {
  try {
    const res = await fetch("/radars/metadata.json");
    if (res.ok) {
      const data = await res.json();
      const { _comment, ...rest } = data;
      calibrations.value = rest as Record<string, RadarMeta>;
    }
  } catch {
    /* */
  }
});

async function loadHeatmap() {
  const matchId = props.match?.id;
  if (!matchId || matchId === loadedHeatmapMatchId.value) {
    return;
  }
  const { data } = await client.query({
    query: matchHeatmapQuery,
    variables: { matchId },
    fetchPolicy: "cache-first",
  });
  rawUtility.value = (data?.player_utility ?? []) as any[];
  rawKills.value = (data?.player_kills ?? []) as any[];
  rawDamages.value = (data?.player_damages ?? []) as any[];
  loadedHeatmapMatchId.value = matchId;
}

let loadGen = 0;

async function loadBlob() {
  const mapId = activeMatchMap.value?.id;
  if (!mapId) {
    positions.value = [];
    roundTicks.value = [];
    return;
  }
  if (mapId === loadedDemoMapId.value) {
    return;
  }
  grenades.value = [];
  blobLoading.value = true;
  const gen = ++loadGen;
  try {
    const { data } = await client.query({
      query: matchMovementMapQuery,
      variables: { matchMapId: mapId },
      fetchPolicy: "cache-first",
    });
    if (gen !== loadGen) {
      return;
    }
    const url: string | null =
      (data as any)?.match_maps_by_pk?.demos?.[0]?.playback_url ?? null;
    if (!url) {
      positions.value = [];
      roundTicks.value = [];
      loadedDemoMapId.value = mapId;
      return;
    }
    const blob = await fetchReplayBlob(url);
    if (gen !== loadGen) {
      return;
    }
    positions.value = (blob?.positions ?? []) as Position[];
    roundTicks.value = (blob?.round_ticks ?? []) as RoundTick[];
    grenades.value = normalizeBlobGrenades(blob?.grenade_throws ?? []);
    tickRate.value = blob?.tick_rate || 64;
    loadedDemoMapId.value = mapId;
  } catch {
    if (gen === loadGen) {
      positions.value = [];
      roundTicks.value = [];
    }
  } finally {
    if (gen === loadGen) {
      blobLoading.value = false;
    }
  }
}

watch(
  () => props.match?.id,
  () => {
    void loadHeatmap();
  },
  { immediate: true },
);
// The demo blob is only needed for the movement (paths) view; the heatmap
// reads kill/death/utility coordinates straight from the DB so it never
// downloads the 1-3MB playback file.
watch(
  [() => activeMatchMap.value?.id, mode, showTrajectories],
  () => {
    if (mode.value === "movement") {
      void loadBlob();
    } else if (mode.value === "heatmap" && showTrajectories.value) {
      void loadBlob();
    }
  },
  { immediate: true },
);

function parseCoords(
  value: string | null | undefined,
): { x: number; y: number; z: number } | null {
  if (!value) {
    return null;
  }
  // Kill coords come space-delimited ("1868 -260 261"); utility coords
  // come comma-delimited ("1408.61,990.33,153.35"). Accept either.
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  return { x: parts[0], y: parts[1], z: parts[2] ?? 0 };
}

function applySplit(z: number, splits: MapSplit[] | undefined) {
  if (!splits) {
    return { dx: 0, dy: 0 };
  }
  for (const s of splits) {
    if (z > s.bounds.bottom && z < s.bounds.top) {
      return { dx: s.offset.x, dy: s.offset.y };
    }
  }
  return { dx: 0, dy: 0 };
}

function projectRaw(p: { x: number; y: number; z?: number }) {
  if (!calibration.value) {
    return null;
  }
  const { resolution, offset, splits } = calibration.value;
  const split = applySplit(p.z ?? 0, splits);
  const gameX = p.x + offset.x;
  const gameY = p.y + offset.y;
  const pxX = gameX / resolution + (split.dx / 100) * RADAR_PX;
  const pxYFromBottom = gameY / resolution + (split.dy / 100) * RADAR_PX;
  return {
    x: pxX * (CANVAS / RADAR_PX),
    y: CANVAS - pxYFromBottom * (CANVAS / RADAR_PX),
  };
}

const lineupBySteamId = computed(() => {
  const out = new Map<string, "lineup_1" | "lineup_2">();
  for (const member of props.match?.lineup_1?.lineup_players ?? []) {
    const sid = String(member.steam_id ?? member.player?.steam_id ?? "");
    if (sid) {
      out.set(sid, "lineup_1");
    }
  }
  for (const member of props.match?.lineup_2?.lineup_players ?? []) {
    const sid = String(member.steam_id ?? member.player?.steam_id ?? "");
    if (sid) {
      out.set(sid, "lineup_2");
    }
  }
  return out;
});

const allPlayers = computed(() => {
  const out: { steamId: string; name: string }[] = [];
  const seen = new Set<string>();
  const pools = [props.match?.lineup_1, props.match?.lineup_2].filter(Boolean);
  for (const lp of pools) {
    for (const member of lp.lineup_players ?? []) {
      const sid = String(member.steam_id ?? member.player?.steam_id ?? "");
      if (!sid || seen.has(sid)) {
        continue;
      }
      seen.add(sid);
      out.push({
        steamId: sid,
        name: member.player?.name ?? member.placeholder_name ?? sid,
      });
    }
  }
  return out;
});

const isLineup1 = (steamId: string): boolean => {
  for (const member of props.match?.lineup_1?.lineup_players ?? []) {
    const sid = String(member.steam_id ?? member.player?.steam_id ?? "");
    if (sid === steamId) {
      return true;
    }
  }
  return false;
};

const roundSideByNumber = computed(() => {
  const out = new Map<number, { l1: string | null; l2: string | null }>();
  for (const r of activeMatchMap.value?.rounds ?? []) {
    if (typeof r.round !== "number") {
      continue;
    }
    out.set(r.round, {
      l1: r.lineup_1_side ?? null,
      l2: r.lineup_2_side ?? null,
    });
  }
  return out;
});

function normalizeSide(s: string | null | undefined): string | null {
  if (s === "T") {
    return "TERRORIST";
  }
  return s ?? null;
}

function matchesSide(steamId: string, round: number): boolean {
  if (side.value === "all") {
    return true;
  }
  const sides = roundSideByNumber.value.get(round);
  if (!sides) {
    return true;
  }
  const playerSide = normalizeSide(isLineup1(steamId) ? sides.l1 : sides.l2);
  if (side.value === "CT") {
    return playerSide === "CT";
  }
  return playerSide === "TERRORIST";
}

function passesHeatFilters(steamId: string, round: number): boolean {
  if (selectedSteamId.value !== "all" && selectedSteamId.value !== steamId) {
    return false;
  }
  if (selectedRound.value != null && round !== selectedRound.value) {
    return false;
  }
  if (!matchesSide(steamId, round)) {
    return false;
  }
  return true;
}

// Kill/death dots come straight from the DB. Live matches store the
// attacker/victim world coordinates per kill (space-delimited), so no
// demo download is needed. Old imported demos have empty coords and will
// simply show nothing — we don't backfill.
const killDots = computed<Dot[]>(() => {
  if (!calibration.value || !activeMatchMap.value) {
    return [];
  }
  const mapId = activeMatchMap.value.id;
  const out: Dot[] = [];
  for (const k of rawKills.value) {
    if (k.match_map_id !== mapId) {
      continue;
    }
    const round = typeof k.round === "number" ? k.round : 0;
    const attacker = String(k.attacker_steam_id ?? "");
    const victim = String(k.attacked_steam_id ?? "");
    const aCoords = parseCoords(k.attacker_location_coordinates);
    if (aCoords && attacker) {
      const px = projectRaw(aCoords);
      if (px) {
        out.push({
          category: "kills",
          steamId: attacker,
          round,
          utilityType: null,
          weight: 1,
          x: px.x,
          y: px.y,
        });
      }
    }
    const vCoords = parseCoords(k.attacked_location_coordinates);
    if (vCoords && victim) {
      const px = projectRaw(vCoords);
      if (px) {
        out.push({
          category: "deaths",
          steamId: victim,
          round,
          utilityType: null,
          weight: 1,
          x: px.x,
          y: px.y,
        });
      }
    }
  }
  return out;
});

// Utility dots from the DB grenade coordinates (per throw).
const utilityDots = computed<Dot[]>(() => {
  if (!calibration.value || !activeMatchMap.value) {
    return [];
  }
  const mapId = activeMatchMap.value.id;
  const out: Dot[] = [];
  for (const u of rawUtility.value) {
    if (u.match_map_id !== mapId) {
      continue;
    }
    const round = typeof u.round === "number" ? u.round : 0;
    const thrower = String(u.attacker_steam_id ?? "");
    const coords = parseCoords(u.attacker_location_coordinates);
    if (coords && thrower) {
      const px = projectRaw(coords);
      if (px) {
        out.push({
          category: "utility",
          steamId: thrower,
          round,
          utilityType: u.type ?? null,
          weight: 1,
          x: px.x,
          y: px.y,
        });
      }
    }
  }
  return out;
});

// Utility-damage dots come from player_damages (HE/molotov), plotted where the
// victim took the damage and weighted by the damage dealt — this is the
// "utility impact" layer (where grenades actually do work, not just land).
const utilDamageDots = computed<Dot[]>(() => {
  if (!calibration.value || !activeMatchMap.value) {
    return [];
  }
  const mapId = activeMatchMap.value.id;
  const out: Dot[] = [];
  for (const d of rawDamages.value) {
    if (d.match_map_id !== mapId) {
      continue;
    }
    const round = typeof d.round === "number" ? d.round : Number(d.round) || 0;
    const attacker = String(d.attacker_steam_id ?? "");
    const coords = parseCoords(d.attacked_location_coordinates);
    if (!coords) {
      continue;
    }
    const px = projectRaw(coords);
    if (!px) {
      continue;
    }
    out.push({
      category: "util_damage",
      steamId: attacker,
      round,
      utilityType: GRENADE_TYPE_BY_WEAPON[String(d.with ?? "")] ?? null,
      weight: Math.max(1, Number(d.damage ?? 0)),
      x: px.x,
      y: px.y,
    });
  }
  return out;
});

const allDots = computed<Dot[]>(() => [
  ...killDots.value,
  ...utilityDots.value,
  ...utilDamageDots.value,
]);

function canonGrenadeType(type: string | null | undefined): string | null {
  const s = String(type ?? "").toLowerCase();
  if (s.includes("flash")) return "Flash";
  if (s.includes("smoke")) return "Smoke";
  if (s.includes("decoy")) return "Decoy";
  if (
    s.includes("molot") ||
    s.includes("incend") ||
    s.includes("inferno") ||
    s.includes("fire")
  ) {
    return "Molotov";
  }
  if (s.includes("he") || s.includes("explos") || s.includes("frag")) {
    return "HighExplosive";
  }
  return null;
}

// Throw→detonation line segments, paired by grenade_id from the playback blob.
// The throw origin is the "thrown" phase, the landing point the "detonated"
// phase. Respects the same type / player / round / side filters as the dots.
const utilityLines = computed(() => {
  if (!calibration.value || !showTrajectories.value || !grenades.value.length) {
    return [] as Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
    }>;
  }
  const thrown = new Map<number, any>();
  const detonated = new Map<number, any>();
  for (const g of grenades.value) {
    if (g.grenade_id == null) {
      continue;
    }
    if (g.phase === "thrown") {
      thrown.set(g.grenade_id, g);
    } else if (g.phase === "detonated") {
      detonated.set(g.grenade_id, g);
    }
  }
  const out: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
  }> = [];
  for (const [id, t] of thrown.entries()) {
    const d = detonated.get(id);
    if (!d) {
      continue;
    }
    const round = typeof t.round === "number" ? t.round : Number(t.round) || 0;
    const thrower = String(t.thrower_steam_id ?? "");
    const canon = canonGrenadeType(t.type);
    if (canon && !activeUtilityTypes.value.has(canon)) {
      continue;
    }
    if (!passesHeatFilters(thrower, round)) {
      continue;
    }
    const p1 = projectRaw(t);
    const p2 = projectRaw(d);
    if (!p1 || !p2) {
      continue;
    }
    const match = UTILITY_TYPES.find((u) => u.value === canon);
    out.push({
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      color: match ? match.color : UTILITY_COLOR,
    });
  }
  return out;
});

const visibleDots = computed<Dot[]>(() =>
  allDots.value.filter((dot) => {
    if (dot.category !== activeLayer.value) {
      return false;
    }
    if (
      dot.category === "utility" &&
      dot.utilityType &&
      !activeUtilityTypes.value.has(dot.utilityType)
    ) {
      return false;
    }
    return passesHeatFilters(dot.steamId, dot.round);
  }),
);

function dotColor(dot: Dot): string {
  if (dot.category === "kills") {
    return KILL_COLOR;
  }
  if (dot.category === "deaths") {
    return DEATH_COLOR;
  }
  if (dot.category === "util_damage") {
    return UTIL_DAMAGE_COLOR;
  }
  const match = UTILITY_TYPES.find((u) => u.value === dot.utilityType);
  return match ? match.color : UTILITY_COLOR;
}

function layerCount(category: DotCategory): number {
  return allDots.value.filter(
    (dot) =>
      dot.category === category && passesHeatFilters(dot.steamId, dot.round),
  ).length;
}

function utilityTypeCount(value: string): number {
  return allDots.value.filter(
    (dot) =>
      dot.category === "utility" &&
      dot.utilityType === value &&
      passesHeatFilters(dot.steamId, dot.round),
  ).length;
}

// Trajectories only make sense on the utility layer; reset them when the
// active layer changes so the overlay doesn't linger on kills/deaths.
watch(activeLayer, (l) => {
  if (l !== "utility") {
    showTrajectories.value = false;
  }
});

function toggleUtilityType(value: string) {
  const next = new Set(activeUtilityTypes.value);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  activeUtilityTypes.value = next;
}

const layerPills = computed<
  { key: DotCategory; label: string; color: string }[]
>(() => [
  { key: "kills", label: t("match.heatmaps.kills"), color: KILL_COLOR },
  { key: "deaths", label: t("match.heatmaps.deaths"), color: DEATH_COLOR },
  { key: "utility", label: t("match.heatmaps.utility"), color: UTILITY_COLOR },
  {
    key: "util_damage",
    label: t("match.heatmaps.util_damage"),
    color: UTIL_DAMAGE_COLOR,
  },
]);

const renderPills = computed<{ key: "heat" | "dots"; label: string }[]>(() => [
  { key: "heat", label: t("match.heatmaps.render_heat") },
  { key: "dots", label: t("match.heatmaps.render_dots") },
]);

// Heat-mode blob radius: utility damage scales with damage dealt; everything
// else is a fixed kernel. Kept in canvas units (viewBox is 0..CANVAS). Kept
// deliberately tight so clusters stay readable against the map (a 1024 canvas
// renders at ~760px, so these are ~9-18px on screen).
function heatRadius(dot: Dot): number {
  if (dot.category === "util_damage") {
    return Math.min(18, 6 + Math.sqrt(dot.weight) * 1.1);
  }
  return 9;
}

function utilityLabel(value: string): string {
  return t(`match.heatmaps.utility_types.${value}`);
}

const roundWindows = computed(() => {
  const out = new Map<number, { start: number; end: number }>();
  const span = windowSeconds.value * tickRate.value;
  for (const rt of roundTicks.value) {
    if (typeof rt.round !== "number" || rt.round <= 0) {
      continue;
    }
    const start = rt.freeze_end_tick ?? rt.start_tick ?? 0;
    out.set(rt.round, { start, end: start + span });
  }
  return out;
});

const allPathsResult = computed<{ paths: Path[]; capped: boolean }>(() => {
  if (!calibration.value || !roundWindows.value.size) {
    return { paths: [], capped: false };
  }
  const grouped = new Map<string, Position[]>();
  for (const p of positions.value) {
    const window = roundWindows.value.get(p.round);
    if (!window) {
      continue;
    }
    if (p.tick < window.start || p.tick > window.end) {
      continue;
    }
    const sid = String(p.attacker_steam_id ?? "");
    if (!sid) {
      continue;
    }
    const key = `${p.round}:${sid}`;
    const arr = grouped.get(key);
    if (arr) {
      arr.push(p);
    } else {
      grouped.set(key, [p]);
    }
  }

  let total = 0;
  for (const arr of grouped.values()) {
    total += arr.length;
  }
  let stride = 1;
  let capped = false;
  if (total > MAX_POINTS) {
    stride = Math.ceil(total / MAX_POINTS);
    capped = true;
  }

  const out: Path[] = [];
  for (const [key, samples] of grouped.entries()) {
    samples.sort((a, b) => a.tick - b.tick);
    const sliced =
      stride > 1 ? samples.filter((_, i) => i % stride === 0) : samples;
    const points: { x: number; y: number }[] = [];
    for (const s of sliced) {
      const px = projectRaw(s);
      if (px) {
        points.push(px);
      }
    }
    if (points.length < 2) {
      continue;
    }
    const [roundStr, sid] = key.split(":");
    const pathSide = String(samples[0].attacker_team ?? "").toLowerCase();
    out.push({
      round: Number(roundStr),
      steamId: sid,
      side: pathSide,
      points,
    });
  }
  return { paths: out, capped };
});

const allPaths = computed<Path[]>(() => allPathsResult.value.paths);
const capped = computed<boolean>(() => allPathsResult.value.capped);

function passesPathFilters(path: Path): boolean {
  if (sideFilter.value !== "both" && path.side !== sideFilter.value) {
    return false;
  }
  if (teamFilter.value !== "all") {
    if (lineupBySteamId.value.get(path.steamId) !== teamFilter.value) {
      return false;
    }
  }
  if (selectedRound.value != null && path.round !== selectedRound.value) {
    return false;
  }
  return true;
}

const visiblePaths = computed<Path[]>(() =>
  allPaths.value.filter(passesPathFilters),
);

function pathPoints(path: Path): string {
  return path.points.map((p) => `${p.x},${p.y}`).join(" ");
}

function pathColor(path: Path): string {
  if (path.side === "ct") {
    return CT_COLOR;
  }
  if (path.side === "t") {
    return T_COLOR;
  }
  return CT_COLOR;
}

function pathOpacity(path: Path): number {
  if (selectedSteamId.value === "all") {
    return 0.18;
  }
  return path.steamId === selectedSteamId.value ? 0.85 : 0.05;
}

function pathWidth(path: Path): number {
  if (
    selectedSteamId.value !== "all" &&
    path.steamId === selectedSteamId.value
  ) {
    return 3;
  }
  return 2;
}

const visibleRoundCount = computed(() => {
  const rounds = new Set<number>();
  for (const p of visiblePaths.value) {
    rounds.add(p.round);
  }
  return rounds.size;
});

const sidePills = computed<{ key: "both" | "ct" | "t"; label: string }[]>(
  () => [
    { key: "both", label: t("match.movement.side_both") },
    { key: "ct", label: t("match.movement.side_ct") },
    { key: "t", label: t("match.movement.side_t") },
  ],
);

const teamPills = computed<
  { key: "all" | "lineup_1" | "lineup_2"; label: string }[]
>(() => [
  { key: "all", label: t("match.movement.team_all") },
  {
    key: "lineup_1",
    label: props.match?.lineup_1?.name ?? t("match.movement.team_1"),
  },
  {
    key: "lineup_2",
    label: props.match?.lineup_2?.name ?? t("match.movement.team_2"),
  },
]);

const roundsByNumber = computed<Map<number, any>>(() => {
  const out = new Map<number, any>();
  for (const r of activeMatchMap.value?.rounds ?? []) {
    if (typeof r.round === "number" && r.round > 0) {
      out.set(r.round, r);
    }
  }
  return out;
});

const availableRounds = computed<number[]>(() => {
  if (roundsByNumber.value.size) {
    return [...roundsByNumber.value.keys()].sort((a, b) => a - b);
  }
  const rounds = new Set<number>();
  for (const rt of roundTicks.value) {
    if (typeof rt.round === "number" && rt.round > 0) {
      rounds.add(rt.round);
    }
  }
  const mapId = activeMatchMap.value?.id;
  for (const u of rawUtility.value) {
    if (
      u.match_map_id === mapId &&
      typeof u.round === "number" &&
      u.round > 0
    ) {
      rounds.add(u.round);
    }
  }
  return [...rounds].sort((a, b) => a - b);
});

function roundWinnerSide(round: number): "CT" | "T" | null {
  const ws = roundsByNumber.value.get(round)?.winning_side;
  if (ws === "CT") {
    return "CT";
  }
  if (ws === "TERRORIST" || ws === "T") {
    return "T";
  }
  return null;
}

const roundSelectorEntries = computed(() =>
  availableRounds.value.map((round) => ({
    round,
    winnerSide: roundWinnerSide(round),
  })),
);

const roundHalftimeIndex = computed<number | null>(() => {
  const rounds = availableRounds.value;
  for (let i = 1; i < rounds.length; i++) {
    const prev = roundsByNumber.value.get(rounds[i - 1]);
    const cur = roundsByNumber.value.get(rounds[i]);
    if (
      prev?.lineup_1_side &&
      cur?.lineup_1_side &&
      prev.lineup_1_side !== cur.lineup_1_side
    ) {
      return i;
    }
  }
  return null;
});

const modePills = computed<{ key: "heatmap" | "movement"; label: string }[]>(
  () => [
    { key: "heatmap", label: t("match.map_analysis.mode_heatmap") },
    { key: "movement", label: t("match.map_analysis.mode_movement") },
  ],
);

// ← / → step through rounds (mirrors the 2D replay's round nav, but the
// analysis view has no tick scrubber so the arrows are free to drive rounds).
// The sequence leads with the "All rounds" (null) option so arrowing left from
// round 1 lands back on the aggregate view.
function stepRound(delta: number) {
  const rounds = availableRounds.value;
  if (!rounds.length) {
    return;
  }
  const seq: (number | null)[] = [null, ...rounds];
  const idx = seq.indexOf(selectedRound.value);
  const next = Math.max(
    0,
    Math.min(seq.length - 1, (idx === -1 ? 0 : idx) + delta),
  );
  selectedRound.value = seq[next];
}

function onKeyDown(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  ) {
    return;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    stepRound(-1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    stepRound(1);
  }
}

onMounted(() => window.addEventListener("keydown", onKeyDown));
onUnmounted(() => window.removeEventListener("keydown", onKeyDown));
</script>

<template>
  <Card class="bg-card/20">
    <CardContent class="p-3 sm:p-4">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <span :class="tacticalSectionLabelClasses" class="!mb-0">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("match.map_analysis.title") }}
            </span>
            <Select v-if="showMapSelector" v-model="selectedMapId">
              <SelectTrigger class="w-[180px]">
                <SelectValue :placeholder="$t('match.heatmaps.select_map')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="mm of matchMaps"
                    :key="mm.id"
                    :value="mm.id"
                  >
                    {{ cleanMapName(mm.map.name) }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <span
              v-else-if="activeMatchMap"
              class="font-sans text-sm font-semibold uppercase tracking-[0.1em] text-foreground"
            >
              {{ cleanMapName(activeMatchMap.map.name) }}
            </span>
          </div>

          <div class="flex items-center gap-3">
            <div
              v-if="canOpen2dPlayback && (has2dRadar || has3dMesh)"
              class="hidden items-stretch overflow-hidden rounded-md border border-border bg-card/50 sm:inline-flex"
            >
              <button
                v-if="has2dRadar"
                type="button"
                :title="$t('match.map_analysis.open_2d_playback')"
                class="inline-flex items-center justify-center px-2.5 py-1.5 text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.15)]"
                :class="has3dMesh ? 'border-r border-border/60' : ''"
                @click="open2dPlayback"
              >
                <span
                  class="flex h-5 w-5 items-center justify-center rounded-full border border-current font-mono text-[9px] font-black leading-none"
                  >2D</span
                >
              </button>
              <button
                v-if="has3dMesh"
                type="button"
                :title="$t('match.map_analysis.open_3d_playback')"
                class="inline-flex items-center justify-center px-2.5 py-1.5 text-[#38e1ff] transition-colors hover:bg-[#38e1ff]/15"
                @click="open3dPlayback"
              >
                <span
                  class="flex h-5 w-5 items-center justify-center rounded-full border border-current font-mono text-[9px] font-black leading-none"
                  >3D</span
                >
              </button>
            </div>

            <div
              class="inline-flex items-stretch overflow-hidden rounded-md border border-border bg-card/50"
            >
              <button
                v-for="pill of modePills"
                :key="pill.key"
                type="button"
                class="inline-flex items-center border-r border-border/60 px-3 py-1.5 text-xs tracking-[0.06em] transition-colors last:border-r-0"
                :class="
                  mode === pill.key
                    ? 'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                "
                @click="mode = pill.key"
              >
                {{ pill.label }}
              </button>
            </div>
          </div>
        </div>

        <Empty v-if="!radarSrc">
          <EmptyTitle>{{ $t("match.heatmaps.no_radar_title") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("match.heatmaps.no_radar_description") }}
          </EmptyDescription>
        </Empty>

        <div
          v-else
          class="grid items-start gap-4 lg:grid-cols-[210px_minmax(0,1fr)]"
        >
          <!-- LEFT: filter panel -->
          <aside
            class="flex flex-col gap-4 rounded-md border border-border/50 bg-card/30 p-3"
          >
            <template v-if="mode === 'heatmap'">
              <div class="flex flex-col gap-1.5">
                <span :class="tacticalSectionLabelClasses">
                  {{ $t("match.map_analysis.filter_stat") }}
                </span>
                <button
                  v-for="pill of layerPills"
                  :key="pill.key"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs tracking-[0.06em] transition-colors"
                  :class="
                    activeLayer === pill.key
                      ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                      : 'border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  "
                  @click="activeLayer = pill.key"
                >
                  <span
                    class="inline-block h-2 w-2 shrink-0 rounded-full"
                    :style="{ backgroundColor: pill.color }"
                  />
                  <span class="flex-1 text-left">{{ pill.label }}</span>
                  <span class="tabular-nums opacity-70">{{
                    layerCount(pill.key)
                  }}</span>
                </button>
              </div>

              <div class="flex flex-col gap-1.5">
                <span :class="tacticalSectionLabelClasses">
                  {{ $t("match.map_analysis.filter_render") }}
                </span>
                <div
                  class="inline-flex items-stretch overflow-hidden rounded-md border border-border bg-card/50"
                >
                  <button
                    v-for="pill of renderPills"
                    :key="pill.key"
                    type="button"
                    class="flex-1 border-r border-border/60 px-2.5 py-1.5 text-xs tracking-[0.06em] transition-colors last:border-r-0"
                    :class="
                      renderStyle === pill.key
                        ? 'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    "
                    @click="renderStyle = pill.key"
                  >
                    {{ pill.label }}
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <span :class="tacticalSectionLabelClasses">
                  {{ $t("match.map_analysis.filter_side") }}
                </span>
                <MatchSideFilter />
              </div>

              <div class="flex flex-col gap-1.5">
                <span :class="tacticalSectionLabelClasses">
                  {{ $t("match.map_analysis.filter_player") }}
                </span>
                <Select v-model="selectedSteamId">
                  <SelectTrigger class="w-full">
                    <SelectValue
                      :placeholder="$t('match.heatmaps.all_players')"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">
                        {{ $t("match.heatmaps.all_players") }}
                      </SelectItem>
                      <SelectItem
                        v-for="player of allPlayers"
                        :key="player.steamId"
                        :value="player.steamId"
                      >
                        {{ player.name }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div
                v-if="activeLayer === 'utility'"
                class="flex flex-col gap-1.5"
              >
                <span :class="tacticalSectionLabelClasses">
                  {{ $t("match.map_analysis.filter_type") }}
                </span>
                <div class="flex flex-wrap items-center gap-1.5">
                  <button
                    v-for="ut of UTILITY_TYPES"
                    :key="ut.value"
                    type="button"
                    :class="[
                      tacticalFilterPillClasses,
                      activeUtilityTypes.has(ut.value)
                        ? tacticalFilterPillActiveClasses
                        : 'opacity-40 grayscale',
                    ]"
                    @click="toggleUtilityType(ut.value)"
                  >
                    <span
                      class="inline-block h-2 w-2 rounded-full"
                      :style="{ backgroundColor: ut.color }"
                    />
                    {{ utilityLabel(ut.value) }}
                    <span class="opacity-70">{{
                      utilityTypeCount(ut.value)
                    }}</span>
                  </button>
                </div>
                <button
                  type="button"
                  class="mt-0.5 self-start"
                  :class="[
                    tacticalFilterPillClasses,
                    showTrajectories ? tacticalFilterPillActiveClasses : '',
                  ]"
                  @click="showTrajectories = !showTrajectories"
                >
                  {{ $t("match.heatmaps.trajectories") }}
                  <span
                    v-if="showTrajectories && blobLoading"
                    class="opacity-60"
                    >…</span
                  >
                  <span v-else-if="showTrajectories" class="opacity-70">{{
                    utilityLines.length
                  }}</span>
                </button>
              </div>
            </template>

            <template v-else>
              <div class="flex flex-col gap-1.5">
                <span :class="tacticalSectionLabelClasses">
                  {{ $t("match.map_analysis.filter_side") }}
                </span>
                <div
                  class="inline-flex items-stretch overflow-hidden rounded-md border border-border bg-card/50"
                >
                  <button
                    v-for="pill of sidePills"
                    :key="pill.key"
                    type="button"
                    class="flex-1 border-r border-border/60 px-2.5 py-1.5 text-xs tracking-[0.06em] transition-colors last:border-r-0"
                    :class="
                      sideFilter === pill.key
                        ? 'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    "
                    @click="sideFilter = pill.key"
                  >
                    {{ pill.label }}
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <span :class="tacticalSectionLabelClasses">
                  {{ $t("match.map_analysis.filter_team") }}
                </span>
                <div class="flex flex-col gap-2">
                  <button
                    v-for="pill of teamPills"
                    :key="pill.key"
                    type="button"
                    class="rounded-md border px-2.5 py-1.5 text-left text-xs tracking-[0.06em] transition-colors"
                    :class="
                      teamFilter === pill.key
                        ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                        : 'border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    "
                    @click="teamFilter = pill.key"
                  >
                    {{ pill.label }}
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <span :class="tacticalSectionLabelClasses">
                  {{ $t("match.map_analysis.filter_window") }}
                </span>
                <div
                  class="inline-flex items-stretch overflow-hidden rounded-md border border-border bg-card/50"
                >
                  <button
                    v-for="opt of WINDOW_OPTIONS"
                    :key="opt"
                    type="button"
                    class="flex-1 border-r border-border/60 px-2 py-1.5 text-xs tracking-[0.06em] transition-colors last:border-r-0"
                    :class="
                      windowSeconds === opt
                        ? 'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    "
                    @click="windowSeconds = opt"
                  >
                    {{ $t("match.movement.seconds", { count: opt }) }}
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <span :class="tacticalSectionLabelClasses">
                  {{ $t("match.map_analysis.filter_player") }}
                </span>
                <Select v-model="selectedSteamId">
                  <SelectTrigger class="w-full">
                    <SelectValue
                      :placeholder="$t('match.movement.all_players')"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">
                        {{ $t("match.movement.all_players") }}
                      </SelectItem>
                      <SelectItem
                        v-for="player of allPlayers"
                        :key="player.steamId"
                        :value="player.steamId"
                      >
                        {{ player.name }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </template>
          </aside>

          <!-- RIGHT: rounds + persistent map (overlay crossfades on mode switch) -->
          <div class="flex min-w-0 flex-col gap-3">
            <RoundSelector
              v-if="roundSelectorEntries.length"
              v-model="selectedRound"
              :rounds="roundSelectorEntries"
              :halftime-index="roundHalftimeIndex"
              allow-all
              nav
              :all-label="$t('match.heatmaps.all_rounds')"
              class="w-full max-w-[760px] mx-auto"
            />

            <div class="w-full max-w-[760px] mx-auto">
              <div
                class="relative w-full aspect-square overflow-hidden rounded-md border border-border"
              >
                <img
                  :src="radarSrc"
                  alt=""
                  class="absolute inset-0 h-full w-full object-cover select-none"
                  draggable="false"
                  @error="radarFailed = true"
                />
                <svg
                  class="absolute inset-0 h-full w-full"
                  :viewBox="`0 0 ${CANVAS} ${CANVAS}`"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <filter
                      id="heatblur"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feGaussianBlur stdDeviation="3.5" />
                    </filter>
                  </defs>
                  <Transition name="map-overlay">
                    <g v-if="mode === 'heatmap'" key="heat">
                      <g v-if="showTrajectories">
                        <line
                          v-for="(seg, index) of utilityLines"
                          :key="`tr-${index}`"
                          :x1="seg.x1"
                          :y1="seg.y1"
                          :x2="seg.x2"
                          :y2="seg.y2"
                          :stroke="seg.color"
                          stroke-opacity="0.45"
                          stroke-width="2"
                          stroke-linecap="round"
                        />
                        <circle
                          v-for="(seg, index) of utilityLines"
                          :key="`trd-${index}`"
                          :cx="seg.x2"
                          :cy="seg.y2"
                          r="4"
                          :fill="seg.color"
                          fill-opacity="0.8"
                        />
                      </g>
                      <g v-if="renderStyle === 'heat'" filter="url(#heatblur)">
                        <circle
                          v-for="(dot, index) of visibleDots"
                          :key="`${dot.category}:${dot.round}:${dot.steamId}:${index}`"
                          :cx="dot.x"
                          :cy="dot.y"
                          :r="heatRadius(dot)"
                          :fill="dotColor(dot)"
                          fill-opacity="0.28"
                          style="mix-blend-mode: screen"
                        />
                      </g>
                      <g v-else>
                        <circle
                          v-for="(dot, index) of visibleDots"
                          :key="`${dot.category}:${dot.round}:${dot.steamId}:${index}`"
                          :cx="dot.x"
                          :cy="dot.y"
                          r="6"
                          :fill="dotColor(dot)"
                          fill-opacity="0.55"
                          :stroke="dotColor(dot)"
                          stroke-opacity="0.9"
                          stroke-width="1.5"
                        />
                      </g>
                    </g>
                    <g v-else key="paths">
                      <template
                        v-for="(path, index) of visiblePaths"
                        :key="index"
                      >
                        <polyline
                          :points="pathPoints(path)"
                          fill="none"
                          :stroke="pathColor(path)"
                          :stroke-opacity="pathOpacity(path)"
                          :stroke-width="pathWidth(path)"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                        <circle
                          :cx="path.points[0].x"
                          :cy="path.points[0].y"
                          r="4"
                          :fill="pathColor(path)"
                          :fill-opacity="pathOpacity(path)"
                        />
                      </template>
                    </g>
                  </Transition>
                </svg>

                <div
                  class="absolute right-2 top-2 z-10 rounded border border-border/50 bg-background/70 px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.1em] text-muted-foreground backdrop-blur-sm"
                >
                  <template v-if="mode === 'heatmap'">
                    {{
                      $t("match.heatmaps.plotted", {
                        count: visibleDots.length,
                      })
                    }}
                  </template>
                  <template v-else-if="blobLoading">
                    {{ $t("match.movement.loading") }}
                  </template>
                  <template v-else>
                    {{
                      $t("match.movement.summary", {
                        rounds: visibleRoundCount,
                        paths: visiblePaths.length,
                      })
                    }}
                    <span v-if="capped" class="text-muted-foreground/60"
                      >· {{ $t("match.movement.sampled") }}</span
                    >
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
/* Crossfade the SVG overlay when switching Heatmap <-> Paths so the radar
   underneath is never destroyed/recreated. */
.map-overlay-enter-active,
.map-overlay-leave-active {
  transition: opacity 220ms ease;
}
.map-overlay-enter-from,
.map-overlay-leave-to {
  opacity: 0;
}
</style>
