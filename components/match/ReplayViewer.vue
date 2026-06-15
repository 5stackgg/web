<script lang="ts" setup>
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  weaponIconPath,
  weaponIconFallback,
  weaponBasename,
} from "~/utilities/weaponIcon";
import { kdColor } from "~/utils/statTiers";
import { moneyOf, isFullBuyRound } from "~/utilities/buyType";

// Canonical icon first (5Stack/new demos); if it 404s, retry the legacy
// strip-all path for old, already-parsed demos before hiding.
function onWeaponIconError(e: Event, weapon: string | null | undefined) {
  const img = e.target as HTMLImageElement;
  const fb = weaponIconFallback(weapon);
  if (fb && !img.dataset.fb && !img.src.endsWith(fb)) {
    img.dataset.fb = "1";
    img.src = fb;
  } else {
    img.style.display = "none";
  }
}
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
  ExternalLink,
  Users,
  Hash,
  Crosshair,
  Settings2,
  Keyboard,
  PanelRightClose,
  PanelRightOpen,
  Route,
  ChevronLeft,
  ChevronRight,
  Layers,
  Box,
  Skull,
} from "lucide-vue-next";
import { Kbd } from "~/components/ui/kbd";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import ReplayLineupTeam from "~/components/match/ReplayLineupTeam.vue";
import RoundSelector from "~/components/match/RoundSelector.vue";
import Replay3DLite from "~/components/match/Replay3DLite.vue";
import ReplayChrome from "~/components/match/ReplayChrome.vue";

type Position = {
  round: number;
  tick: number;
  attacker_steam_id: string;
  attacker_team: string | null;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number | null;
  health: number | null;
  armor?: number | null;
  helmet?: boolean;
  has_bomb?: boolean;
  has_defuser?: boolean;
  // Canonical name of the weapon equipped at this sample tick (rifle,
  // pistol, knife, grenade…). Absent on demos parsed before this field
  // existed — the token falls back to the round loadout in that case.
  active_weapon?: string | null;
  player?: { name?: string | null; avatar_url?: string | null } | null;
};

type Grenade = {
  round: number;
  tick: number;
  grenade_id: number | null;
  thrower_steam_id: string | null;
  thrower_team: string | null;
  type: "Flash" | "HE" | "Smoke" | "Molotov" | "Decoy";
  phase: "thrown" | "detonated";
  x: number;
  y: number;
  z: number;
};

type DemoKill = {
  tick: number;
  killer?: string;
  victim?: string;
  assist?: string;
  killer_team?: string;
  victim_team?: string;
  weapon?: string;
  headshot?: boolean;
};

type DemoBomb = {
  tick: number;
  type: string;
  player?: string;
  site?: string;
  has_kit?: boolean;
  // Position captured on "dropped" / "planted" — lets the radar paint
  // the bomb at the right spot between drop+pickup or after a plant.
  x?: number;
  y?: number;
  z?: number;
};

type DemoKitDrop = {
  tick: number;
  round?: number;
  player?: string;
  x: number;
  y: number;
  z: number;
};

type RoundTick = {
  round?: number;
  start_tick?: number;
  end_tick?: number;
  freeze_end_tick?: number;
  // "ct" or "t" once the round has been awarded. Captured by the
  // demo parser on RoundEnd. Used to roll up the live score.
  winner?: string | null;
  reason?: number | null;
};

// Per-player loadout snapshot at freeze-end (one entry per round per
// player). Drives the equipment row rendered under each player name in
// the lineup panel.
type RoundInventoryEntry = {
  round: number;
  steam_id: string | null;
  team: string | null;
  flash: number;
  smoke: number;
  he: number;
  molotov: number;
  decoy: number;
  primary: string | null;
  secondary: string | null;
  armor: number;
  helmet: boolean;
  kit: boolean;
};

// Per-round team money (from match_maps.rounds). Money is numeric in the
// DB but can arrive as a string over the wire — moneyOf() normalizes.
type RoundEconomyEntry = {
  round: number;
  lineup_1_money: number | string | null;
  lineup_2_money: number | string | null;
  lineup_1_side?: string | null;
  lineup_2_side?: string | null;
};

type TimerPhase = "freeze" | "live" | "bomb" | "ended";
type TimerState = {
  phase: TimerPhase;
  secondsRemaining: number;
};
type PathingMode = "off" | "progress";

type Shot = {
  round: number;
  tick: number;
  attacker_steam_id: string;
  attacker_team: string | null;
  with: string | null;
};

type Damage = {
  round: number;
  time: string;
  attacker_steam_id: string | null;
  attacked_steam_id: string;
  damage: number;
  health: number;
};

type MapSplit = {
  bounds: { top: number; bottom: number };
  offset: { x: number; y: number };
};
type RadarMeta = {
  resolution: number;
  offset: { x: number; y: number };
  splits?: MapSplit[];
};

type DemoPlayer = { steam_id: string; name: string };

const props = defineProps<{
  match: any;
  positions: Position[];
  grenades?: Grenade[];
  // Per-grenade bounce flight path (blob schema v4+); keyed by grenade_id.
  grenadeTrajectories?: Array<{
    gid: number;
    pts: Array<{ t: number; x: number; y: number; z: number }>;
  }>;
  shots?: Shot[];
  damages?: Damage[];
  demoPlayers?: DemoPlayer[];
  demoKills?: DemoKill[];
  demoBombs?: DemoBomb[];
  demoKitDrops?: DemoKitDrop[];
  demoRoundTicks?: RoundTick[];
  roundInventory?: RoundInventoryEntry[];
  // Per-round team money for full-buy detection (buy-round overlay).
  // Sourced from match_maps.rounds, not the replay blob.
  roundEconomy?: RoundEconomyEntry[];
  tickRate?: number;
  mapName?: string | null;
  // True when the viewer is already inside the popout window — we
  // hide the popout button so the user can't open the popout of the
  // popout.
  isPopout?: boolean;
  // Initial map view ("2d" default; "3d" for the standalone 3D page).
  initialView?: "2d" | "3d";
}>();

// CS2 defaults: 20s freezetime warmup (we anchor to the engine's
// reported freeze_end_tick), 1:55 (115s) round time, 0:40 (40s) bomb
// timer after plant.
const { t } = useI18n();
const ROUND_TIME_SEC = 115;
const BOMB_TIMER_SEC = 40;

const calibrations = ref<Record<string, RadarMeta> | null>(null);
const radarFailed = ref(false);

// 2D top-down board vs lightweight 3D perspective (radar plane + Z-lifted
// entities, no map geometry). Toggling preserves all playback state.
const viewMode = ref<"2d" | "3d">(props.initialView ?? "2d");

onMounted(async () => {
  try {
    const res = await fetch("/radars/metadata.json");
    if (res.ok) {
      const data = await res.json();
      const { _comment, ...rest } = data;
      calibrations.value = rest as Record<string, RadarMeta>;
    }
  } catch {
    /* metadata absent — fall back to auto-fit */
  }
});

const normalizedMap = computed(() =>
  (props.mapName || "")
    .trim()
    .toLowerCase()
    .replace(/_night$/, ""),
);

const calibration = computed<RadarMeta | null>(() => {
  if (!calibrations.value || !normalizedMap.value) return null;
  return calibrations.value[normalizedMap.value] ?? null;
});

const radarSrc = computed(() => {
  if (!calibration.value || !normalizedMap.value || radarFailed.value)
    return null;
  return `/radars/${normalizedMap.value}.png`;
});

// Lightweight collision mesh (awpy .tri) for 3D-lite, served from the CDN
// (config.public.mapMeshCdn, build-tag pinned + Brotli'd). The 3D renderer
// falls back to the flat radar plane when this 404s (map not yet generated).
const meshCdn = useRuntimeConfig().public.mapMeshCdn;
const mapMeshUrl = computed(() =>
  normalizedMap.value ? `${meshCdn}/${normalizedMap.value}.tri` : null,
);

const dedupedPositions = computed(() => {
  const seen = new Set<string>();
  const out: Position[] = [];
  for (const p of props.positions) {
    const key = `${p.attacker_steam_id}-${p.tick}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
});

const positionsByRound = computed(() => {
  const out = new Map<number, Position[]>();
  for (const p of dedupedPositions.value) {
    if (p.round === 0) continue;
    if (!out.has(p.round)) out.set(p.round, []);
    out.get(p.round)!.push(p);
  }
  return out;
});

const grenadesByRound = computed(() => {
  const out = new Map<number, Grenade[]>();
  for (const g of props.grenades ?? []) {
    if (!out.has(g.round)) out.set(g.round, []);
    out.get(g.round)!.push(g);
  }
  return out;
});

// Map each demo kill's tick to a round via round_ticks (start/end).
// match_map_demos.round_ticks shape: [{round, start_tick, end_tick}, …]
const tickToRound = computed(() => {
  const ranges = props.demoRoundTicks ?? [];
  return (tick: number): number => {
    for (const r of ranges) {
      const start = r.start_tick ?? -Infinity;
      const end = r.end_tick ?? Infinity;
      if (tick >= start && tick <= end) return r.round ?? 0;
    }
    return 0;
  };
});

type EnrichedKill = DemoKill & { round: number };

const killsByRound = computed(() => {
  const out = new Map<number, EnrichedKill[]>();
  for (const k of props.demoKills ?? []) {
    const round = tickToRound.value(k.tick);
    if (round === 0) continue;
    if (!out.has(round)) out.set(round, []);
    out.get(round)!.push({ ...k, round });
  }
  return out;
});

const shotsByRoundPlayer = computed(() => {
  const out = new Map<number, Map<string, Shot[]>>();
  for (const s of props.shots ?? []) {
    if (!out.has(s.round)) out.set(s.round, new Map());
    const m = out.get(s.round)!;
    const sid = String(s.attacker_steam_id);
    if (!m.has(sid)) m.set(sid, []);
    m.get(sid)!.push(s);
  }
  return out;
});

const rounds = computed(() =>
  [...positionsByRound.value.keys()].sort((a, b) => a - b),
);
const activeRound = ref<number | null>(null);
watch(
  rounds,
  (r) => {
    if (activeRound.value === null && r.length > 0) {
      activeRound.value = r[0];
      // Defer skipFreezetime — ticks[] computed needs activeRound set
      // first before it can index forward to the freeze-end tick.
      queueMicrotask(skipFreezetime);
    }
  },
  { immediate: true },
);

const roundPositions = computed(() =>
  activeRound.value === null
    ? []
    : (positionsByRound.value.get(activeRound.value) ?? []),
);
const roundGrenades = computed(() =>
  activeRound.value === null
    ? []
    : (grenadesByRound.value.get(activeRound.value) ?? []),
);
const roundKills = computed(() =>
  activeRound.value === null
    ? []
    : (killsByRound.value.get(activeRound.value) ?? []),
);

// For each kill, look up the victim's last-known position before the
// kill tick — that's where they died. Only return kills that have
// already happened relative to the playback cursor.
const killsBeforeCursor = computed(() => {
  const cursor = currentTick.value;
  return roundKills.value.filter((k) => k.tick <= cursor);
});

const activeRoundTick = computed<RoundTick | null>(() => {
  if (activeRound.value === null) return null;
  return (
    (props.demoRoundTicks ?? []).find((r) => r.round === activeRound.value) ??
    null
  );
});

const loadoutBySteam = computed<Map<string, RoundInventoryEntry>>(() => {
  const out = new Map<string, RoundInventoryEntry>();
  if (activeRound.value === null) return out;
  for (const r of props.roundInventory ?? []) {
    if (r.round !== activeRound.value) continue;
    if (!r.steam_id) continue;
    out.set(r.steam_id, r);
  }
  return out;
});

// Bomb events for the active round only (by tick range from round_ticks).
const activeRoundBombs = computed<DemoBomb[]>(() => {
  const rt = activeRoundTick.value;
  if (!rt) return [];
  const start = rt.start_tick ?? 0;
  const end = rt.end_tick ?? Infinity;
  return (props.demoBombs ?? []).filter(
    (b) => b.tick >= start && b.tick <= end,
  );
});

const bombPlantThisRound = computed<DemoBomb | null>(() => {
  return activeRoundBombs.value.find((b) => b.type === "planted") ?? null;
});

const bombDefuseThisRound = computed<DemoBomb | null>(() => {
  return activeRoundBombs.value.find((b) => b.type === "defused") ?? null;
});
const bombExplodeThisRound = computed<DemoBomb | null>(() => {
  return activeRoundBombs.value.find((b) => b.type === "exploded") ?? null;
});

const timer = computed<TimerState>(() => {
  const rt = activeRoundTick.value;
  const rate = props.tickRate || 64;
  const cursor = currentTick.value;

  if (!rt) return { phase: "live", secondsRemaining: 0 };

  // Bomb planted but not yet defused/exploded → bomb countdown.
  const plant = bombPlantThisRound.value;
  if (plant && plant.tick <= cursor) {
    const defuse = bombDefuseThisRound.value;
    const explode = bombExplodeThisRound.value;
    if (defuse && defuse.tick <= cursor) {
      return { phase: "ended", secondsRemaining: 0 };
    }
    if (explode && explode.tick <= cursor) {
      return { phase: "ended", secondsRemaining: 0 };
    }
    const sinceTicks = cursor - plant.tick;
    const remaining = Math.max(
      0,
      BOMB_TIMER_SEC - Math.floor(sinceTicks / rate),
    );
    return { phase: "bomb", secondsRemaining: remaining };
  }

  // Freezetime: between round start and freeze-end tick.
  const freezeEnd = rt.freeze_end_tick ?? rt.start_tick ?? 0;
  if (cursor < freezeEnd) {
    const remaining = Math.max(0, Math.ceil((freezeEnd - cursor) / rate));
    return { phase: "freeze", secondsRemaining: remaining };
  }

  // Live round time after freezetime ends.
  const sinceLive = cursor - freezeEnd;
  const remaining = Math.max(0, ROUND_TIME_SEC - Math.floor(sinceLive / rate));
  return { phase: "live", secondsRemaining: remaining };
});

function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Bomb marker on radar — looks up the planter's position at plant tick.
const bombMarker = computed(() => {
  const plant = bombPlantThisRound.value;
  if (!plant || plant.tick > currentTick.value) return null;
  const planterSid = String(plant.player ?? "");
  const samples = positionsByPlayer.value.get(planterSid) ?? [];
  let prev: Position | null = null;
  for (const p of samples) {
    if (p.tick > plant.tick) break;
    prev = p;
  }
  if (!prev) return null;
  const state: "planted" | "defused" | "exploded" = bombDefuseThisRound.value
    ? "defused"
    : bombExplodeThisRound.value
      ? "exploded"
      : "planted";
  return {
    x: prev.x,
    y: prev.y,
    z: prev.z,
    state,
    site: plant.site,
  };
});

const roundKillsWithLocation = computed(() => {
  const cursor = currentTick.value;
  return roundKills.value
    .filter((k) => k.tick <= cursor)
    .map((k) => {
      const sid = String(k.victim ?? "");
      const samples = positionsByPlayer.value.get(sid) ?? [];
      let prev: Position | null = null;
      for (const p of samples) {
        if (p.tick > k.tick) break;
        prev = p;
      }
      return {
        ...k,
        location: prev ? { x: prev.x, y: prev.y, z: prev.z } : null,
      };
    });
});

const ticks = computed(() => {
  const set = new Set<number>();
  for (const p of roundPositions.value) set.add(p.tick);
  return [...set].sort((a, b) => a - b);
});

const tickRange = computed(() => {
  if (!ticks.value.length) return { min: 0, max: 0 };
  return { min: ticks.value[0], max: ticks.value[ticks.value.length - 1] };
});

const positionsByPlayer = computed(() => {
  const out = new Map<string, Position[]>();
  for (const p of roundPositions.value) {
    const sid = String(p.attacker_steam_id);
    if (!out.has(sid)) out.set(sid, []);
    out.get(sid)!.push(p);
  }
  for (const arr of out.values()) arr.sort((a, b) => a.tick - b.tick);
  return out;
});

const tickIndex = ref(0);
const fractional = ref(0);
const speed = ref(1);
const playing = ref(false);

// On round change, snap the cursor past freezetime so the user lands
// at the live-round start. Falling through the 15s buy phase in
// playback is just dead time.
watch(activeRound, () => {
  tickIndex.value = 0;
  fractional.value = 0;
  skipFreezetime();
});

function skipFreezetime() {
  const rt = activeRoundTick.value;
  if (!rt) return;
  const freezeEnd = rt.freeze_end_tick;
  if (!freezeEnd) return;
  // Walk forward to the first tick at or past freeze_end_tick.
  const idx = ticks.value.findIndex((t) => t >= freezeEnd);
  if (idx > 0) {
    tickIndex.value = idx;
    fractional.value = 0;
  }
}

const currentTick = computed(() => ticks.value[tickIndex.value] ?? 0);

// Event markers laid over the scrubber for the active round — kills
// (colored by victim side) and grenade throws (colored by type), so the
// timeline reads like a real demo player's action track. progressPct is
// linear in tick, so positioning by (tick - first)/(last - first) lines
// the marks up exactly with the playhead.
const SCRUB_KILL_CT = "rgb(56,189,248)";
const SCRUB_KILL_T = "rgb(251,191,36)";
const SCRUB_KILL_NEUTRAL = "rgb(248,113,113)";
const SCRUB_NADE_COLORS: Record<string, string> = {
  HE: "rgb(239,68,68)",
  Molotov: "rgb(249,115,22)",
  Smoke: "rgb(148,163,184)",
  Flash: "rgb(250,204,21)",
  Decoy: "rgb(34,211,238)",
};
const NADE_SCRUB_ICON: Record<string, string> = {
  Smoke: "/img/equipment/smokegrenade.svg",
  Molotov: "/img/equipment/molotov.svg",
  HE: "/img/equipment/hegrenade.svg",
  Flash: "/img/equipment/flashbang.svg",
  Decoy: "/img/equipment/decoy.svg",
};
const scrubberMarkers = computed<
  Array<{ left: number; lane: "kill" | "nade"; color: string; title: string; icon?: string; gid?: number }>
>(() => {
  const range = tickRange.value;
  const span = range.max - range.min;
  const round = activeRound.value;
  if (span <= 0 || round === null) {
    return [];
  }
  const out: Array<{
    left: number;
    lane: "kill" | "nade";
    color: string;
    title: string;
    icon?: string;
    gid?: number;
  }> = [];
  for (const k of killsByRound.value.get(round) ?? []) {
    const left = ((k.tick - range.min) / span) * 100;
    if (left < -1 || left > 101) {
      continue;
    }
    out.push({
      left: Math.max(0, Math.min(100, left)),
      lane: "kill",
      color:
        k.victim_team === "ct"
          ? SCRUB_KILL_CT
          : k.victim_team === "t"
            ? SCRUB_KILL_T
            : SCRUB_KILL_NEUTRAL,
      title: k.weapon ? `Kill (${k.weapon})` : "Kill",
    });
  }
  for (const g of grenadesByRound.value.get(round) ?? []) {
    if (g.phase !== "thrown") {
      continue;
    }
    const left = ((g.tick - range.min) / span) * 100;
    if (left < -1 || left > 101) {
      continue;
    }
    out.push({
      left: Math.max(0, Math.min(100, left)),
      lane: "nade",
      color: SCRUB_NADE_COLORS[g.type] ?? "rgb(148,163,184)",
      title: g.type,
      icon: NADE_SCRUB_ICON[g.type],
      gid: g.grenade_id ?? undefined,
    });
  }
  return out;
});

const killFeedDisplay = computed(() =>
  killsBeforeCursor.value.slice().reverse(),
);

const killFeedEl = ref<HTMLElement | null>(null);
watch(
  () => killsBeforeCursor.value.length,
  () => {
    const el = killFeedEl.value;
    if (el) el.scrollTop = 0;
  },
);
const nextTickValue = computed(
  () => ticks.value[Math.min(tickIndex.value + 1, ticks.value.length - 1)] ?? 0,
);

// Bomb-on-ground position for the active round at the cursor tick.
// Walks the round's bomb timeline in order:
//   - dropped: set pos to drop location
//   - pickup:  clear (back to a carrier)
//   - planted: pin pos to plant location
//   - defused / exploded: clear (bomb is gone)
// Returns null while the bomb is on a carrier, was never dropped, or
// the round has ended in defuse/explosion.
const groundBombAt = computed<{ x: number; y: number; z: number } | null>(
  () => {
    if (!activeRoundBombs.value.length) return null;
    const cursor = currentTick.value;
    let pos: { x: number; y: number; z: number } | null = null;
    for (const b of activeRoundBombs.value) {
      if (b.tick > cursor) break;
      if (
        (b.type === "dropped" || b.type === "planted") &&
        b.x !== undefined &&
        b.y !== undefined
      ) {
        pos = { x: b.x, y: b.y, z: b.z ?? 0 };
      } else if (
        b.type === "pickup" ||
        b.type === "defused" ||
        b.type === "exploded"
      ) {
        pos = null;
      }
    }
    return pos;
  },
);

// Dropped defuse kits visible at the cursor tick. The parser only
// emits kit_drops on CT deaths, so each entry is a permanent ground
// marker for the rest of the round (we don't currently track
// repickups). Kits from prior rounds are filtered out via tick range.
const groundKitsAt = computed<
  Array<{ x: number; y: number; z: number; tick: number }>
>(() => {
  const rt = activeRoundTick.value;
  if (!rt) return [];
  const start = rt.start_tick ?? 0;
  const end = rt.end_tick ?? Infinity;
  const cursor = currentTick.value;
  return (props.demoKitDrops ?? []).filter(
    (k) => k.tick >= start && k.tick <= end && k.tick <= cursor,
  );
});

// Sliding window in ticks for "did this player just fire / take damage".
// At 64 tps a 0.2s window = ~13 ticks.
const RECENT_TICKS = 16;

function findPositionAt(samples: Position[], tick: number): Position | null {
  // Linear search is fine — typical round has ~120 samples per player.
  for (const p of samples) {
    if (p.tick >= tick) return p;
  }
  return samples[samples.length - 1] ?? null;
}

// Shortest-path angle interpolation. Without this, yaw 350° → 10° jumps
// 340° around when it should sweep 20° the short way.
function lerpAngle(a: number, b: number, k: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  return a + diff * k;
}

// Flashbang propagation. For each round, collect flash detonations
// with resolved world positions. At render time each player is checked
// against active flashes and gets a 0..1 "blinded" strength based on
// distance + angular incidence + age, mimicking the real CS2 blind
// function (close + looking-toward = long blind; far/peripheral = short).
type FlashEvent = { tick: number; x: number; y: number };
const flashesByRound = computed(() => {
  const map = new Map<number, FlashEvent[]>();
  for (const g of props.grenades ?? []) {
    if (g.phase !== "detonated" || g.type !== "Flash") continue;
    const pos = resolveGrenadePosition(g);
    if (!pos) continue;
    if (!map.has(g.round)) map.set(g.round, []);
    map.get(g.round)!.push({ tick: g.tick, x: pos.x, y: pos.y });
  }
  return map;
});

const FLASH_RANGE = 1500; // world units — effective blind radius
const FLASH_MAX_TICKS = 64 * 3.8; // ~3.8s max blind at point-blank dead-on
const FLASH_MIN_TICKS = 32; // ~0.5s minimum if barely caught

// Returns the strongest blind contribution (0..1) from any active flash
// at this tick. 1 = staring directly into a close flash; 0 = unaffected.
function blindStrengthFor(
  px: number,
  py: number,
  pYaw: number,
  flashes: FlashEvent[] | undefined,
  tick: number,
): number {
  if (!flashes || flashes.length === 0) return 0;
  let max = 0;
  for (const f of flashes) {
    const age = tick - f.tick;
    if (age < 0 || age > FLASH_MAX_TICKS) continue;
    const dx = f.x - px;
    const dy = f.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > FLASH_RANGE) continue;
    const bearingDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const yawDiff = Math.abs(((bearingDeg - pYaw + 540) % 360) - 180);
    if (yawDiff > 110) continue; // beyond peripheral FOV — no blind
    const distFactor = 1 - dist / FLASH_RANGE;
    const angleFactor = Math.max(0, 1 - yawDiff / 110);
    const totalDur =
      FLASH_MIN_TICKS +
      (FLASH_MAX_TICKS - FLASH_MIN_TICKS) * distFactor * angleFactor;
    if (age > totalDur) continue;
    const ageFactor = 1 - age / totalDur;
    const strength = distFactor * angleFactor * ageFactor;
    if (strength > max) max = strength;
  }
  return max;
}

// Per-player bomb interaction state for the active round at the
// current cursor tick. Derived by walking that round's bomb events in
// order: pickup/dropped flip the carrier (the last sample's has_bomb
// is the source of truth for the live carrier); plant_begin starts a
// "planting" state that ends at planted/plant_abort; defuse_begin
// starts a "defusing" state that ends at defused/defuse_abort. Old
// demos without the new event types simply produce no state.
type BombInteraction = "planting" | "defusing" | null;
const bombStateByPlayer = computed(() => {
  const out = new Map<string, BombInteraction>();
  const round = activeRound.value;
  if (round === null) return out;
  const cursor = currentTick.value;
  const rt = (props.demoRoundTicks ?? []).find((r) => r.round === round);
  const start = rt?.start_tick ?? -Infinity;
  const end = rt?.end_tick ?? Infinity;
  for (const b of props.demoBombs ?? []) {
    if (b.tick < start || b.tick > end || b.tick > cursor) continue;
    if (!b.player) {
      // Terminal events with no player (exploded) clear any lingering
      // planting state regardless of who set it.
      if (b.type === "exploded") {
        for (const [sid, s] of out) if (s === "planting") out.delete(sid);
      }
      continue;
    }
    switch (b.type) {
      case "plant_begin":
        out.set(b.player, "planting");
        break;
      case "defuse_begin":
        out.set(b.player, "defusing");
        break;
      case "plant_abort":
      case "planted":
        if (out.get(b.player) === "planting") out.delete(b.player);
        break;
      case "defuse_abort":
      case "defused":
        if (out.get(b.player) === "defusing") out.delete(b.player);
        break;
    }
  }
  return out;
});

const interpolatedPlayers = computed(() => {
  const result: Array<{
    steamId: string;
    team: string | null;
    alive: boolean;
    x: number;
    y: number;
    z: number;
    yaw: number;
    firing: boolean;
    blinded: number;
    // null when the loaded demo predates the health column — skip
    // rendering the bar entirely rather than showing a fake full bar.
    health: number | null;
    armor: number | null;
    helmet: boolean;
    hasBomb: boolean;
    hasDefuser: boolean;
    activeWeapon: string | null;
    bombAction: BombInteraction;
  }> = [];
  const t0 = currentTick.value;
  const t1 = nextTickValue.value;
  const span = Math.max(1, t1 - t0);
  const f = fractional.value;
  const shotsMap = shotsByRoundPlayer.value.get(activeRound.value ?? -1);
  const flashesNow = flashesByRound.value.get(activeRound.value ?? -1);
  const bombStates = bombStateByPlayer.value;

  for (const [sid, samples] of positionsByPlayer.value) {
    const a = samples.find((p) => p.tick === t0);
    const b = samples.find((p) => p.tick === t1);
    const cur = a ?? b;
    if (!cur) continue;
    const next = b ?? a!;
    const blend =
      a && b ? Math.min(1, Math.max(0, (next.tick - t0) / span)) : 0;
    const k = blend * f;

    const recentShots = shotsMap?.get(sid) ?? [];
    let firing = false;
    for (const s of recentShots) {
      if (s.tick > t0) break;
      if (t0 - s.tick <= RECENT_TICKS) {
        firing = true;
        break;
      }
    }
    const yawA = cur.yaw ?? 0;
    const yawB = next.yaw ?? yawA;
    const yaw = lerpAngle(yawA, yawB, k);

    const x = cur.x + (next.x - cur.x) * k;
    const y = cur.y + (next.y - cur.y) * k;
    const blinded = cur.alive ? blindStrengthFor(x, y, yaw, flashesNow, t0) : 0;

    // HP: lerp between samples so the back-arc smoothly shrinks across
    // the 0.25s sample gap. null when neither sample carries health
    // (older demos) — the renderer skips the bar in that case.
    let health: number | null = null;
    if (cur.health != null || next.health != null) {
      const ha = cur.health ?? next.health ?? 100;
      const hb = next.health ?? cur.health ?? 100;
      health = Math.max(0, Math.min(100, Math.round(ha + (hb - ha) * k)));
    }
    // Armor: same lerp treatment. null on old demos that pre-date
    // the armor column so we don't paint a phantom full bar.
    let armor: number | null = null;
    if (cur.armor != null || next.armor != null) {
      const aa = cur.armor ?? next.armor ?? 0;
      const ab = next.armor ?? cur.armor ?? 0;
      armor = Math.max(0, Math.min(100, Math.round(aa + (ab - aa) * k)));
    }

    result.push({
      steamId: sid,
      team: cur.attacker_team,
      alive: cur.alive,
      x,
      y,
      z: cur.z + (next.z - cur.z) * k,
      yaw,
      firing,
      blinded,
      health,
      armor,
      helmet: cur.helmet === true || next.helmet === true,
      hasBomb: cur.has_bomb === true,
      hasDefuser: cur.has_defuser === true,
      activeWeapon: cur.active_weapon ?? null,
      bombAction: bombStates.get(sid) ?? null,
    });
  }
  return result;
});

// Render order: the hovered + focused players (if any) are moved to
// the end of the list so SVG paints them last → they sit on top of
// any kites they're overlapping AND their tooltip card paints above
// every other marker (the hovered tooltip used to disappear behind
// later-painted players stacked on top of it).
// Focused renders last (after hovered) so the pulse ring + tooltip
// always dominate when both states apply to different players.
const playersForRender = computed(() => {
  const focused = focusedPlayerId.value;
  const hovered = hoveredPlayerSid.value;
  if (!focused && !hovered) return interpolatedPlayers.value;
  const rest: typeof interpolatedPlayers.value = [];
  let hoveredEntry: (typeof interpolatedPlayers.value)[number] | null = null;
  let focusedEntry: (typeof interpolatedPlayers.value)[number] | null = null;
  for (const p of interpolatedPlayers.value) {
    if (p.steamId === focused) {
      focusedEntry = p;
    } else if (p.steamId === hovered) {
      hoveredEntry = p;
    } else {
      rest.push(p);
    }
  }
  if (hoveredEntry) rest.push(hoveredEntry);
  if (focusedEntry) rest.push(focusedEntry);
  return rest;
});

function isProjectedInside(p: { x: number; y: number; z?: number }): boolean {
  const pr = projectRaw(p);
  // Tight inset — the radar PNG fills the central ~85% of the canvas,
  // anything outside is dead space + skybox where smokes/mollies can't
  // legitimately detonate.
  const inset = CANVAS * 0.08;
  return (
    pr.x >= inset &&
    pr.x <= CANVAS - inset &&
    pr.y >= inset &&
    pr.y <= CANVAS - inset
  );
}

// Demoinfocs reports stale (0,0,0) Position on some Source 2 grenade
// detonate events. Filter logic: for each detonation, find the
// matching throw (same round/thrower/type, throw tick < detonate
// tick, closest before). If the detonation coords are absurdly far
// from where it was thrown — or land in dead-space — replace the
// detonate coords with the throw origin so the icon at least lines
// up with where the player actually was when they threw it.
//
// Real grenade flight distances cap at ~2200 units (deagle/AWP
// throw is the longest reasonable trajectory).
const MAX_FLIGHT_DIST = 2500;

const grenadePairs = computed(() => {
  const throwToDet = new Map<Grenade, Grenade>();
  const detToThrow = new Map<Grenade, Grenade>();
  const byRound = new Map<number, Grenade[]>();
  for (const g of props.grenades ?? []) {
    if (!byRound.has(g.round)) byRound.set(g.round, []);
    byRound.get(g.round)!.push(g);
  }

  for (const grenades of byRound.values()) {
    const throws = grenades.filter((g) => g.phase === "thrown");
    const detonations = grenades.filter((g) => g.phase === "detonated");
    const claimed = new Set<Grenade>();

    const detById = new Map<number, Grenade>();
    for (const d of detonations) {
      if (d.grenade_id != null) detById.set(d.grenade_id, d);
    }
    for (const t of throws) {
      if (t.grenade_id == null) continue;
      const d = detById.get(t.grenade_id);
      if (!d || claimed.has(d)) continue;
      throwToDet.set(t, d);
      detToThrow.set(d, t);
      claimed.add(d);
    }

    const leftoverThrows = throws
      .filter((t) => !throwToDet.has(t))
      .sort((a, b) => a.tick - b.tick);
    for (const t of leftoverThrows) {
      let best: Grenade | null = null;
      let bestScore = Infinity;
      for (const d of detonations) {
        if (claimed.has(d) || d.type !== t.type || d.tick < t.tick) continue;
        const dx = d.x - t.x;
        const dy = d.y - t.y;
        if (dx * dx + dy * dy > MAX_FLIGHT_DIST * MAX_FLIGHT_DIST) continue;
        const sameThrower =
          t.thrower_steam_id != null &&
          d.thrower_steam_id != null &&
          t.thrower_steam_id === d.thrower_steam_id;
        const score = d.tick - t.tick - (sameThrower ? 1e6 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = d;
        }
      }
      if (best) {
        throwToDet.set(t, best);
        detToThrow.set(best, t);
        claimed.add(best);
      }
    }
  }

  return { throwToDet, detToThrow };
});

function nearestThrow(g: Grenade): Grenade | null {
  return grenadePairs.value.detToThrow.get(g) ?? null;
}

// Prefer the detonation position (where the smoke actually landed).
// Fall back to the throw origin if the detonate row reports (0,0) or
// is implausibly far from the thrower — Source 2 demos drop stale
// Position on the event for some grenade types.
function resolveGrenadePosition(
  g: Grenade,
): { x: number; y: number; z: number } | null {
  const detBad = g.x === 0 && g.y === 0;
  const thr = nearestThrow(g);
  if (detBad) return thr ? { x: thr.x, y: thr.y, z: thr.z } : null;
  if (thr) {
    const dx = g.x - thr.x;
    const dy = g.y - thr.y;
    if (dx * dx + dy * dy > MAX_FLIGHT_DIST * MAX_FLIGHT_DIST) {
      return { x: thr.x, y: thr.y, z: thr.z };
    }
  }
  return { x: g.x, y: g.y, z: g.z };
}

// Grenade lifetimes (in ticks @ 64 tps — close enough at 128 too).
const GRENADE_LIFETIME_TICKS: Record<Grenade["type"], number> = {
  Smoke: 18 * 64,
  Molotov: 7 * 64,
  HE: 2 * 64,
  Flash: 2.5 * 64,
  Decoy: 15 * 64,
};

type ResolvedGrenade = Grenade & {
  rx: number;
  ry: number;
  rz: number;
  // Remaining lifetime fraction [0,1] at the current playback tick —
  // drives the depleting timer ring around timed grenades.
  life: number;
};

// Sub-sample-smoothed tick. tickIndex steps once every SAMPLE_SEC (0.25s)
// so a tick-only animation feels like 4fps. Blending with `fractional`
// (the rAF-driven [0,1) progress toward the next sample) gives a real-
// numbered tick that updates at display rate.
const smoothCurrentTick = computed(() => {
  const t0 = currentTick.value;
  const t1 = nextTickValue.value;
  return t0 + (t1 - t0) * fractional.value;
});

function resolveDetonation(g: Grenade, life: number): ResolvedGrenade | null {
  const resolved = resolveGrenadePosition(g);
  if (!resolved) return null;
  const r: ResolvedGrenade = {
    ...g,
    rx: resolved.x,
    ry: resolved.y,
    rz: resolved.z,
    life,
  };
  if (!isProjectedInside({ x: r.rx, y: r.ry, z: r.rz })) return null;
  return r;
}

const detonationsByTick = computed<ResolvedGrenade[]>(() => {
  // Overlay: union of every selected round's active detonations, each
  // measured against its own seconds-since-freezetime clock. Same real
  // smoke/fire/flash markup as single-round playback.
  if (overlayMode.value) {
    const tr = props.tickRate || 64;
    const elapsedTicks = overlayElapsedSec.value * tr;
    const out: ResolvedGrenade[] = [];
    for (const round of overlaySelectedRounds.value) {
      const fe = freezeEndByRound.value.get(round);
      if (fe == null) continue;
      const t = fe + elapsedTicks;
      for (const g of grenadesByRound.value.get(round) ?? []) {
        if (g.phase !== "detonated" || g.tick > t) continue;
        const lifetime = GRENADE_LIFETIME_TICKS[g.type] ?? 64;
        if (t - g.tick > lifetime) continue;
        const r = resolveDetonation(g, 1 - (t - g.tick) / lifetime);
        if (r) out.push(r);
      }
    }
    return out;
  }
  const t = smoothCurrentTick.value;
  if (!t) return [];
  const out: ResolvedGrenade[] = [];
  for (const g of roundGrenades.value) {
    if (g.phase !== "detonated") continue;
    if (g.tick > t) continue;
    const lifetime = GRENADE_LIFETIME_TICKS[g.type] ?? 64;
    if (t - g.tick > lifetime) continue;
    const r = resolveDetonation(g, 1 - (t - g.tick) / lifetime);
    if (r) out.push(r);
  }
  return out;
});

// All detonations of the active round (not just the currently-live ones) —
// drives the 3D utility heatmap. Resolved to real landing positions.
const roundDetonations = computed(() => {
  const out: Array<{ rx: number; ry: number; rz: number; type: string }> = [];
  for (const g of roundGrenades.value) {
    if (g.phase !== "detonated") continue;
    const r = resolveDetonation(g, 1);
    if (r) out.push({ rx: r.rx, ry: r.ry, rz: r.rz, type: r.type });
  }
  return out;
});

// In-flight grenades: between throw tick and detonation tick we
// interpolate position linearly from throw origin → detonation landing.
// Linear is fine on a top-down 2D radar — the real vertical arc is
// invisible. We also expose the predicted landing so the renderer can
// draw a faint trajectory hint that looks like a "look-ahead" cue.
type InFlightGrenade = {
  key: string;
  gid: number | null;
  type: Grenade["type"];
  thrower_team: string | null;
  x: number;
  y: number;
  z: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
};
// Resolve a single in-flight throw against playback tick `t`. Returns
// null if it hasn't been thrown yet, already detonated, or is off-map.
function resolveInFlight(thr: Grenade, t: number): InFlightGrenade | null {
  if (thr.tick > t) return null;
  const det = grenadePairs.value.throwToDet.get(thr);
  if (!det) return null;
  if (det.tick <= t) return null; // already detonated → detonationsByTick
  const landing = resolveGrenadePosition(det);
  if (!landing) return null;
  const span = Math.max(1, det.tick - thr.tick);
  const progress = Math.min(1, Math.max(0, (t - thr.tick) / span));
  const x = thr.x + (landing.x - thr.x) * progress;
  const y = thr.y + (landing.y - thr.y) * progress;
  const z = thr.z + (landing.z - thr.z) * progress;
  if (!isProjectedInside({ x, y, z })) return null;
  return {
    key: `${thr.round}-${thr.grenade_id ?? thr.tick}`,
    gid: thr.grenade_id ?? null,
    type: thr.type,
    thrower_team: thr.thrower_team,
    x,
    y,
    z,
    fromX: thr.x,
    fromY: thr.y,
    toX: landing.x,
    toY: landing.y,
    progress,
  };
}
const inFlightGrenades = computed<InFlightGrenade[]>(() => {
  if (overlayMode.value) {
    const tr = props.tickRate || 64;
    const elapsedTicks = overlayElapsedSec.value * tr;
    const out: InFlightGrenade[] = [];
    for (const round of overlaySelectedRounds.value) {
      const fe = freezeEndByRound.value.get(round);
      if (fe == null) continue;
      const t = fe + elapsedTicks;
      for (const thr of grenadesByRound.value.get(round) ?? []) {
        if (thr.phase !== "thrown") continue;
        const g = resolveInFlight(thr, t);
        if (g) out.push(g);
      }
    }
    return out;
  }
  const t = smoothCurrentTick.value;
  if (!t) return [];
  const out: InFlightGrenade[] = [];
  for (const thr of roundGrenades.value) {
    if (thr.phase !== "thrown") continue;
    const g = resolveInFlight(thr, t);
    if (g) out.push(g);
  }
  return out;
});

function parseLocCoords(
  s: string | null,
): { x: number; y: number; z: number } | null {
  if (!s) return null;
  const parts = s
    .replace(/[(){}\[\]]/g, "")
    .split(/[, ]+/)
    .map(Number);
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return { x: parts[0], y: parts[1], z: parts[2] ?? 0 };
}

const bounds = computed(() => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of props.positions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const padX = (maxX - minX) * 0.05 || 100;
  const padY = (maxY - minY) * 0.05 || 100;
  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
  };
});

const CANVAS = 1024;
const RADAR_PX = 1024;

function applySplit(z: number, splits: MapSplit[] | undefined) {
  if (!splits) return { dx: 0, dy: 0 };
  for (const s of splits) {
    if (z > s.bounds.bottom && z < s.bounds.top) {
      return { dx: s.offset.x, dy: s.offset.y };
    }
  }
  return { dx: 0, dy: 0 };
}

function projectRaw(p: { x: number; y: number; z?: number }) {
  if (calibration.value) {
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
  const b = bounds.value;
  const w = b.maxX - b.minX || 1;
  const h = b.maxY - b.minY || 1;
  return {
    x: ((p.x - b.minX) / w) * CANVAS,
    y: CANVAS - ((p.y - b.minY) / h) * CANVAS,
  };
}

function project(p: { x: number; y: number; z?: number }) {
  return projectRaw(p);
}

const PATH_MIN_SCREEN_DIST = 4;
const PATH_MAX_WORLD_JUMP = 1800;
const PATH_MAX_TICK_GAP_SEC = 2.5;

type RadarPathSegment = {
  key: string;
  team: string | null;
  d: string;
  focused: boolean;
};

function pathSegmentToD(points: Array<{ x: number; y: number }>): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

const playerPathSegments = computed<RadarPathSegment[]>(() => {
  if (pathingMode.value === "off") return [];
  const cursor = smoothCurrentTick.value;
  const maxTickGap = Math.max(
    1,
    Math.round((props.tickRate || 64) * PATH_MAX_TICK_GAP_SEC),
  );
  const out: RadarPathSegment[] = [];

  for (const [sid, samples] of positionsByPlayer.value) {
    const focused = focusedPlayerId.value === sid;
    let team: string | null = null;
    let segment: Array<{ x: number; y: number }> = [];
    let lastSample: Position | null = null;
    let lastPoint: { x: number; y: number } | null = null;
    let segmentIdx = 0;

    const flush = () => {
      if (segment.length < 2) {
        segment = [];
        lastPoint = null;
        return;
      }
      out.push({
        key: `${sid}-${segmentIdx++}`,
        team,
        d: pathSegmentToD(segment),
        focused,
      });
      segment = [];
      lastPoint = null;
    };

    for (const sample of samples) {
      if (sample.tick > cursor) break;
      if (!sample.alive) {
        flush();
        lastSample = null;
        continue;
      }
      team ??= sample.attacker_team;
      if (lastSample) {
        const dx = sample.x - lastSample.x;
        const dy = sample.y - lastSample.y;
        const jump = dx * dx + dy * dy;
        if (
          sample.tick - lastSample.tick > maxTickGap ||
          jump > PATH_MAX_WORLD_JUMP * PATH_MAX_WORLD_JUMP
        ) {
          flush();
        }
      }

      const point = project(sample);
      if (
        lastPoint &&
        segment.length > 1 &&
        (point.x - lastPoint.x) * (point.x - lastPoint.x) +
          (point.y - lastPoint.y) * (point.y - lastPoint.y) <
          PATH_MIN_SCREEN_DIST * PATH_MIN_SCREEN_DIST
      ) {
        lastSample = sample;
        continue;
      }
      segment.push(point);
      lastPoint = point;
      lastSample = sample;
    }
    flush();
  }

  return out;
});

let rafHandle: number | null = null;
let lastFrameTs = 0;

function frame(now: number) {
  if (!playing.value) return;
  const dt = lastFrameTs ? (now - lastFrameTs) / 1000 : 0;
  lastFrameTs = now;
  // Buy-round overlay: a single shared clock in seconds-since-freezetime
  // drives every stacked round. Loop back to 0 at the window end so the
  // setups replay continuously.
  if (overlayMode.value) {
    overlayElapsedSec.value += dt * speed.value;
    if (overlayElapsedSec.value >= overlayWindowSec.value) {
      overlayElapsedSec.value = 0;
    }
    rafHandle = requestAnimationFrame(frame);
    return;
  }
  const SAMPLE_SEC = 0.25;
  fractional.value += (dt * speed.value) / SAMPLE_SEC;
  while (fractional.value >= 1) {
    fractional.value -= 1;
    if (tickIndex.value < ticks.value.length - 1) {
      tickIndex.value++;
    } else {
      // Reached the end of this round's samples. If there's another
      // round queued up, advance to it and keep playing — the activeRound
      // watcher resets tickIndex and auto-skips freezetime for us so
      // playback flows continuously across rounds. Only pause when we
      // genuinely hit the end of the match.
      const cur = activeRound.value;
      const idx = cur === null ? -1 : rounds.value.indexOf(cur);
      if (idx >= 0 && idx < rounds.value.length - 1) {
        activeRound.value = rounds.value[idx + 1];
        fractional.value = 0;
        // Bail this frame; next rAF runs after the watcher has flushed
        // the ticks[] update so the loop sees the new round's samples.
        rafHandle = requestAnimationFrame(frame);
        return;
      }
      pause();
      fractional.value = 0;
      return;
    }
  }
  rafHandle = requestAnimationFrame(frame);
}

function play() {
  if (playing.value) return;
  playing.value = true;
  lastFrameTs = 0;
  rafHandle = requestAnimationFrame(frame);
}
function pause() {
  playing.value = false;
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
}
function toggle() {
  if (playing.value) pause();
  else play();
}
function step(delta: number) {
  pause();
  if (overlayMode.value) {
    // Nudge the shared clock by ~0.25s per step (×10 with Shift via the
    // larger delta the caller passes), clamped to the window.
    const STEP_SEC = 0.25;
    overlayElapsedSec.value = Math.max(
      0,
      Math.min(overlayWindowSec.value, overlayElapsedSec.value + delta * STEP_SEC),
    );
    return;
  }
  tickIndex.value = Math.max(
    0,
    Math.min(ticks.value.length - 1, tickIndex.value + delta),
  );
  fractional.value = 0;
}

// Smooth playbar progress (0..100). Drives the custom playbar fill +
// thumb so the animation stays fluid between the 4Hz position samples.
const progressPct = computed(() => {
  if (ticks.value.length < 2) return 0;
  const first = ticks.value[0];
  const last = ticks.value[ticks.value.length - 1];
  if (last <= first) return 0;
  const t = smoothCurrentTick.value;
  return Math.max(0, Math.min(100, ((t - first) / (last - first)) * 100));
});

// In overlay mode the playbar spans the shared 0..windowSec clock.
const overlayProgressPct = computed(() => {
  if (overlayWindowSec.value <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, (overlayElapsedSec.value / overlayWindowSec.value) * 100),
  );
});

// Scrubbing: click anywhere on the bar to jump, drag to scrub. We use
// pointer events so it works for mouse, pen, and touch identically.
function seekByPointer(e: PointerEvent, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  if (overlayMode.value) {
    overlayElapsedSec.value = Math.max(
      0,
      Math.min(overlayWindowSec.value, pct * overlayWindowSec.value),
    );
    return;
  }
  const i = Math.round(pct * (ticks.value.length - 1));
  tickIndex.value = Math.max(0, Math.min(ticks.value.length - 1, i));
  fractional.value = 0;
}
function onScrubStart(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement;
  pause();
  el.setPointerCapture(e.pointerId);
  seekByPointer(e, el);
  const onMove = (ev: PointerEvent) => seekByPointer(ev, el);
  const onUp = (ev: PointerEvent) => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    try {
      el.releasePointerCapture(ev.pointerId);
    } catch {
      /* already released */
    }
  };
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
}
function jumpToRound(delta: number) {
  // Single-round navigation is meaningless while the overlay stacks
  // every selected round on one clock.
  if (overlayMode.value) return;
  pause();
  const idx = rounds.value.indexOf(activeRound.value ?? rounds.value[0]);
  const next = Math.max(0, Math.min(rounds.value.length - 1, idx + delta));
  activeRound.value = rounds.value[next] ?? null;
}
const canPrevRound = computed(
  () => rounds.value.indexOf(activeRound.value ?? rounds.value[0]) > 0,
);
const canNextRound = computed(() => {
  const idx = rounds.value.indexOf(activeRound.value ?? rounds.value[0]);
  return idx >= 0 && idx < rounds.value.length - 1;
});
function jumpToNextKill() {
  const t = currentTick.value;
  // Map kill timestamps to nearest tick via the player's positions —
  // approximate by stepping the slider to ticks that contain a kill
  // event in the position-tick neighbourhood. For now: find the next
  // demoKills give us actual ticks — find the next kill after the
  // cursor and snap the slider there.
  const kills = roundKills.value;
  if (kills.length === 0) return;
  const killTicks = kills.map((k) => k.tick).sort((a, b) => a - b);
  const nextK = killTicks.find((kt) => kt > t);
  if (nextK === undefined) return;
  const idx = ticks.value.findIndex((tt) => tt >= nextK);
  if (idx >= 0) {
    pause();
    tickIndex.value = idx;
    fractional.value = 0;
  }
}
onUnmounted(pause);

// Keyboard shortcuts. Active only while the viewer is mounted; ignored
// when focus is in a form control so the round dropdown / scrubber etc.
// keep their native key handling.
//   Space          play / pause
//   ←  →           step  −1 / +1 sample (Shift = ±10)
//   [  ]           previous / next round
//   1 2 3 4 5      speed 0.5× / 1× / 2× / 4× / 8×
//   Esc            pause
function onKeyDown(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  const tag = t?.tagName;
  // Only true TEXT entry should swallow shortcuts. A focused slider (the
  // seeker), <select> (speed) or <button> must NOT block Space.
  const textEntry =
    !!t &&
    (t.isContentEditable ||
      tag === "TEXTAREA" ||
      (tag === "INPUT" &&
        !["range", "checkbox", "radio", "button", "submit"].includes(
          (t as HTMLInputElement).type,
        )));

  // Space / K = play-pause, ALWAYS (even if a slider/select/button has focus
  // after a click). Blur the focused control so the browser doesn't also
  // re-activate it on Space.
  if ((e.key === " " || e.key === "k" || e.key === "K") && !textEntry) {
    e.preventDefault();
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
    ) {
      document.activeElement.blur();
    }
    toggle();
    return;
  }

  // Other shortcuts skip while any input/select is focused.
  if (
    t &&
    (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable)
  ) {
    return;
  }
  switch (e.key) {
    case "ArrowLeft":
      e.preventDefault();
      step(e.shiftKey ? -10 : -1);
      return;
    case "ArrowRight":
      e.preventDefault();
      step(e.shiftKey ? 10 : 1);
      return;
    case "[":
      e.preventDefault();
      jumpToRound(-1);
      return;
    case "]":
      e.preventDefault();
      jumpToRound(1);
      return;
    case "Escape":
      pause();
      return;
  }
  if (e.key >= "1" && e.key <= "5") {
    const i = Number(e.key) - 1;
    if (SPEEDS[i] !== undefined) {
      speed.value = SPEEDS[i];
      e.preventDefault();
    }
  }
}
onMounted(() => window.addEventListener("keydown", onKeyDown));
onUnmounted(() => window.removeEventListener("keydown", onKeyDown));

// Dynamic radar sizing. The viewer can be embedded anywhere on a page
// with arbitrary chrome above it, so static `calc(100vh - 240px)` is
// always either too tight (radar shrinks for nothing) or too loose
// (radar overflows below the fold). Instead we measure the wrapper's
// distance from the top of the viewport and the playbar's height each
// frame the layout changes, and budget the rest of the viewport for
// the radar (minus a small safety margin). The result is bound to
// inline width/height so the box is exactly the largest square that
// fits without scrolling.
// Focus target: clicking a player in the roster pins them as the
// "focused" player. Their map marker is rendered last (so it sits on
// top of any overlapping kites) and gets a pulsing tac-amber halo.
// Click again to clear. Single-select — focusing a new player swaps
// the focus rather than stacking.
const focusedPlayerId = ref<string | null>(null);
function toggleFocus(sid: string) {
  focusedPlayerId.value = focusedPlayerId.value === sid ? null : sid;
}

// Marker style toggle: "number" shows the slot 1-5 in the kite, "avatar"
// shows the player's Steam avatar clipped to a circle. Persisted in
// localStorage so the user's pick survives reloads + popouts.
const REPLAY_MARKER_PREF_KEY = "5s.replay.marker_style";
const showAvatars = ref(true);
// Toggle for the round's death (kill-location) markers on the 2D radar.
const showDeaths = ref(true);
if (typeof window !== "undefined") {
  try {
    const pref = localStorage.getItem(REPLAY_MARKER_PREF_KEY);
    if (pref === "number") showAvatars.value = false;
  } catch {
    /* localStorage unavailable; default to avatar */
  }
}
watch(showAvatars, (v) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REPLAY_MARKER_PREF_KEY, v ? "avatar" : "number");
  } catch {
    /* private browsing or storage full — fail silent */
  }
});

// Per-feature visibility toggles for the bomb/kit overlays. Persisted
// per-key so a coach can hide the noise they don't care about (e.g.
// dropped kits during a casual playback) and have it stick across
// reloads + popouts. All default ON since these are the new
// affordances the user explicitly asked for; the toggles are escape
// hatches, not opt-in.
function persistedBool(key: string, defaultValue: boolean) {
  const r = ref(defaultValue);
  if (typeof window !== "undefined") {
    try {
      const v = localStorage.getItem(key);
      if (v === "0") r.value = false;
      else if (v === "1") r.value = true;
    } catch {
      /* localStorage unavailable */
    }
  }
  watch(r, (v) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {
      /* private browsing — fail silent */
    }
  });
  return r;
}
const showC4 = persistedBool("5s.replay.show_c4", true);
const showDefuser = persistedBool("5s.replay.show_defuser", true);
const showGroundBomb = persistedBool("5s.replay.show_ground_bomb", true);
const showGroundKits = persistedBool("5s.replay.show_ground_kits", true);
// Pathing always starts off — it's a heavy overlay, not a sticky preference.
const pathingMode = ref<PathingMode>("off");
// The Route button is a simple on/off for the live-tracing "progress" mode;
// the popover radios are how you reach the full-round path explicitly.
function togglePathing() {
  pathingMode.value = pathingMode.value === "off" ? "progress" : "off";
}

// ── Buy-round overlay ──────────────────────────────────────────────
// Optional mode (off by default): instead of one round at a time, stack
// every selected full-buy round on a shared "seconds since freezetime"
// clock so you can study utility + CT/T setups across all buys at once.
const overlayMode = ref(false);
const overlayWindowSec = ref(30); // slider 10..115
const overlaySelectedRounds = ref<Set<number>>(new Set());
const overlayElapsedSec = ref(0); // shared clock, 0..overlayWindowSec

// round → freeze-end tick (fall back to round start when the parser
// didn't capture a freeze_end). Rounds with neither are excluded.
const freezeEndByRound = computed(() => {
  const m = new Map<number, number>();
  for (const rt of props.demoRoundTicks ?? []) {
    if (rt.round == null) continue;
    const fe = rt.freeze_end_tick ?? rt.start_tick;
    if (fe != null) m.set(rt.round, fe);
  }
  return m;
});

// Full-buy rounds we actually have data for: either side ≥ FULL_MIN AND
// the round has positions AND a freeze-end to anchor the shared clock.
const fullBuyRounds = computed<number[]>(() => {
  const out: number[] = [];
  for (const r of props.roundEconomy ?? []) {
    if (!isFullBuyRound(moneyOf(r.lineup_1_money), moneyOf(r.lineup_2_money)))
      continue;
    if (!positionsByRound.value.has(r.round)) continue;
    if (!freezeEndByRound.value.has(r.round)) continue;
    out.push(r.round);
  }
  return out.sort((a, b) => a - b);
});

const overlayAvailable = computed(
  () => (props.roundEconomy?.length ?? 0) > 0 && fullBuyRounds.value.length > 0,
);

watch(overlayMode, (on) => {
  if (on && !overlayAvailable.value) {
    overlayMode.value = false;
    return;
  }
  if (on) {
    overlaySelectedRounds.value = new Set(fullBuyRounds.value);
    overlayElapsedSec.value = 0;
    pause();
  }
});

function toggleOverlayRound(round: number) {
  const next = new Set(overlaySelectedRounds.value);
  if (next.has(round)) next.delete(round);
  else next.add(round);
  overlaySelectedRounds.value = next;
}

// Per-round, per-player position samples — built only for selected
// rounds so cost scales with the selection, not the whole match.
const positionsByRoundPlayer = computed(() => {
  const out = new Map<number, Map<string, Position[]>>();
  if (!overlayMode.value) return out;
  for (const round of overlaySelectedRounds.value) {
    const list = positionsByRound.value.get(round);
    if (!list) continue;
    const pm = new Map<string, Position[]>();
    for (const p of list) {
      const sid = String(p.attacker_steam_id);
      if (!pm.has(sid)) pm.set(sid, []);
      pm.get(sid)!.push(p);
    }
    for (const arr of pm.values()) arr.sort((a, b) => a.tick - b.tick);
    out.set(round, pm);
  }
  return out;
});

// Linear-interpolated x/y/yaw at an absolute tick. Returns null before
// the player's first sample; alive=false once they've died.
function sampleAt(
  samples: Position[],
  tick: number,
): { x: number; y: number; yaw: number; alive: boolean } | null {
  if (!samples.length) return null;
  let a: Position | null = null;
  let b: Position | null = null;
  for (const p of samples) {
    if (p.tick <= tick) a = p;
    else {
      b = p;
      break;
    }
  }
  if (!a) return null;
  if (!b) {
    return { x: a.x, y: a.y, yaw: a.yaw ?? 0, alive: a.alive };
  }
  const span = Math.max(1, b.tick - a.tick);
  const k = Math.min(1, Math.max(0, (tick - a.tick) / span));
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    yaw: lerpAngle(a.yaw ?? 0, b.yaw ?? a.yaw ?? 0, k),
    alive: a.alive,
  };
}

// Flat list of live players across all selected rounds at the current
// shared clock — rendered as simple team dots. Utility is rendered by the
// shared detonation/in-flight markup (real throws).
const overlayActors = computed<
  Array<{ key: string; team: string | null; x: number; y: number }>
>(() => {
  if (!overlayMode.value) return [];
  const tr = props.tickRate || 64;
  const elapsedTicks = overlayElapsedSec.value * tr;
  const out: Array<{ key: string; team: string | null; x: number; y: number }> =
    [];
  for (const [round, pm] of positionsByRoundPlayer.value) {
    const fe = freezeEndByRound.value.get(round);
    if (fe == null) continue;
    const absTick = fe + elapsedTicks;
    for (const [sid, samples] of pm) {
      const s = sampleAt(samples, absTick);
      if (!s || !s.alive) continue;
      const proj = project({ x: s.x, y: s.y });
      out.push({
        key: `${round}-${sid}`,
        team: samples[0].attacker_team,
        x: proj.x,
        y: proj.y,
      });
    }
  }
  return out;
});

// Same as overlayActors but in raw game coords for the 3D scene (it does its
// own projection). Limited to the selected buy rounds.
const overlayActors3d = computed(() => {
  if (!overlayMode.value) return [];
  const tr = props.tickRate || 64;
  const elapsedTicks = overlayElapsedSec.value * tr;
  const out: Array<{ x: number; y: number; z: number; team: string | null }> = [];
  for (const [round, pm] of positionsByRoundPlayer.value) {
    const fe = freezeEndByRound.value.get(round);
    if (fe == null || !overlaySelectedRounds.value.has(round)) continue;
    const absTick = fe + elapsedTicks;
    for (const [, samples] of pm) {
      const s = sampleAt(samples, absTick);
      if (!s || !s.alive) continue;
      out.push({ x: s.x, y: s.y, z: s.z, team: samples[0].attacker_team });
    }
  }
  return out;
});

const layoutRootEl = ref<HTMLElement | null>(null);
// playbarRowEl is referenced from the in-radar overlay; kept here so
// ResizeObserver triggers when the overlay's wrap state changes.
const playbarRowEl = ref<HTMLElement | null>(null);
const playbarDockEl = ref<HTMLElement | null>(null);
// Map square side, fit to the smaller of available width/height so the
// whole map stays within the window bounds (no cropping).
const radarMaxPx = ref(560);

// Floating scoreboard: shown by default, toggleable. When visible it
// reserves horizontal room on the right so the map shrinks instead of
// being impeded by the overlay; hidden, the map reclaims the full width.
// Old floating scoreboard is replaced by the unified ReplayChrome; keep it off
// (this also zeroes scoreboardReserve so the map uses the full stage).
const showScoreboard = ref(false);
const SCOREBOARD_RESERVE = 416; // 400px panel + 16px breathing room
const scoreboardReserve = computed(() =>
  showScoreboard.value ? SCOREBOARD_RESERVE : 0,
);

// Detect the height of any persistent bottom chrome the app docks
// below the page slot. The biggest known case is `#main-bottom-dock`
// (the layout's teleport target for MatchAdminBottomBar) which lives
// in normal flow but takes vertical space the page content can't use.
// Measuring its rendered top vs viewport bottom is more reliable than
// scanning for fixed/sticky elements, because the dock is actually
// statically positioned.
function detectBottomChromeHeight(): number {
  if (typeof document === "undefined") return 0;
  let reserved = 0;
  const dock = document.getElementById("main-bottom-dock");
  if (dock) {
    const rect = dock.getBoundingClientRect();
    if (rect.height > 0) {
      // How much of the dock sits inside the viewport — that's the
      // amount we can't draw over.
      const overlap = Math.max(
        0,
        Math.min(rect.height, window.innerHeight - rect.top),
      );
      reserved = Math.max(reserved, overlap);
    }
  }
  return Math.ceil(reserved);
}

function recomputeRadarSize() {
  if (typeof window === "undefined") return;
  const root = layoutRootEl.value;
  if (!root) return;
  const rootRect = root.getBoundingClientRect();
  const SAFETY = 16;
  const bottomChrome = detectBottomChromeHeight();
  const dockH = playbarDockEl.value?.offsetHeight ?? 0;
  const availableH =
    window.innerHeight - rootRect.top - SAFETY - bottomChrome - dockH;
  // Fit the whole (square) map inside the window: bounded by BOTH the
  // available width (minus the scoreboard reserve) and height, so nothing
  // is cropped. The docked transport bar's height is already excluded from
  // availableH. Centers in the remaining left region.
  const availableW = rootRect.width - scoreboardReserve.value;
  radarMaxPx.value = Math.floor(Math.max(280, Math.min(availableH, availableW)));
}

// Re-fit the map when the scoreboard is toggled so it grows/shrinks to
// match the freed/reserved width.
watch(showScoreboard, () => recomputeRadarSize());


let radarRO: ResizeObserver | null = null;
onMounted(() => {
  recomputeRadarSize();
  if (typeof ResizeObserver !== "undefined" && layoutRootEl.value) {
    radarRO = new ResizeObserver(() => recomputeRadarSize());
    radarRO.observe(document.body);
    radarRO.observe(layoutRootEl.value);
    // Explicitly observe the layout's bottom dock so the radar
    // resizes the moment the admin bar expands/collapses (its
    // teleport target isn't a descendant of <body> changes that
    // would otherwise trigger the body observer reliably).
    const dock = document.getElementById("main-bottom-dock");
    if (dock) radarRO.observe(dock);
  }
  window.addEventListener("resize", recomputeRadarSize);
  // Re-measure once after fonts/images settle so the initial top
  // offset is right.
  requestAnimationFrame(() => recomputeRadarSize());
});
onUnmounted(() => {
  radarRO?.disconnect();
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", recomputeRadarSize);
  }
});

const SPEEDS = [0.5, 1, 2, 4, 8];

function colorFor(team: string | null) {
  if (team === "t") return "hsl(33, 94%, 58%)";
  if (team === "ct") return "hsl(210, 80%, 60%)";
  return "hsl(0, 0%, 60%)";
}

// Radius of the depleting lifetime ring drawn around a timed grenade,
// sized just outside each effect's footprint.
function grenadeRingRadius(type: Grenade["type"]): number {
  if (type === "Smoke") return 40;
  if (type === "Molotov") return 30;
  return 24; // Decoy
}

// Weapon icon shown above the radar token. Prefers the LIVE active
// weapon (rifle/pistol/knife/grenade equipped at this tick); falls back
// to the round's freeze-end loadout for demos parsed before the
// active_weapon field existed.
function loadoutWeaponIcon(steamId: string): string | null {
  const lo = loadoutBySteam.value.get(steamId);
  const base = weaponBasename(lo?.primary) || weaponBasename(lo?.secondary);
  return base ? `/img/equipment/${base}.svg` : null;
}
function tokenWeaponIcon(p: {
  steamId: string;
  activeWeapon: string | null;
}): string | null {
  if (p.activeWeapon) {
    const path = weaponIconPath(p.activeWeapon);
    if (path) return path;
  }
  return loadoutWeaponIcon(p.steamId);
}

// Volumetric smoke cloud built from overlapping soft puffs (CS-style)
// rather than one disc. dx/dy = offset from center, r = puff radius,
// d = deploy-stagger delay so the cloud billows out.
const SMOKE_PUFFS = [
  { dx: 0, dy: 0, r: 20, d: 0 },
  { dx: -15, dy: -7, r: 15, d: 0.12 },
  { dx: 14, dy: -9, r: 15, d: 0.1 },
  { dx: -11, dy: 11, r: 14, d: 0.22 },
  { dx: 12, dy: 11, r: 14, d: 0.18 },
  { dx: 0, dy: -17, r: 13, d: 0.3 },
  { dx: 18, dy: 2, r: 12, d: 0.26 },
  { dx: -18, dy: 3, r: 12, d: 0.34 },
  { dx: 3, dy: 16, r: 12, d: 0.3 },
];

// Molotov fire spread: a scatter of flame cells across the burn footprint
// so the pool reads as spreading fire, not one blob.
const FIRE_CELLS = [
  { dx: 0, dy: 0, r: 13, d: 0 },
  { dx: -13, dy: -4, r: 10, d: 0.1 },
  { dx: 12, dy: -6, r: 10, d: 0.14 },
  { dx: -8, dy: 10, r: 9, d: 0.2 },
  { dx: 10, dy: 9, r: 9, d: 0.18 },
  { dx: 2, dy: -13, r: 8, d: 0.26 },
  { dx: 16, dy: 3, r: 8, d: 0.24 },
  { dx: -16, dy: 2, r: 8, d: 0.3 },
];

function projectileIcon(type: Grenade["type"], team: string | null): string {
  const teamSlug = team === "t" ? "T" : "CT";
  const map: Record<Grenade["type"], string> = {
    Flash: "flashbang",
    HE: "frag",
    Smoke: "smoke",
    Molotov: "firebomb",
    Decoy: "smoke",
  };
  return `/radars/projectiles/projectile-img-${map[type]}-${teamSlug}.webp`;
}

function projectileSize(type: Grenade["type"]): number {
  if (type === "Smoke" || type === "Molotov") return 56;
  return 32;
}

// Demo-driven roster: derive every player who actually appears in the
// recorded match (positions + demoPlayers list) rather than relying on
// the DB lineup. Avoids "?" labels when the loaded demo doesn't match
// the match's configured lineup (e.g. dev importing a real match demo
// into a 1v1 match for testing).
type RosterEntry = {
  steamId: string;
  name: string;
  team: "ct" | "t" | null;
  slot: number;
  avatarUrl: string | null;
};

// Name resolution priority:
//   1. The `players` table row joined onto each position (live names
//      stay fresh, includes all 10 demo players when match lineup only
//      had a subset).
//   2. The demo file's own players JSONB (whatever the parser captured).
//   3. The configured match lineup (registered roster names).
//   4. The raw steam_id as last resort.
const playerNameMap = computed(() => {
  const out: Record<string, string> = {};
  for (const p of props.positions ?? []) {
    const id = String(p.attacker_steam_id);
    const name = p.player?.name;
    if (name && !out[id]) out[id] = name;
  }
  for (const dp of props.demoPlayers ?? []) {
    if (!dp?.steam_id) continue;
    const id = String(dp.steam_id);
    if (!out[id] && dp.name) out[id] = dp.name;
  }
  for (const side of ["lineup_1", "lineup_2"] as const) {
    const lineup = props.match?.[side];
    for (const m of lineup?.lineup_players ?? []) {
      const sid = m.player?.steam_id ?? m.steam_id;
      if (sid == null) continue;
      const id = String(sid);
      if (!out[id]) out[id] = m.player?.name ?? m.placeholder_name ?? id;
    }
  }
  return out;
});

// steam_id → avatar URL. Same priority chain as the name map: live
// player join on positions wins, then the match lineup roster, then
// nothing (no avatars in the demo file itself).
const playerAvatarMap = computed(() => {
  const out: Record<string, string> = {};
  for (const p of props.positions ?? []) {
    const id = String(p.attacker_steam_id);
    const a = p.player?.avatar_url;
    if (a && !out[id]) out[id] = a;
  }
  for (const side of ["lineup_1", "lineup_2"] as const) {
    const lineup = props.match?.[side];
    for (const m of lineup?.lineup_players ?? []) {
      // `steam_id` lives on the joined `player` object — the lineup
      // queries we use don't select it at the top of lineup_players,
      // so reading `m.steam_id` directly always failed silently.
      const sid = m.player?.steam_id ?? m.steam_id;
      if (sid == null) continue;
      const id = String(sid);
      const a = m.player?.avatar_url;
      if (a && !out[id]) out[id] = a;
    }
  }
  return out;
});

// Each player's canonical team uses their FIRST round position sample
// for stable slot numbering (CT 1–5 / T 1–5 doesn't shuffle as the
// match progresses). Legend grouping uses the current round's side
// instead, so after halftime the listing follows the swap.
const firstSideByPlayer = computed(() => {
  const out: Record<string, "ct" | "t" | null> = {};
  for (const p of dedupedPositions.value) {
    const sid = String(p.attacker_steam_id);
    if (out[sid] !== undefined) continue;
    out[sid] =
      p.attacker_team === "ct" || p.attacker_team === "t"
        ? p.attacker_team
        : null;
  }
  return out;
});

const sideByPlayerCurrentRound = computed(() => {
  const out: Record<string, "ct" | "t" | null> = {};
  if (activeRound.value === null) return out;
  const samples = positionsByRound.value.get(activeRound.value) ?? [];
  // Majority of round samples (some early ticks may report a stale
  // team if the engine hadn't settled when sampling fired).
  const counts: Record<string, { ct: number; t: number }> = {};
  for (const p of samples) {
    const sid = String(p.attacker_steam_id);
    if (!counts[sid]) counts[sid] = { ct: 0, t: 0 };
    if (p.attacker_team === "ct") counts[sid].ct++;
    else if (p.attacker_team === "t") counts[sid].t++;
  }
  for (const sid of Object.keys(counts)) {
    const c = counts[sid];
    out[sid] = c.ct > c.t ? "ct" : c.t > 0 ? "t" : null;
  }
  return out;
});

const roster = computed<RosterEntry[]>(() => {
  const seen = new Set<string>();
  const ct: RosterEntry[] = [];
  const t: RosterEntry[] = [];
  // Source IDs: positions tell us who actually played; merge demo
  // player list so we have names even for players who never moved.
  const ids = new Set<string>();
  for (const p of dedupedPositions.value) ids.add(String(p.attacker_steam_id));
  for (const dp of props.demoPlayers ?? []) {
    if (dp?.steam_id) ids.add(String(dp.steam_id));
  }
  // Stable order by steam_id so slot numbering is deterministic.
  const sorted = [...ids].sort();
  for (const id of sorted) {
    if (seen.has(id)) continue;
    seen.add(id);
    const team = firstSideByPlayer.value[id] ?? null;
    const entry: RosterEntry = {
      steamId: id,
      name: playerNameMap.value[id] ?? id,
      team,
      slot: 0,
      avatarUrl: playerAvatarMap.value[id] ?? null,
    };
    if (team === "ct") ct.push(entry);
    else if (team === "t") t.push(entry);
    else ct.push(entry);
  }
  ct.forEach((e, i) => (e.slot = i + 1));
  t.forEach((e, i) => (e.slot = i + 1));
  return [...ct, ...t];
});

const slotByPlayer = computed(() => {
  const out: Record<string, { slot: number; team: "ct" | "t" | null }> = {};
  for (const r of roster.value) {
    out[r.steamId] = { slot: r.slot, team: r.team };
  }
  return out;
});

function playerName(steamId: string): string {
  return playerNameMap.value[String(steamId)] ?? String(steamId);
}

// Per-player running stats. Kills/Deaths/Assists are tick-bounded so
// they match the kill feed; damage is round-bounded (the damages we
// have only carry round + wall-clock time, no engine tick) and limited
// to rounds strictly before the active one so the current round's
// damage doesn't leak before its kills resolve.
type PlayerStats = { k: number; d: number; a: number; dmg: number };
const playerStats = computed(() => {
  const out = new Map<string, PlayerStats>();
  const get = (sid: string): PlayerStats => {
    let s = out.get(sid);
    if (!s) {
      s = { k: 0, d: 0, a: 0, dmg: 0 };
      out.set(sid, s);
    }
    return s;
  };
  const cursor = currentTick.value;
  for (const k of props.demoKills ?? []) {
    if (k.tick > cursor) continue;
    if (k.killer) get(String(k.killer)).k++;
    if (k.victim) get(String(k.victim)).d++;
    if (k.assist) get(String(k.assist)).a++;
  }
  const activeR = activeRound.value ?? 0;
  for (const d of props.damages ?? []) {
    if (d.round >= activeR) continue;
    if (!d.attacker_steam_id) continue;
    get(String(d.attacker_steam_id)).dmg += d.damage ?? 0;
  }
  return out;
});
function statsFor(sid: string): PlayerStats {
  return playerStats.value.get(sid) ?? { k: 0, d: 0, a: 0, dmg: 0 };
}
function kdrText(s: PlayerStats): string {
  if (s.d === 0) return s.k > 0 ? s.k.toFixed(2) : "0.00";
  return (s.k / s.d).toFixed(2);
}
function followLabelFor(focused: boolean, name: string): string {
  return focused
    ? t("match.replay.follow_stop")
    : t("match.replay.follow_player", { name });
}
// Per-steamId lookup for the live carrier / defuser / action flags.
// Backed by interpolatedPlayers so it tracks the playhead and avoids
// repeatedly scanning the array from inside template expressions.
const interpBySteamId = computed(() => {
  const out = new Map<string, (typeof interpolatedPlayers.value)[number]>();
  for (const p of interpolatedPlayers.value) out.set(p.steamId, p);
  return out;
});
function hasBombFor(sid: string): boolean {
  return interpBySteamId.value.get(sid)?.hasBomb === true;
}
function hasDefuserFor(sid: string): boolean {
  return interpBySteamId.value.get(sid)?.hasDefuser === true;
}
function bombActionFor(sid: string): BombInteraction {
  return interpBySteamId.value.get(sid)?.bombAction ?? null;
}
// Ground-marker hover state. Keyed so we can show a hover halo on a
// specific kit / the bomb without using CSS :hover (which is
// unreliable on SVG <g> children once you start nesting transforms +
// scoped styles).
const hoveredGroundMarker = ref<string | null>(null);
// Currently-hovered player steam_id on the map, drives the inline
// foreignObject tooltip on the kite. Same approach as the ground
// markers for visual consistency.
const hoveredPlayerSid = ref<string | null>(null);

// Tooltip content for a dropped defuse kit. Returns the label +
// dropper name as a small typed object so the template can format
// each line independently.
function groundKitTooltip(k: DemoKitDrop): { title: string; sub: string } {
  const who = k.player ? playerName(k.player) : "unknown";
  return { title: "Defuse kit", sub: `Dropped by ${who}` };
}
// Tooltip content for the bomb-on-ground marker. Walks the active
// round's bomb timeline up to the cursor to find the event that
// produced the current position (last drop or plant).
const groundBombTooltip = computed<{ title: string; sub: string }>(() => {
  if (!groundBombAt.value) return { title: "", sub: "" };
  const cursor = currentTick.value;
  let last: DemoBomb | null = null;
  for (const b of activeRoundBombs.value) {
    if (b.tick > cursor) break;
    if (b.type === "dropped" || b.type === "planted") last = b;
    else if (
      b.type === "pickup" ||
      b.type === "defused" ||
      b.type === "exploded"
    )
      last = null;
  }
  if (!last) return { title: "Bomb", sub: "" };
  const who = last.player ? playerName(last.player) : "unknown";
  if (last.type === "planted") {
    return {
      title: `Bomb planted${last.site ? ` (${last.site})` : ""}`,
      sub: `By ${who}`,
    };
  }
  return { title: "Bomb dropped", sub: `By ${who}` };
});

// Structured player tooltip data. The template renders this as a
// styled card; the field names mirror what the kill feed + lineup
// already show so a hover surfaces the same vocabulary.
type PlayerTooltip = {
  name: string;
  team: "ct" | "t" | null;
  status: string | null; // DEAD or "<N> HP / <A> AR"
  bombFlags: string[]; // HAS BOMB / DEFUSE KIT / PLANTING… / DEFUSING…
  k: number;
  d: number;
  a: number;
  kdr: string;
  kdrNum: number;
  dmg: number;
};
function playerTooltipFor(sid: string): PlayerTooltip {
  const s = statsFor(sid);
  const live = liveStateBySteam.value.get(sid);
  const interp = interpolatedPlayers.value.find((ip) => ip.steamId === sid);
  const flags: string[] = [];
  if (interp?.hasBomb) flags.push("HAS BOMB");
  if (interp?.hasDefuser && interp?.bombAction !== "defusing") {
    flags.push("DEFUSE KIT");
  }
  if (interp?.bombAction === "planting") flags.push("PLANTING…");
  else if (interp?.bombAction === "defusing") flags.push("DEFUSING…");

  let status: string | null = null;
  if (live?.alive === false) {
    status = "DEAD";
  } else if (live?.health != null) {
    const hp = live.health;
    const ar = live.armor;
    if (ar != null && ar > 0) {
      const kit = live.helmet ? "kevlar+helmet" : "kevlar";
      status = `${hp} HP / ${ar} AR (${kit})`;
    } else {
      status = `${hp} HP`;
    }
  }

  return {
    name: playerName(sid),
    team:
      interp?.team === "ct" || interp?.team === "t"
        ? interp.team
        : (slotByPlayer.value[sid]?.team ?? null),
    status,
    bombFlags: flags,
    k: s.k,
    d: s.d,
    a: s.a,
    kdr: kdrText(s),
    kdrNum: s.d > 0 ? s.k / s.d : s.k,
    dmg: s.dmg,
  };
}

// Legend grouping follows the CURRENT round's side mapping. Slot
// numbers come from the canonical (round-1) side so 1–5 stay with
// each player across halftime even when their color swaps.
const lineupRows = computed(() => {
  const sides = sideByPlayerCurrentRound.value;
  const ct: RosterEntry[] = [];
  const t: RosterEntry[] = [];
  for (const r of roster.value) {
    const side = sides[r.steamId] ?? r.team;
    if (side === "ct") ct.push(r);
    else if (side === "t") t.push(r);
    else ct.push(r);
  }
  return { ct, t };
});

// Live scoreboard. We don't want the final match_map score — that
// "spoils" the result before playback even reaches it. Instead, walk
// the demo's round_ticks and count wins ONLY for rounds strictly
// before activeRound, so the score reflects what was on the board
// when each round started.
//
// Mapping winner (ct/t) → lineup_1/lineup_2 requires the side a player
// was on during that round, since CS2 swaps sides at halftime. We
// build a per-round side map from positions data, then look up the
// lineup membership of any one player on the winning side to credit
// the right team. Falls back to the static match_map score if we
// can't determine lineup membership (e.g. imported demo with no
// matching lineup roster).
const lineupBySteam = computed(() => {
  const m = new Map<string, "1" | "2">();
  for (const lp of props.match?.lineup_1?.lineup_players ?? []) {
    const sid = String(lp.player?.steam_id ?? "");
    if (sid) m.set(sid, "1");
  }
  for (const lp of props.match?.lineup_2?.lineup_players ?? []) {
    const sid = String(lp.player?.steam_id ?? "");
    if (sid) m.set(sid, "2");
  }
  return m;
});

const sideByRound = computed(() => {
  const out = new Map<number, Map<string, "ct" | "t">>();
  for (const [round, samples] of positionsByRound.value) {
    const counts: Record<string, { ct: number; t: number }> = {};
    for (const p of samples) {
      const sid = String(p.attacker_steam_id);
      if (!counts[sid]) counts[sid] = { ct: 0, t: 0 };
      if (p.attacker_team === "ct") counts[sid].ct++;
      else if (p.attacker_team === "t") counts[sid].t++;
    }
    const m = new Map<string, "ct" | "t">();
    for (const sid of Object.keys(counts)) {
      const c = counts[sid];
      if (c.ct > c.t) m.set(sid, "ct");
      else if (c.t > 0) m.set(sid, "t");
    }
    out.set(round, m);
  }
  return out;
});

const roundStripEntries = computed(() => {
  const winnerByRound = new Map<number, string | null>();
  for (const rt of props.demoRoundTicks ?? []) {
    if (typeof rt.round === "number") {
      winnerByRound.set(rt.round, rt.winner ?? null);
    }
  }
  return rounds.value.map((round) => {
    const w = winnerByRound.get(round);
    const winnerSide: "CT" | "T" | null =
      w === "ct" ? "CT" : w === "t" ? "T" : null;
    return { round, winnerSide };
  });
});

// Halftime divider: track a reference player's side across rounds; the
// swap is the first round where it flips from round one's assignment.
const roundStripHalftime = computed<number | null>(() => {
  const rs = rounds.value;
  if (rs.length < 2) {
    return null;
  }
  const sbr = sideByRound.value;
  const firstSides = sbr.get(rs[0]);
  if (!firstSides || !firstSides.size) {
    return null;
  }
  const refSid = [...firstSides.keys()][0];
  const refSide = firstSides.get(refSid);
  for (let i = 1; i < rs.length; i++) {
    const s = sbr.get(rs[i])?.get(refSid);
    if (s && refSide && s !== refSide) {
      return i;
    }
  }
  return null;
});

function selectStripRound(round: number | null) {
  if (round != null) {
    activeRound.value = round;
  }
}

const liveScore = computed<{ lineup_1: number; lineup_2: number }>(() => {
  const cur = activeRound.value;
  if (cur === null || cur <= 1) return { lineup_1: 0, lineup_2: 0 };
  const rts = props.demoRoundTicks ?? [];
  const lbs = lineupBySteam.value;
  const sbr = sideByRound.value;
  let l1 = 0;
  let l2 = 0;
  for (const rt of rts) {
    const r = rt.round ?? 0;
    if (r < 1 || r >= cur) continue;
    if (!rt.winner) continue;
    const sides = sbr.get(r);
    if (!sides) continue;
    let creditedLineup: "1" | "2" | null = null;
    for (const [sid, side] of sides) {
      if (side === rt.winner) {
        const lu = lbs.get(sid);
        if (lu) {
          creditedLineup = lu;
          break;
        }
      }
    }
    if (creditedLineup === "1") l1++;
    else if (creditedLineup === "2") l2++;
  }
  return { lineup_1: l1, lineup_2: l2 };
});

const scoreboard = computed(() => {
  const l1 = props.match?.lineup_1;
  const l2 = props.match?.lineup_2;
  // Fall back to the static match_map score when we can't roll up
  // round-by-round (e.g. round_ticks lack winner info on legacy demos
  // parsed before that field shipped).
  const live = liveScore.value;
  const haveLive = (props.demoRoundTicks ?? []).some((r) => !!r.winner);
  let leftScore = live.lineup_1;
  let rightScore = live.lineup_2;
  if (!haveLive) {
    const maps = props.match?.match_maps ?? [];
    const mm = maps.find((m: any) => m?.map?.name === props.mapName) ?? maps[0];
    leftScore = mm?.lineup_1_score ?? 0;
    rightScore = mm?.lineup_2_score ?? 0;
  }
  return {
    leftName: l1?.name ?? t("match.lineup.lineup_1"),
    rightName: l2?.name ?? t("match.lineup.lineup_2"),
    leftScore,
    rightScore,
  };
});

// Per-side score for the active round. scoreboard credits lineup_1 /
// lineup_2 (fixed teams); the floating roster cards are keyed by side
// (ct/t), which swaps at halftime — so map each lineup's score onto the
// side that lineup is actually playing this round. Falls back to
// lineup_1 = ct when we can't resolve membership (imported demos).
const sideScores = computed<{ ct: number; t: number }>(() => {
  const sb = scoreboard.value;
  const round = activeRound.value;
  const sides = round === null ? null : sideByRound.value.get(round);
  const lbs = lineupBySteam.value;
  let ctLineup: "1" | "2" | null = null;
  if (sides) {
    for (const [sid, side] of sides) {
      const lu = lbs.get(sid);
      if (lu) {
        ctLineup = side === "ct" ? lu : lu === "1" ? "2" : "1";
        break;
      }
    }
  }
  if (ctLineup === "2") return { ct: sb.rightScore, t: sb.leftScore };
  return { ct: sb.leftScore, t: sb.rightScore };
});

// Compact HUD payload for the 3D viewer's top score/round/timer readout.
const hud3d = computed(() => {
  const ss = sideScores.value;
  let aliveCt = 0;
  let aliveT = 0;
  for (const p of interpolatedPlayers.value) {
    if (!p.alive) continue;
    if (p.team === "ct") aliveCt++;
    else if (p.team === "t") aliveT++;
  }
  const tm = timer.value;
  const clock =
    tm.phase === "bomb"
      ? `\u{1F4A3} ${formatMMSS(tm.secondsRemaining)}`
      : formatMMSS(tm.secondsRemaining);
  return {
    round: activeRoundTick.value?.round ?? (activeRound.value ?? 0) + 1,
    ct: ss.ct,
    t: ss.t,
    clock,
    aliveCt,
    aliveT,
  };
});

// Full scoreboard rows for the 3D overlay (CT/T), Replay3D-styled.
const scoreboard3d = computed(() => {
  const live = liveStateBySteam.value;
  const load = loadoutBySteam.value;
  const build = (rows: RosterEntry[]) =>
    rows.map((r) => {
      const st = statsFor(r.steamId);
      const ls = live.get(r.steamId);
      const lo = load.get(r.steamId);
      return {
        sid: r.steamId,
        name: r.name,
        k: st.k,
        d: st.d,
        a: st.a,
        alive: ls?.alive ?? false,
        hp: ls?.health ?? 0,
        primary: lo?.primary ?? null,
        flash: lo?.flash ?? 0,
        smoke: lo?.smoke ?? 0,
        he: lo?.he ?? 0,
        molotov: lo?.molotov ?? 0,
        decoy: lo?.decoy ?? 0,
        kit: lo?.kit ?? false,
        hasBomb: hasBombFor(r.steamId),
      };
    });
  return { ct: build(lineupRows.value.ct), t: build(lineupRows.value.t) };
});

// Play-by-play for the active round: kills + utility + bomb, up to cursor.
const pbp3d = computed(() => {
  const cursor = currentTick.value;
  const rt = activeRoundTick.value;
  const fe = rt?.freeze_end_tick ?? rt?.start_tick ?? 0;
  const rate = props.tickRate || 64;
  const names = playerNameMap.value;
  const evts: Array<{ t: number; kind: string; a?: string; b?: string; w?: string; hs?: boolean; team?: string | null; gid?: number | null }> = [];
  for (const k of killsByRound.value.get(activeRound.value ?? -1) ?? []) {
    if (k.tick > cursor) continue;
    evts.push({ t: k.tick, kind: "kill", a: names[String(k.killer ?? "")] ?? "", b: names[String(k.victim ?? "")] ?? "", w: k.weapon ?? "", hs: !!k.headshot, team: k.killer_team ?? null });
  }
  for (const g of roundGrenades.value) {
    if (g.phase !== "thrown" || g.tick > cursor) continue;
    evts.push({ t: g.tick, kind: "util", a: names[String(g.thrower_steam_id ?? "")] ?? "", w: g.type, team: g.thrower_team ?? null, gid: g.grenade_id ?? null });
  }
  for (const b of activeRoundBombs.value) {
    if (b.tick > cursor) continue;
    if (b.type === "planted") evts.push({ t: b.tick, kind: "bomb", a: names[String(b.player ?? "")] ?? "", w: "planted" });
    else if (b.type === "defused") evts.push({ t: b.tick, kind: "bomb", a: names[String(b.player ?? "")] ?? "", w: "defused" });
  }
  // Whole round, newest first — the PBP panel is scrollable.
  evts.sort((x, y) => y.t - x.t);
  return evts.map((e) => ({ ...e, sec: Math.max(0, Math.round((e.t - fe) / rate)) }));
});

// Every utility thrown this round (for ghosts / line highlight / heatmap),
// keyed by grenade_id with its throw origin + thrower + landing.
const roundUtilities = computed(() => {
  const t2d = grenadePairs.value.throwToDet;
  const names = playerNameMap.value;
  const out: Array<{
    gid: number | null;
    type: string;
    team: string | null;
    name: string;
    ox: number; oy: number; oz: number;
    dx: number | null; dy: number | null; dz: number | null;
  }> = [];
  for (const g of roundGrenades.value) {
    if (g.phase !== "thrown") continue;
    const det = t2d.get(g);
    const land = det ? resolveGrenadePosition(det) : null;
    out.push({
      gid: g.grenade_id ?? null,
      type: g.type,
      team: g.thrower_team ?? null,
      name: names[String(g.thrower_steam_id ?? "")] ?? "",
      ox: g.x, oy: g.y, oz: g.z,
      dx: land?.x ?? null, dy: land?.y ?? null, dz: land?.z ?? null,
    });
  }
  return out;
});

// steam_id → live { health, armor, alive } for the lineup panel so we
// can render HP + armor bars next to each name (Boltobserv/HLTV-style).
const liveStateBySteam = computed(() => {
  const m = new Map<
    string,
    {
      health: number | null;
      armor: number | null;
      helmet: boolean;
      alive: boolean;
    }
  >();
  for (const p of interpolatedPlayers.value) {
    m.set(p.steamId, {
      health: p.health,
      armor: p.armor,
      helmet: p.helmet,
      alive: p.alive,
    });
  }
  return m;
});

const GRENADE_ICONS: Record<Grenade["type"], string> = {
  Flash: "/img/equipment/flashbang.svg",
  Smoke: "/img/equipment/smokegrenade.svg",
  HE: "/img/equipment/hegrenade.svg",
  Molotov: "/img/equipment/molotov.svg",
  Decoy: "/img/equipment/decoy.svg",
};
function grenadeIconPath(type: Grenade["type"]): string {
  return GRENADE_ICONS[type] ?? "";
}

// "Pop out" the replay into a free-floating window. Opens a new route
// (pages/match-replay-popout/[matchMapId].vue) that mounts a fresh
// ReplayViewer. To avoid re-querying everything we already have loaded
// here, we stash the current props onto `window.__replayHandoff` keyed
// by match-map id; the popout child reads `window.opener.__replayHandoff[id]`
// on mount and skips its own Apollo queries when present. Falls back
// to fetching if the user navigated to /match-replay-popout/ directly.
function openReplayPopout() {
  if (typeof window === "undefined") return;
  const mmId = (props.match?.match_maps ?? []).find(
    (mm: any) => mm?.id && mm?.map?.name === props.mapName,
  )?.id;
  if (!mmId) return;
  const w = window as any;
  w.__replayHandoff = w.__replayHandoff ?? {};
  w.__replayHandoff[mmId] = {
    match: props.match,
    positions: props.positions,
    grenades: props.grenades,
    shots: props.shots,
    damages: props.damages,
    demoPlayers: props.demoPlayers,
    demoKills: props.demoKills,
    demoBombs: props.demoBombs,
    demoKitDrops: props.demoKitDrops,
    demoRoundTicks: props.demoRoundTicks,
    roundInventory: props.roundInventory,
    roundEconomy: props.roundEconomy,
    tickRate: props.tickRate,
    mapName: props.mapName,
  };
  const url = `/match-replay-popout/${mmId}`;
  window.open(
    url,
    `replay-popout-${mmId}`,
    "popup=yes,width=1100,height=900,resizable=yes,scrollbars=yes",
  );
}

// ===================================================================
// Unified chrome (ReplayChrome) adapters — map ReplayViewer's live
// playback state onto Replay3D's bp-* chrome shape so 2D and 3D share
// ONE identical chrome. Only the map underneath differs.
// ===================================================================
const camMode = ref<"orbit" | "top" | "follow">("orbit");
const heatOn = ref(false);
const showPbpPanel = ref(true);
const selectedGi = ref<number[]>([]);
const utilTypeFilter = ref<Record<string, boolean>>({
  Smoke: true,
  Molotov: true,
  HE: true,
  Flash: true,
  Decoy: true,
});
const CT_HEX = "hsl(210, 80%, 60%)";
const T_HEX = "hsl(33, 94%, 58%)";

function nadeArray(lo: RoundInventoryEntry | undefined): string[] {
  if (!lo) return [];
  const out: string[] = [];
  for (let i = 0; i < (lo.flash ?? 0); i++) out.push("flash");
  for (let i = 0; i < (lo.smoke ?? 0); i++) out.push("smoke");
  for (let i = 0; i < (lo.he ?? 0); i++) out.push("he");
  for (let i = 0; i < (lo.molotov ?? 0); i++) out.push("molotov");
  for (let i = 0; i < (lo.decoy ?? 0); i++) out.push("decoy");
  return out;
}
function buildChromeRows(rows: RosterEntry[], side: number) {
  const live = liveStateBySteam.value;
  const load = loadoutBySteam.value;
  return rows.map((r, n) => {
    const st = statsFor(r.steamId);
    const ls = live.get(r.steamId);
    const lo = load.get(r.steamId);
    return {
      sid: r.steamId,
      idx: side * 5 + n,
      name: r.name,
      side,
      alive: ls?.alive ?? false,
      hp: ls?.alive ? (ls?.health ?? 0) : 0,
      armor: ls?.armor ?? 0,
      helmet: ls?.helmet ?? false,
      k: st.k,
      d: st.d,
      a: st.a,
      dmg: st.dmg,
      weapon: lo?.primary || lo?.secondary || null,
      nades: nadeArray(lo),
      bomb: hasBombFor(r.steamId),
      kit: lo?.kit ?? false,
      avatarUrl: r.avatarUrl,
    };
  });
}
const chromeTeamA = computed(() => buildChromeRows(lineupRows.value.ct, 0));
const chromeTeamB = computed(() => buildChromeRows(lineupRows.value.t, 1));
const chromeAliveA = computed(
  () => chromeTeamA.value.filter((r) => r.alive).length,
);
const chromeAliveB = computed(
  () => chromeTeamB.value.filter((r) => r.alive).length,
);
const chromeHud = computed(() => {
  const ss = sideScores.value;
  const tm = timer.value;
  return {
    ct: ss.ct,
    t: ss.t,
    round: activeRoundTick.value?.round ?? (activeRound.value ?? 0),
    clock: formatMMSS(tm.secondsRemaining),
    bomb: tm.phase === "bomb" ? `C4 ${tm.secondsRemaining}s` : "",
    bombClass: tm.phase === "bomb" ? "bomb" : tm.phase === "freeze" ? "ct" : "",
  };
});
const chromeFeed = computed(() =>
  killFeedDisplay.value.slice(0, 6).map((k: any) => ({
    k: playerNameMap.value[String(k.killer ?? "")] ?? "",
    v: playerNameMap.value[String(k.victim ?? "")] ?? "",
    weapon: k.weapon ?? "",
    hs: !!k.headshot,
    kc: colorFor(k.killer_team ?? null),
    vc: colorFor(k.victim_team ?? null),
  })),
);
const chromePbp = computed(() =>
  pbp3d.value.map((e: any) => {
    if (e.kind === "kill")
      return {
        time: `${e.sec}s`,
        killer: e.a,
        victim: e.b,
        weapon: e.w,
        hs: e.hs,
        kc: colorFor(e.team ?? null),
        vc: "#9fb0c0",
      };
    if (e.kind === "util")
      return { time: `${e.sec}s`, util: e.w, thrower: e.a, tc: colorFor(e.team ?? null), gi: e.gid ?? undefined };
    return { time: `${e.sec}s`, bomb: e.w };
  }),
);
const chromeRounds = computed(() =>
  rounds.value.map((rn) => {
    const rt = (props.demoRoundTicks ?? []).find((r) => r.round === rn);
    const w = rt?.winner;
    return { i: rn, n: rn, win: w === "ct" ? 0 : w === "t" ? 1 : -1 };
  }),
);
const chromeUtilMarkers = computed(() => {
  const nameByGid = new Map<number, string>();
  for (const u of roundUtilities.value) if (u.gid != null) nameByGid.set(u.gid, u.name);
  return scrubberMarkers.value
    .filter((m) => m.lane === "nade" && m.icon)
    .map((m) => ({
      frac: m.left / 100,
      icon: m.icon as string,
      gi: m.gid,
      name: (m.gid != null && nameByGid.get(m.gid)) || "",
      type: m.title,
    }));
});
// Toggle a utility selection (from PBP click, seek-bar icon, or 3D line).
function toggleUtilSel(gi: number) {
  if (gi == null) return;
  selectedGi.value = selectedGi.value.includes(gi)
    ? selectedGi.value.filter((x) => x !== gi)
    : [...selectedGi.value, gi];
}
const chromeTickMarkers = computed(() =>
  scrubberMarkers.value
    .filter((m) => m.lane === "kill")
    .map((m) => ({
      frac: m.left / 100,
      cls:
        m.color === SCRUB_KILL_CT
          ? "mk-ct"
          : m.color === SCRUB_KILL_T
            ? "mk-t"
            : "mk-ct",
    })),
);
const chromeSeekFrac = computed(() =>
  overlayMode.value ? overlayProgressPct.value / 100 : progressPct.value / 100,
);
const chromeTimeLabel = computed(() =>
  overlayMode.value
    ? `${formatMMSS(overlayElapsedSec.value)} / ${formatMMSS(overlayWindowSec.value)}`
    : `${formatMMSS(tickIndex.value * 0.25)} / ${formatMMSS(Math.max(0, ticks.value.length - 1) * 0.25)}`,
);
const chromeFollowName = computed(
  () =>
    (focusedPlayerId.value &&
      playerNameMap.value[String(focusedPlayerId.value)]) ||
    null,
);

function chromeSeek(frac: number) {
  pause();
  if (overlayMode.value) {
    overlayElapsedSec.value = Math.max(0, Math.min(overlayWindowSec.value, frac * overlayWindowSec.value));
    return;
  }
  tickIndex.value = Math.max(
    0,
    Math.min(ticks.value.length - 1, Math.round(frac * (ticks.value.length - 1))),
  );
  fractional.value = 0;
}
function chromeSpeed(s: number) {
  speed.value = s;
}
function chromeSelectRound(rn: number) {
  pause();
  activeRound.value = rn;
  tickIndex.value = 0;
  fractional.value = 0;
}
function chromeMode(m: string) {
  camMode.value = m as "orbit" | "top" | "follow";
}
const overlayRoundsArr = computed(() => Array.from(overlaySelectedRounds.value));
// Default-select the full-buy rounds the moment overlay is enabled; the user
// can then toggle any round tab in/out.
watch(overlayMode, (on) => {
  if (on) {
    heatOn.value = false; // heatmap isn't relevant while stacking buy rounds
    if (overlaySelectedRounds.value.size === 0) {
      overlaySelectedRounds.value = new Set(fullBuyRounds.value);
    }
  }
});
</script>

<template>
  <div class="flex flex-col gap-3 flex-1 min-h-0">
    <div
      ref="layoutRootEl"
      class="relative w-full flex-1 min-h-0 overflow-hidden"
    >
      <!-- Map square, fit + centered in the stage. The scoreboard floats at
           the right edge; the transport bar is docked below and pinned to
           the bottom by this flex-1 stage. -->
      <div
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 overflow-hidden transition-[width,height,left] duration-300 ease-out"
        :style="{
          width: radarMaxPx + 'px',
          height: radarMaxPx + 'px',
          left: `calc(50% - ${scoreboardReserve / 2}px)`,
        }"
      >
          <img
            v-if="radarSrc"
            v-show="viewMode === '2d'"
            :src="radarSrc"
            class="absolute inset-0 w-full h-full object-cover opacity-90"
            @error="radarFailed = true"
          />

          <svg
            v-show="viewMode === '2d'"
            :viewBox="`0 0 ${CANVAS} ${CANVAS}`"
            class="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <!-- Volumetric smoke filter: turbulence-displaced edges that
                 slowly evolve. The animated baseFrequency on the
                 feTurbulence creates the "drifting" look. -->
              <filter
                id="smoke-displace"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.014 0.018"
                  numOctaves="2"
                  seed="3"
                  result="noise"
                >
                  <animate
                    attributeName="baseFrequency"
                    values="0.014 0.018;0.022 0.014;0.014 0.018"
                    dur="14s"
                    repeatCount="indefinite"
                  />
                </feTurbulence>
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="14"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
                <feGaussianBlur stdDeviation="1.2" />
              </filter>

              <!-- Soft outer halo for smoke -->
              <radialGradient id="smoke-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(245,245,245,0.55)" />
                <stop offset="55%" stop-color="rgba(210,210,210,0.42)" />
                <stop offset="100%" stop-color="rgba(180,180,180,0)" />
              </radialGradient>

              <!-- Fire turbulence: faster, more chaotic than smoke. -->
              <filter
                id="fire-displace"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.05 0.08"
                  numOctaves="2"
                  seed="7"
                >
                  <animate
                    attributeName="baseFrequency"
                    values="0.05 0.08;0.09 0.05;0.05 0.08"
                    dur="0.9s"
                    repeatCount="indefinite"
                  />
                </feTurbulence>
                <feDisplacementMap
                  in="SourceGraphic"
                  scale="8"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>

              <radialGradient id="fire-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(255,250,200,1)" />
                <stop offset="35%" stop-color="rgba(255,180,40,0.9)" />
                <stop offset="70%" stop-color="rgba(255,80,0,0.55)" />
                <stop offset="100%" stop-color="rgba(180,0,0,0)" />
              </radialGradient>

              <!-- HE shockwave: layered glow for thick, "displaced air" ring. -->
              <filter id="he-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.2" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="1.4" />
                </feComponentTransfer>
              </filter>

              <radialGradient id="flash-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(255,255,255,1)" />
                <stop offset="40%" stop-color="rgba(240,250,255,0.9)" />
                <stop offset="100%" stop-color="rgba(190,225,255,0)" />
              </radialGradient>

              <!-- Blind overlay: a soft white wash applied over blinded
                 players. Two gradients for variety + animated rays. -->
              <radialGradient id="blind-overlay" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(255,255,255,0.95)" />
                <stop offset="60%" stop-color="rgba(255,255,255,0.55)" />
                <stop offset="100%" stop-color="rgba(255,255,255,0)" />
              </radialGradient>

              <!-- One shared circular clip for all player avatars. Each
                 avatar is rendered as a 24×24 image centered at the
                 kite origin then clipped to a r=12 circle so the
                 picture nearly fills the kite — only the NE tip of
                 the body shows through, which is enough to convey
                 facing direction. -->
              <clipPath id="replay-avatar-clip" clipPathUnits="userSpaceOnUse">
                <circle cx="0" cy="0" r="12" />
              </clipPath>
            </defs>

            <!-- Single-round actors (players, grenades, kills, bomb). Hidden
                 wholesale while the buy-round overlay is stacking rounds. -->
            <g v-if="!overlayMode">
            <g
              v-if="playerPathSegments.length"
              class="pointer-events-none"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <g v-for="path of playerPathSegments" :key="path.key">
                <path
                  :d="path.d"
                  stroke="rgba(0,0,0,0.55)"
                  :stroke-width="path.focused ? 8 : 5.5"
                  stroke-opacity="0.42"
                />
                <path
                  :d="path.d"
                  :stroke="colorFor(path.team)"
                  :stroke-width="path.focused ? 4 : 3"
                  :stroke-opacity="path.focused ? 0.95 : 0.6"
                  :stroke-dasharray="path.focused ? '2 7' : '1.5 8'"
                />
              </g>
            </g>
            </g>

            <!-- Detonated grenades — animated SVG primitives. Rendered in
               BOTH single-round and buy-round-overlay modes (the data
               source switches; the markup is identical).
               Smoke = pulsing gray disc with team-tinted ring,
               HE    = exploding starburst that flares then fades,
               Molotov = flickering layered flames,
               Flash = bright burst that decays,
               Decoy = dashed ring. -->
            <g
              v-for="g of detonationsByTick"
              :key="'grn-' + g.round + '-' + (g.grenade_id ?? g.tick)"
            >
              <g
                :transform="`translate(${project({ x: g.rx, y: g.ry, z: g.rz }).x}, ${project({ x: g.rx, y: g.ry, z: g.rz }).y})`"
              >
                <template v-if="g.type === 'Smoke'">
                  <!-- Filled footprint disc shows the area the smoke covers. -->
                  <circle r="34" fill="rgba(200,210,222,0.16)" />
                  <!-- Volumetric smoke: a cluster of overlapping soft puffs
                     that billow out on deploy and drift, under the
                     turbulence-displace filter so the silhouette stays
                     organic. Reads like a real CS smoke, not one disc. -->
                  <g filter="url(#smoke-displace)">
                    <circle
                      v-for="(puff, pi) in SMOKE_PUFFS"
                      :key="'sp-' + pi"
                      :cx="puff.dx"
                      :cy="puff.dy"
                      fill="url(#smoke-grad)"
                      opacity="0.9"
                    >
                      <animate
                        attributeName="r"
                        :values="`0;${puff.r * 1.1};${puff.r};${puff.r * 1.05};${puff.r}`"
                        keyTimes="0;0.35;0.6;0.85;1"
                        :begin="`${puff.d}s`"
                        dur="1.6s"
                        fill="freeze"
                      />
                      <animateTransform
                        attributeName="transform"
                        type="translate"
                        :values="
                          pi % 2 === 0
                            ? '0,0;2,-2;-1,2;0,0'
                            : '0,0;-2,1;1,-2;0,0'
                        "
                        dur="6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                  <!-- Sharp team-tinted ring stays OUTSIDE the displace
                     filter so identification is unambiguous. -->
                  <circle
                    r="34"
                    fill="none"
                    :stroke="colorFor(g.thrower_team)"
                    stroke-width="1.4"
                    stroke-opacity="0.5"
                  />
                </template>

                <template v-else-if="g.type === 'HE'">
                  <g filter="url(#he-glow)">
                    <circle fill="hsl(38, 100%, 58%)">
                      <animate
                        attributeName="r"
                        values="4;38;30"
                        keyTimes="0;0.22;1"
                        dur="1.3s"
                        fill="freeze"
                      />
                      <animate
                        attributeName="opacity"
                        values="1;0.95;0.6;0"
                        keyTimes="0;0.3;0.6;1"
                        dur="1.3s"
                        fill="freeze"
                      />
                    </circle>
                    <circle
                      fill="none"
                      stroke="hsl(45, 100%, 75%)"
                      stroke-width="3"
                    >
                      <animate
                        attributeName="r"
                        from="2"
                        to="64"
                        dur="1s"
                        fill="freeze"
                      />
                      <animate
                        attributeName="opacity"
                        values="1;0.85;0"
                        keyTimes="0;0.4;1"
                        dur="1s"
                        fill="freeze"
                      />
                      <animate
                        attributeName="stroke-width"
                        from="4.5"
                        to="0.5"
                        dur="1s"
                        fill="freeze"
                      />
                    </circle>
                    <circle
                      fill="none"
                      stroke="hsl(28, 100%, 65%)"
                      stroke-width="2.5"
                    >
                      <animate
                        attributeName="r"
                        from="0"
                        to="50"
                        dur="1.2s"
                        begin="0.12s"
                        fill="freeze"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.85"
                        to="0"
                        dur="1.2s"
                        begin="0.12s"
                        fill="freeze"
                      />
                    </circle>
                    <circle
                      fill="none"
                      stroke="hsl(0, 80%, 55%)"
                      stroke-width="1.8"
                    >
                      <animate
                        attributeName="r"
                        from="0"
                        to="36"
                        dur="1.4s"
                        begin="0.24s"
                        fill="freeze"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.7"
                        to="0"
                        dur="1.4s"
                        begin="0.24s"
                        fill="freeze"
                      />
                    </circle>
                  </g>
                  <!-- Bright core flash + sharp starburst body -->
                  <polygon
                    points="0,-26 5,-6 26,-5 9,4 17,23 0,10 -17,23 -9,4 -26,-5 -5,-6"
                    fill="hsl(40, 100%, 60%)"
                    stroke="hsl(55, 100%, 85%)"
                    stroke-width="1.4"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="scale"
                      values="0.2;1.6;1.15;1"
                      keyTimes="0;0.3;0.6;1"
                      dur="0.9s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;1;0.7;0"
                      keyTimes="0;0.35;0.7;1"
                      dur="1.6s"
                      fill="freeze"
                    />
                  </polygon>
                  <!-- Debris spokes — eight short radial lines that
                     shoot outward and fade. -->
                  <g
                    v-for="ang in [0, 45, 90, 135, 180, 225, 270, 315]"
                    :key="`he-spoke-${ang}`"
                    :transform="`rotate(${ang})`"
                  >
                    <line
                      x1="3"
                      y1="0"
                      x2="3"
                      y2="0"
                      stroke="hsl(55, 100%, 75%)"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    >
                      <animate
                        attributeName="x2"
                        from="6"
                        to="36"
                        dur="0.75s"
                        fill="freeze"
                      />
                      <animate
                        attributeName="opacity"
                        values="1;0.6;0"
                        keyTimes="0;0.5;1"
                        dur="0.85s"
                        fill="freeze"
                      />
                    </line>
                  </g>
                  <!-- Hot core that pulses then dies. -->
                  <circle fill="hsl(55, 100%, 92%)">
                    <animate
                      attributeName="r"
                      values="10;5;0"
                      keyTimes="0;0.5;1"
                      dur="1.2s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;0.6;0"
                      keyTimes="0;0.5;1"
                      dur="1.2s"
                      fill="freeze"
                    />
                  </circle>
                  <circle fill="rgba(48, 30, 20, 0.3)">
                    <animate
                      attributeName="r"
                      values="14;28;32"
                      keyTimes="0;0.5;1"
                      dur="2s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="0;0.3;0.22;0"
                      keyTimes="0;0.25;0.6;1"
                      dur="2s"
                      fill="freeze"
                    />
                  </circle>
                </template>

                <template v-else-if="g.type === 'Molotov'">
                  <!-- Fire pool: a radial gradient core wrapped in a
                     turbulence-displaced layer so the silhouette
                     constantly flickers as if licked by tongues of
                     flame. Embers float up out of the pool. -->
                  <!-- Outer heat haze (no displace, just a soft glow) -->
                  <circle r="34" fill="rgba(255, 40, 0, 0.14)">
                    <animate
                      attributeName="r"
                      values="6;34;32;34"
                      keyTimes="0;0.15;0.6;1"
                      dur="0.9s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.1;0.18;0.12;0.16"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <!-- Filled burning-area disc under the flames. -->
                  <circle r="30" fill="rgba(255,120,40,0.18)" />
                  <!-- Main fire body: a scatter of flame cells across the
                     burn footprint (spreading fire, not one disc), each
                     flickering under the displace filter. -->
                  <g filter="url(#fire-displace)">
                    <circle
                      v-for="(cell, ci) in FIRE_CELLS"
                      :key="'fc-' + ci"
                      :cx="cell.dx"
                      :cy="cell.dy"
                      fill="url(#fire-core)"
                    >
                      <animate
                        attributeName="r"
                        :values="`0;${cell.r * 1.2};${cell.r};${cell.r * 1.1};${cell.r}`"
                        keyTimes="0;0.3;0.6;0.85;1"
                        :begin="`${cell.d}s`"
                        dur="0.9s"
                        fill="freeze"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.8;1;0.8;0.95;0.8"
                        dur="0.6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <!-- Inner hot core -->
                    <circle r="9" fill="rgba(255, 250, 200, 0.95)">
                      <animate
                        attributeName="r"
                        values="5;10;7;9;5"
                        dur="0.45s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.9;1;0.85;0.95;0.9"
                        dur="0.45s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                  <!-- Floating embers: small bright dots that drift up
                     and fade. Six embers staggered for randomness. -->
                  <g
                    v-for="(em, ei) of [
                      { x: -6, y: 4, d: '1.2s' },
                      { x: 5, y: 7, d: '1.5s' },
                      { x: -2, y: -2, d: '1s' },
                      { x: 8, y: -4, d: '1.7s' },
                      { x: -9, y: -3, d: '1.3s' },
                      { x: 3, y: 6, d: '1.4s' },
                    ]"
                    :key="`em-${ei}`"
                  >
                    <circle
                      :cx="em.x"
                      :cy="em.y"
                      r="1.2"
                      fill="rgba(255, 230, 140, 0.95)"
                    >
                      <animate
                        attributeName="cy"
                        :values="`${em.y};${em.y - 18}`"
                        :dur="em.d"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0;1;0.8;0"
                        keyTimes="0;0.2;0.6;1"
                        :dur="em.d"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="r"
                        values="0.8;1.4;0.6"
                        :dur="em.d"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                </template>

                <template v-else-if="g.type === 'Flash'">
                  <!-- Pop: blinding white shockwave expands outward. -->
                  <circle fill="url(#flash-core)">
                    <animate
                      attributeName="r"
                      values="2;46;52;48"
                      keyTimes="0;0.12;0.5;1"
                      dur="2.3s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;1;0.85;0.4;0"
                      keyTimes="0;0.25;0.5;0.8;1"
                      dur="2.3s"
                      fill="freeze"
                    />
                  </circle>
                  <circle fill="rgba(255, 255, 255, 0.92)">
                    <animate
                      attributeName="r"
                      from="2"
                      to="30"
                      dur="0.16s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.95;0.95;0.45;0"
                      keyTimes="0;0.45;0.75;1"
                      dur="2.1s"
                      fill="freeze"
                    />
                  </circle>
                  <!-- Sharp ring chasing the shockwave -->
                  <circle
                    fill="none"
                    stroke="rgba(220, 240, 255, 0.95)"
                    stroke-width="1.8"
                  >
                    <animate
                      attributeName="r"
                      from="0"
                      to="40"
                      dur="0.6s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      from="1"
                      to="0"
                      dur="0.8s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="stroke-width"
                      from="3"
                      to="0.3"
                      dur="0.8s"
                      fill="freeze"
                    />
                  </circle>
                  <!-- Sharp star core -->
                  <polygon
                    points="0,-22 5,-5 22,0 5,5 0,22 -5,5 -22,0 -5,-5"
                    fill="rgba(245, 250, 255, 0.98)"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="scale"
                      values="0.1;1.5;1.1;0.95"
                      keyTimes="0;0.25;0.5;1"
                      dur="0.9s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;0.9;0.5;0"
                      keyTimes="0;0.4;0.7;1"
                      dur="1.9s"
                      fill="freeze"
                    />
                  </polygon>
                  <!-- Cyan-tinted secondary star at 22.5° for sharpness. -->
                  <polygon
                    points="0,-14 3,-3 14,0 3,3 0,14 -3,3 -14,0 -3,-3"
                    fill="rgba(180, 220, 255, 0.85)"
                    transform="rotate(22.5)"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="scale"
                      values="0.1;1.3;0.85"
                      keyTimes="0;0.4;1"
                      dur="1s"
                      additive="sum"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.85;0.5;0"
                      keyTimes="0;0.4;1"
                      dur="1.6s"
                      fill="freeze"
                    />
                  </polygon>
                </template>

                <template v-else-if="g.type === 'Decoy'">
                  <circle
                    r="20"
                    fill="none"
                    :stroke="colorFor(g.thrower_team)"
                    stroke-width="2"
                    stroke-dasharray="3 3"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.4;0.8;0.4"
                      dur="0.5s"
                      repeatCount="indefinite"
                    />
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0"
                      to="360"
                      dur="6s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </template>

                <!-- Lifetime ring: a track + a depleting arc (top-start,
                   clockwise) so you can read how long a timed grenade has
                   left at a glance. pathLength=1 makes the dash a direct
                   fraction of the remaining life. -->
                <g
                  v-if="
                    g.type === 'Smoke' ||
                    g.type === 'Molotov' ||
                    g.type === 'Decoy'
                  "
                  transform="rotate(-90)"
                  style="pointer-events: none"
                >
                  <circle
                    :r="grenadeRingRadius(g.type)"
                    fill="none"
                    stroke="hsl(0 0% 0% / 0.35)"
                    stroke-width="2"
                  />
                  <circle
                    :r="grenadeRingRadius(g.type)"
                    fill="none"
                    :stroke="colorFor(g.thrower_team)"
                    stroke-width="2"
                    stroke-linecap="round"
                    pathLength="1"
                    :stroke-dasharray="`${g.life} 1`"
                    stroke-opacity="0.9"
                  />
                </g>
              </g>
            </g>

            <!-- In-flight grenades: small projectile dot moving along the
               throw → landing path, with a faint dashed line ahead of
               it showing where it's about to land (the "look-ahead"
               trajectory cue). -->
            <g v-for="g of inFlightGrenades" :key="'thr-' + g.key">
              <!-- Predicted-path trail from current pos to landing -->
              <line
                :x1="project({ x: g.x, y: g.y, z: g.z }).x"
                :y1="project({ x: g.x, y: g.y, z: g.z }).y"
                :x2="project({ x: g.toX, y: g.toY, z: g.z }).x"
                :y2="project({ x: g.toX, y: g.toY, z: g.z }).y"
                :stroke="colorFor(g.thrower_team)"
                stroke-width="1"
                stroke-dasharray="2 3"
                stroke-opacity="0.45"
              />
              <!-- Landing marker (small target ring) -->
              <circle
                :cx="project({ x: g.toX, y: g.toY, z: g.z }).x"
                :cy="project({ x: g.toX, y: g.toY, z: g.z }).y"
                r="4"
                fill="none"
                :stroke="colorFor(g.thrower_team)"
                stroke-width="1"
                stroke-opacity="0.5"
              />
              <g
                :transform="`translate(${project({ x: g.x, y: g.y, z: g.z }).x}, ${project({ x: g.x, y: g.y, z: g.z }).y})`"
              >
                <image
                  :href="grenadeIconPath(g.type)"
                  x="-7"
                  y="-7"
                  width="14"
                  height="14"
                />
              </g>
            </g>

            <!-- Single-round-only ground actors (bomb, deaths, players).
                 Hidden while the buy-round overlay stacks rounds. -->
            <g v-if="!overlayMode">
            <!-- Bomb marker: planted/defused/exploded at the plant site -->
            <g v-if="bombMarker">
              <image
                :href="`/radars/projectiles/bomb-${bombMarker.state}.webp`"
                :x="project(bombMarker).x - 14"
                :y="project(bombMarker).y - 14"
                width="28"
                height="28"
              />
              <circle
                v-if="bombMarker.state === 'planted'"
                :cx="project(bombMarker).x"
                :cy="project(bombMarker).y"
                r="22"
                fill="none"
                stroke="hsl(var(--destructive))"
                stroke-width="2"
                opacity="0.55"
              >
                <animate
                  attributeName="r"
                  values="18;26;18"
                  dur="1s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.6;0.2;0.6"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>

            <!-- 2D utility heatmap: all of the round's detonations as discs,
               colored by type (HEAT toggle, shared with 3D). -->
            <g v-if="heatOn" class="pointer-events-none">
              <circle
                v-for="(g, hi) of roundDetonations"
                v-show="utilTypeFilter[g.type]"
                :key="'heat-' + hi"
                :cx="project({ x: g.rx, y: g.ry, z: g.rz }).x"
                :cy="project({ x: g.rx, y: g.ry, z: g.rz }).y"
                r="16"
                :fill="SCRUB_NADE_COLORS[g.type] || 'rgb(148,163,184)'"
                fill-opacity="0.4"
              />
            </g>

            <!-- Death markers persist at the victim's location at the
               kill tick — looked up from the position sample closest
               to the demo kill's tick. -->
            <g v-for="(k, i) of roundKillsWithLocation" v-show="showDeaths" :key="'k-' + i">
              <g
                v-if="k.location"
                :transform="`translate(${project(k.location).x}, ${project(k.location).y})`"
              >
                <line
                  x1="-7"
                  y1="-7"
                  x2="7"
                  y2="7"
                  :stroke="colorFor(k.victim_team ?? null)"
                  stroke-width="3"
                  opacity="0.7"
                />
                <line
                  x1="-7"
                  y1="7"
                  x2="7"
                  y2="-7"
                  :stroke="colorFor(k.victim_team ?? null)"
                  stroke-width="3"
                  opacity="0.7"
                />
              </g>
            </g>

            <!-- Dropped defuse kits: cyan disc with the defuser icon,
               offset above the actual drop point with a thin leader
               line so it doesn't fight the death X. A larger
               transparent circle is the hover hit-area; Vue tracks
               which marker is hovered so we can draw a clean halo. -->
            <g
              v-if="showGroundKits"
              v-for="(k, i) of groundKitsAt"
              :key="'kit-' + i"
            >
              <g :transform="`translate(${project(k).x}, ${project(k).y})`">
                <!-- Leader: thin cyan line from the death spot up to
                   the icon. -->
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-13"
                  stroke="hsl(190, 90%, 55%)"
                  stroke-width="0.8"
                  stroke-opacity="0.85"
                  stroke-linecap="round"
                  pointer-events="none"
                />
                <g transform="translate(0, -16)">
                  <!-- Hover halo: rendered first so it sits behind the
                     icon. Toggled by the hit-area's mouseenter. -->
                  <circle
                    v-if="hoveredGroundMarker === 'kit-' + i"
                    r="11"
                    fill="hsl(190, 90%, 55%)"
                    opacity="0.28"
                    pointer-events="none"
                  />
                  <circle
                    v-if="hoveredGroundMarker === 'kit-' + i"
                    r="11"
                    fill="none"
                    stroke="hsl(190, 90%, 70%)"
                    stroke-width="1.5"
                    pointer-events="none"
                  />
                  <circle
                    r="6.5"
                    fill="hsl(190, 90%, 55%)"
                    stroke="hsl(0 0% 0% / 0.95)"
                    stroke-width="1.3"
                    opacity="0.95"
                    pointer-events="none"
                  />
                  <image
                    href="/img/equipment/defuser.svg"
                    x="-4.8"
                    y="-4.2"
                    width="9.6"
                    height="8.4"
                    preserveAspectRatio="xMidYMid meet"
                    pointer-events="none"
                  />
                  <!-- Hit-area: transparent r=10 circle that catches the
                     hover. Sized generously so coaches scrubbing the
                     map don't have to aim. Native <title> here works
                     because it's the element the cursor actually
                     intersects. -->
                  <circle
                    r="10"
                    fill="transparent"
                    style="cursor: pointer"
                    @mouseenter="hoveredGroundMarker = 'kit-' + i"
                    @mouseleave="hoveredGroundMarker = null"
                  />
                  <!-- Tooltip card via foreignObject so we can use HTML +
                     Tailwind for styling instead of measuring SVG text.
                     Rendered only on hover and sized generously to fit
                     longer names. -->
                  <foreignObject
                    v-if="hoveredGroundMarker === 'kit-' + i"
                    x="-80"
                    y="-50"
                    width="160"
                    height="40"
                    style="overflow: visible; pointer-events: none"
                  >
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      class="font-mono text-[10px] leading-tight px-2 py-1 rounded-sm bg-[hsl(var(--background)/0.95)] border border-[hsl(190,90%,55%)] text-foreground inline-block whitespace-nowrap shadow-lg"
                    >
                      <div class="font-bold text-[hsl(190,90%,75%)]">
                        {{ groundKitTooltip(k).title }}
                      </div>
                      <div class="text-muted-foreground">
                        {{ groundKitTooltip(k).sub }}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              </g>
            </g>

            <!-- Bomb on the ground (or planted at site). Derived from
               the active round's drop/pickup/plant timeline. A subtle
               pulsing ring around the planted bomb makes the
               post-plant site obvious. Hover surfaces the source
               event (drop / plant) and lights up a halo. -->
            <g v-if="showGroundBomb && groundBombAt">
              <g
                :transform="`translate(${project(groundBombAt).x}, ${project(groundBombAt).y})`"
              >
                <circle
                  v-if="
                    bombPlantThisRound && currentTick >= bombPlantThisRound.tick
                  "
                  r="14"
                  fill="none"
                  stroke="hsl(0, 90%, 55%)"
                  stroke-width="1.5"
                  opacity="0.45"
                  pointer-events="none"
                >
                  <animate
                    attributeName="r"
                    values="12;18;12"
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.55;0.15;0.55"
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  v-if="hoveredGroundMarker === 'bomb'"
                  r="12"
                  fill="hsl(28, 100%, 55%)"
                  opacity="0.28"
                  pointer-events="none"
                />
                <circle
                  v-if="hoveredGroundMarker === 'bomb'"
                  r="12"
                  fill="none"
                  stroke="hsl(28, 100%, 70%)"
                  stroke-width="1.5"
                  pointer-events="none"
                />
                <circle
                  r="7"
                  fill="hsl(28, 100%, 55%)"
                  stroke="hsl(0 0% 0% / 0.95)"
                  stroke-width="1.4"
                  pointer-events="none"
                />
                <image
                  href="/img/equipment/c4.svg"
                  x="-5"
                  y="-5"
                  width="10"
                  height="10"
                  preserveAspectRatio="xMidYMid meet"
                  pointer-events="none"
                />
                <circle
                  r="11"
                  fill="transparent"
                  style="cursor: pointer"
                  @mouseenter="hoveredGroundMarker = 'bomb'"
                  @mouseleave="hoveredGroundMarker = null"
                />
                <foreignObject
                  v-if="hoveredGroundMarker === 'bomb'"
                  x="-80"
                  y="-50"
                  width="160"
                  height="40"
                  style="overflow: visible; pointer-events: none"
                >
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    class="font-mono text-[10px] leading-tight px-2 py-1 rounded-sm bg-[hsl(var(--background)/0.95)] border border-[hsl(28,100%,55%)] text-foreground inline-block whitespace-nowrap shadow-lg"
                  >
                    <div class="font-bold text-[hsl(28,100%,75%)]">
                      {{ groundBombTooltip.title }}
                    </div>
                    <div
                      v-if="groundBombTooltip.sub"
                      class="text-muted-foreground"
                    >
                      {{ groundBombTooltip.sub }}
                    </div>
                  </div>
                </foreignObject>
              </g>
            </g>

            <!-- Boltobserv-style "kite" dots: rounded body with one sharp
               point at NE, rotated so the point aims at the player's
               view direction. Built-in states: dead (X cross),
               firing (white corner burst), flashed-ready for the
               future. -->
            <g v-for="p of playersForRender" :key="p.steamId">
              <g
                :transform="`translate(${project(p).x}, ${project(p).y})`"
                style="cursor: pointer"
                @click="toggleFocus(p.steamId)"
                @mouseenter="hoveredPlayerSid = p.steamId"
                @mouseleave="hoveredPlayerSid = null"
              >
                <!-- Invisible hit-region behind the kite — gives the
                   group a guaranteed hover surface even where the
                   visible elements (kite body / arcs / badges) have
                   gaps. mouseenter/leave live on the parent <g> so
                   the cursor entering any child counts. -->
                <circle r="16" fill="transparent" />
                <!-- Hover tooltip card: same foreignObject pattern as
                   the ground markers so style + behavior stay
                   uniform. Rendered last in this group so it paints
                   on top of nearby kites. -->
                <foreignObject
                  v-if="hoveredPlayerSid === p.steamId"
                  x="-95"
                  y="-78"
                  width="190"
                  height="74"
                  style="overflow: visible; pointer-events: none"
                >
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    class="font-mono text-[10px] leading-tight px-2 py-1.5 rounded-sm bg-[hsl(var(--background)/0.95)] text-foreground inline-block whitespace-nowrap shadow-lg border"
                    :style="{
                      borderColor: colorFor(playerTooltipFor(p.steamId).team),
                    }"
                  >
                    <div
                      class="font-bold truncate max-w-[180px]"
                      :style="{
                        color: colorFor(playerTooltipFor(p.steamId).team),
                      }"
                    >
                      {{ playerTooltipFor(p.steamId).name }}
                    </div>
                    <div
                      v-if="playerTooltipFor(p.steamId).status"
                      class="text-foreground/90"
                    >
                      {{ playerTooltipFor(p.steamId).status }}
                    </div>
                    <div
                      v-for="(flag, fi) of playerTooltipFor(p.steamId)
                        .bombFlags"
                      :key="'pt-flag-' + fi"
                      class="text-[hsl(var(--tac-amber))] font-bold tracking-wider"
                    >
                      {{ flag }}
                    </div>
                    <div class="text-muted-foreground flex gap-2 mt-0.5">
                      <span>
                        K/D/A
                        <span class="text-foreground"
                          >{{ playerTooltipFor(p.steamId).k }}/{{
                            playerTooltipFor(p.steamId).d
                          }}/{{ playerTooltipFor(p.steamId).a }}</span
                        >
                      </span>
                      <span>·</span>
                      <span>
                        KDR
                        <span
                          class="text-foreground"
                          :style="{
                            color: kdColor(playerTooltipFor(p.steamId).kdrNum),
                          }"
                          >{{ playerTooltipFor(p.steamId).kdr }}</span
                        >
                      </span>
                      <span>·</span>
                      <span>
                        <span class="text-foreground">{{
                          playerTooltipFor(p.steamId).dmg
                        }}</span>
                        DMG
                      </span>
                    </div>
                  </div>
                </foreignObject>
                <!-- Focus marker: soft amber spotlight + static ring +
                   a slow pulse ring expanding outward. The pulse is
                   slow (2.4s) and low-opacity so it reads as a gentle
                   radar ping rather than aggressive flashing. -->
                <g
                  v-if="focusedPlayerId === p.steamId && p.alive"
                  style="pointer-events: none"
                >
                  <circle r="18" fill="hsl(var(--tac-amber))" opacity="0.06" />
                  <circle
                    r="17"
                    fill="none"
                    stroke="hsl(var(--tac-amber))"
                    stroke-width="1"
                    stroke-opacity="0.45"
                  />
                  <circle
                    fill="none"
                    stroke="hsl(var(--tac-amber))"
                    stroke-width="1"
                  >
                    <animate
                      attributeName="r"
                      values="17;28;17"
                      keyTimes="0;0.7;1"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.55;0;0.55"
                      keyTimes="0;0.7;1"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
                <!-- Dead: small X mark, no kite, no slot number. -->
                <template v-if="!p.alive">
                  <g :opacity="0.55">
                    <line
                      x1="-7"
                      y1="-7"
                      x2="7"
                      y2="7"
                      :stroke="colorFor(p.team)"
                      stroke-width="2.5"
                    />
                    <line
                      x1="-7"
                      y1="7"
                      x2="7"
                      y2="-7"
                      :stroke="colorFor(p.team)"
                      stroke-width="2.5"
                    />
                  </g>
                </template>

                <!-- Alive: rotated kite (group rotation only — slot
                   number stays upright by being outside the rotated
                   sub-group). -->
                <template v-else>
                  <g :transform="`rotate(${45 - p.yaw})`">
                    <!-- Body. Blinded players get their fill desaturated
                       and washed out so they pop visually as "out of
                       the fight" without losing team identity. -->
                    <path
                      d="M -12 0 A 12 12 0 0 1 0 -12 L 12 -12 L 12 0 A 12 12 0 0 1 0 12 A 12 12 0 0 1 -12 0 Z"
                      :fill="colorFor(p.team)"
                      stroke="hsl(0 0% 0% / 0.4)"
                      stroke-width="0.5"
                      :opacity="p.blinded > 0.15 ? 1 - p.blinded * 0.55 : 1"
                    />
                    <!-- HP back-bar: a 90° arc on the SW of the kite,
                       drawn at radius 15 so it sits ~3px OUTSIDE the
                       kite body — reads as a dedicated health gauge
                       behind the player rather than blending into the
                       body fill. Width scales with HP, colour lerps
                       green → yellow → red. Arc length = π·15/2 ≈
                       23.56; dash centred via offset = L·(p−1)/2. -->
                    <template v-if="p.health !== null">
                      <path
                        d="M -15 0 A 15 15 0 0 0 0 15"
                        fill="none"
                        stroke="hsl(0 0% 100% / 0.18)"
                        stroke-width="3"
                        stroke-linecap="round"
                      />
                      <!-- Armor: a parallel arc OUTSIDE the HP arc
                         (radius 18 vs 15) so it's always visible
                         even when HP is full. Bright purple when
                         helmeted, muted purple when kevlar only. -->
                      <path
                        v-if="p.armor != null && p.armor > 0"
                        d="M -18 0 A 18 18 0 0 0 0 18"
                        fill="none"
                        :stroke="
                          p.helmet
                            ? 'hsl(195, 100%, 70%)'
                            : 'hsl(200, 70%, 55%)'
                        "
                        stroke-width="2"
                        stroke-linecap="round"
                        :stroke-dasharray="`${(p.armor / 100) * 28.27} 100`"
                        :stroke-dashoffset="((p.armor - 100) / 100) * 14.14"
                      />
                      <path
                        d="M -15 0 A 15 15 0 0 0 0 15"
                        fill="none"
                        :stroke="`hsl(${(p.health / 100) * 130}, 85%, 50%)`"
                        stroke-width="3"
                        stroke-linecap="round"
                        :stroke-dasharray="`${(p.health / 100) * 23.56} 100`"
                        :stroke-dashoffset="((p.health - 100) / 100) * 11.78"
                      />
                    </template>
                    <!-- C4 carrier badge: sits on the player's back-
                       right (local SE corner, just past the HP arc's
                       south end). Because we're INSIDE the rotate
                       group, it always tracks the player's facing
                       direction — directly behind them no matter
                       which way they're looking. Distance from origin
                       ≈ 18.4 so it clears the r=15 HP arc cleanly.
                       The inner group counter-rotates back into screen
                       space so the "C4" text stays upright. -->
                    <g
                      v-if="p.hasBomb && showC4"
                      transform="translate(9, 16)"
                      style="pointer-events: none"
                    >
                      <g :transform="`rotate(${p.yaw - 45})`">
                        <circle
                          r="5.5"
                          fill="hsl(28, 100%, 55%)"
                          stroke="hsl(0 0% 0% / 0.95)"
                          stroke-width="1.3"
                        />
                        <image
                          href="/img/equipment/c4.svg"
                          x="-4"
                          y="-4"
                          width="8"
                          height="8"
                          preserveAspectRatio="xMidYMid meet"
                        />
                      </g>
                    </g>
                    <!-- Defuse-kit badge: same back-right placement as
                       the C4 badge. If the player is carrying both,
                       the kit slides a touch further out so the two
                       pips sit side-by-side rather than stacking.
                       Hidden while they're actively defusing — the
                       defuse state ring handles that case. -->
                    <g
                      v-if="
                        p.hasDefuser &&
                        p.bombAction !== 'defusing' &&
                        showDefuser
                      "
                      :transform="
                        p.hasBomb && showC4
                          ? 'translate(17, 6)'
                          : 'translate(9, 16)'
                      "
                      style="pointer-events: none"
                    >
                      <g :transform="`rotate(${p.yaw - 45})`">
                        <circle
                          r="5"
                          fill="hsl(190, 90%, 55%)"
                          stroke="hsl(0 0% 0% / 0.95)"
                          stroke-width="1.2"
                        />
                        <image
                          href="/img/equipment/defuser.svg"
                          x="-3.6"
                          y="-3.2"
                          width="7.2"
                          height="6.4"
                          preserveAspectRatio="xMidYMid meet"
                        />
                      </g>
                    </g>
                    <!-- Firing: a broadcast-style precision tracer.
                       Kite is rotated so local NE is forward — the
                       muzzle is at (12, -12), bullet line shoots
                       outward along (1, -1).
                       Three layers:
                         - faint outer heat-haze cone (soft, slow pulse)
                         - sharp tracer line that "stutters" at fire rate
                         - bright pinpoint muzzle flash dot at the tip. -->
                    <g v-if="p.firing">
                      <!-- Heat haze: a soft glow around the muzzle that
                         lingers between shots. -->
                      <circle
                        cx="13"
                        cy="-13"
                        r="7"
                        fill="rgba(255, 180, 70, 0.28)"
                      >
                        <animate
                          attributeName="r"
                          values="4;8;5;7;4"
                          dur="0.2s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.4;0.1;0.35;0.15;0.4"
                          dur="0.2s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      <!-- Tracer line: thin, sharp, animated so its
                         length flickers like rapid fire. -->
                      <line
                        x1="14"
                        y1="-14"
                        x2="34"
                        y2="-34"
                        stroke="hsl(48, 100%, 78%)"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      >
                        <animate
                          attributeName="x2"
                          values="22;38;28;36;22"
                          dur="0.11s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="y2"
                          values="-22;-38;-28;-36;-22"
                          dur="0.11s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="1;0.25;0.95;0.4;1"
                          dur="0.11s"
                          repeatCount="indefinite"
                        />
                      </line>
                      <!-- Bright muzzle pinpoint at the tip itself. -->
                      <circle
                        cx="13"
                        cy="-13"
                        r="2.5"
                        fill="hsl(50, 100%, 92%)"
                        stroke="hsl(20, 100%, 60%)"
                        stroke-width="0.7"
                      >
                        <animate
                          attributeName="r"
                          values="1.6;3.2;2;2.8;1.6"
                          dur="0.09s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="1;0.55;1;0.65;1"
                          dur="0.09s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </g>
                  </g>
                  <!-- Blinded overlay: rendered upright (not rotated)
                     because the effect is on the player's vision, not
                     their facing. White wash + spinning rays + bright
                     pinpoint at center. Opacity scales with the blind
                     strength so a partial flash reads as a faint
                     overlay and a direct hit is a near-total whiteout. -->
                  <g
                    v-if="p.blinded > 0.05"
                    :opacity="p.blinded"
                    style="pointer-events: none"
                  >
                    <!-- Soft halo behind the player -->
                    <circle r="22" fill="url(#blind-overlay)">
                      <animate
                        attributeName="r"
                        values="20;26;20"
                        dur="0.9s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <!-- Spinning ray cluster -->
                    <g>
                      <g
                        v-for="ang of [0, 60, 120, 180, 240, 300]"
                        :key="`blr-${ang}`"
                        :transform="`rotate(${ang})`"
                      >
                        <polygon
                          points="0,-22 1.6,-10 0,-7 -1.6,-10"
                          fill="rgba(255, 255, 255, 0.9)"
                        />
                      </g>
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0"
                        to="360"
                        dur="2.2s"
                        repeatCount="indefinite"
                      />
                    </g>
                    <!-- Bright pinpoint -->
                    <circle r="3" fill="rgba(255, 255, 255, 1)">
                      <animate
                        attributeName="opacity"
                        values="0.7;1;0.7"
                        dur="0.45s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                  <!-- Slot indicator: avatar or number, always upright in
                     screen space (rendered OUTSIDE the rotate(45-yaw)
                     group). Avatar mode uses a single shared clipPath
                     to render the Steam image clipped to a circle that
                     nearly fills the kite — sharper presentation than
                     per-player patterns and much less DOM. -->
                  <template v-if="showAvatars && playerAvatarMap[p.steamId]">
                    <image
                      :href="playerAvatarMap[p.steamId]"
                      x="-12"
                      y="-12"
                      width="24"
                      height="24"
                      preserveAspectRatio="xMidYMid slice"
                      clip-path="url(#replay-avatar-clip)"
                    />
                    <!-- Avatar team ring: thick solid stroke in team
                       color, plus a thin dark outline so the ring
                       reads against bright tiles on the radar. Much
                       higher contrast than the old 0.6-width hairline
                       so CT vs T is obvious at a glance. -->
                    <circle
                      r="12.5"
                      fill="none"
                      stroke="hsl(0 0% 0% / 0.7)"
                      stroke-width="3.5"
                    />
                    <circle
                      r="12.5"
                      fill="none"
                      :stroke="colorFor(p.team)"
                      stroke-width="2.2"
                    />
                  </template>
                  <text
                    v-else
                    x="0"
                    y="4.5"
                    text-anchor="middle"
                    class="font-mono pointer-events-none select-none"
                    :fill="p.team === 't' ? 'hsl(0 0% 8%)' : 'hsl(0 0% 100%)'"
                    :style="{
                      fontSize: '13px',
                      fontWeight: 900,
                      letterSpacing: '0.02em',
                      paintOrder: 'stroke',
                      stroke:
                        p.team === 't'
                          ? 'hsl(33, 94%, 35%)'
                          : 'hsl(210, 80%, 30%)',
                      strokeWidth: '2.5px',
                      strokeLinejoin: 'round',
                    }"
                  >
                    {{ slotByPlayer[p.steamId]?.slot ?? "?" }}
                  </text>
                  <!-- Held weapon: the weapon equipped at this tick (rifle,
                     pistol, knife, grenade) floated just above the token.
                     Upright in screen space. -->
                  <image
                    v-if="tokenWeaponIcon(p)"
                    :href="tokenWeaponIcon(p)!"
                    x="-13"
                    y="-29"
                    width="26"
                    height="14"
                    preserveAspectRatio="xMidYMid meet"
                    style="pointer-events: none"
                    @error="
                      ($event.target as HTMLImageElement).style.display = 'none'
                    "
                  />
                  <!-- Plant / defuse activity: a solid colored disc
                     ON the player marker (fills the avatar/kite
                     footprint) plus an outer rotating dashed ring and
                     an upright label above. The disc reads as the
                     player being "actively working" the bomb;
                     animated opacity pulses for urgency without
                     hiding the player team identity. -->
                  <g
                    v-if="p.bombAction === 'planting'"
                    style="pointer-events: none"
                  >
                    <circle r="14" fill="hsl(40, 100%, 55%)" opacity="0.45">
                      <animate
                        attributeName="opacity"
                        values="0.55;0.25;0.55"
                        dur="1.1s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle
                      r="20"
                      fill="none"
                      stroke="hsl(40, 100%, 55%)"
                      stroke-width="2.5"
                      stroke-dasharray="5 3"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0"
                        to="360"
                        dur="2.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <text
                      x="0"
                      y="-25"
                      text-anchor="middle"
                      fill="hsl(40, 100%, 70%)"
                      class="font-mono select-none"
                      style="
                        font-size: 7px;
                        font-weight: 900;
                        letter-spacing: 0.18em;
                        paint-order: stroke;
                        stroke: hsl(0 0% 0% / 0.85);
                        stroke-width: 2px;
                        stroke-linejoin: round;
                      "
                    >
                      {{ $t("match.planting") }}
                    </text>
                  </g>
                  <g
                    v-else-if="p.bombAction === 'defusing'"
                    style="pointer-events: none"
                  >
                    <circle r="14" fill="hsl(190, 95%, 55%)" opacity="0.45">
                      <animate
                        attributeName="opacity"
                        values="0.55;0.25;0.55"
                        dur="1.1s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle
                      r="20"
                      fill="none"
                      stroke="hsl(190, 95%, 60%)"
                      stroke-width="2.5"
                      stroke-dasharray="5 3"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="360"
                        to="0"
                        dur="2.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <text
                      x="0"
                      y="-25"
                      text-anchor="middle"
                      fill="hsl(190, 95%, 70%)"
                      class="font-mono select-none"
                      style="
                        font-size: 7px;
                        font-weight: 900;
                        letter-spacing: 0.18em;
                        paint-order: stroke;
                        stroke: hsl(0 0% 0% / 0.85);
                        stroke-width: 2px;
                        stroke-linejoin: round;
                      "
                    >
                      {{ $t("match.defusing") }}
                    </text>
                  </g>
                </template>
              </g>
            </g>
            </g>

            <!-- Buy-round overlay players: simple team-colored dots, one
                 per live player per selected round. With many rounds stacked
                 the full token is too much — dots keep movement legible.
                 Utility is drawn by the shared detonation/in-flight markup
                 above (real throws). -->
            <g v-if="overlayMode" class="pointer-events-none">
              <circle
                v-for="a of overlayActors"
                :key="a.key"
                :cx="a.x"
                :cy="a.y"
                r="4"
                :fill="colorFor(a.team)"
                fill-opacity="0.85"
                stroke="hsl(0 0% 0% / 0.5)"
                stroke-width="0.75"
              />
            </g>
          </svg>
        </div>

        <!-- 3D viewer fills the whole stage (not the centered square) so it
             reads full-height; ReplayViewer's scoreboard / playbar / HUD float
             over it at higher z. -->
        <Transition name="mapfade">
        <Replay3DLite
          v-if="viewMode === '3d' && radarSrc && calibration"
          class="z-[1]"
          :map-mesh-url="mapMeshUrl"
          :radar-src="radarSrc"
          :resolution="calibration.resolution"
          :players="playersForRender"
          :names="playerNameMap"
          :project="project"
          :grenades="detonationsByTick"
          :in-flight="inFlightGrenades"
          :grenade-trajectories="grenadeTrajectories || []"
          :heat-points="roundDetonations"
          :bomb="bombMarker"
          :focused="focusedPlayerId"
          :cam-mode="camMode"
          :heat-on="heatOn"
          :type-filter="utilTypeFilter"
          :selected-gids="selectedGi"
          :round-utilities="roundUtilities"
          :overlay-actors="overlayActors3d"
          @select-util="toggleUtilSel"
        />
        </Transition>

        <!-- Unified chrome (Replay3D look) — shown over BOTH 2D and 3D so the
             player is identical; only the map underneath differs. -->
        <ReplayChrome
          class="z-[20]"
          :hud="chromeHud"
          :team-a="chromeTeamA"
          :team-b="chromeTeamB"
          :side-a="0"
          :alive-a="chromeAliveA"
          :alive-b="chromeAliveB"
          :feed="chromeFeed"
          :pbp="chromePbp"
          :rounds="chromeRounds"
          :active-round-u-i="activeRound ?? 0"
          :util-markers="chromeUtilMarkers"
          :tick-markers="chromeTickMarkers"
          :type-filter="utilTypeFilter"
          :selected-gi="selectedGi"
          :playing="playing"
          :speed="speed"
          :seek-frac="chromeSeekFrac"
          :time-label="chromeTimeLabel"
          :view="viewMode"
          :overlay="overlayMode"
          :show3d="viewMode === '3d'"
          :cam-mode="camMode"
          :show-pbp="showPbpPanel"
          :heat-on="heatOn"
          :follow-name="chromeFollowName"
          :ct-hex="CT_HEX"
          :t-hex="T_HEX"
          :on-play="toggle"
          :on-seek="chromeSeek"
          :on-speed="chromeSpeed"
          :on-select-round="chromeSelectRound"
          :on-follow-row="toggleFocus"
          :on-toggle-type="(ty) => (utilTypeFilter[ty] = !utilTypeFilter[ty])"
          :on-toggle-pbp="() => (showPbpPanel = !showPbpPanel)"
          :on-toggle-heat="() => (heatOn = !heatOn)"
          :on-mode="chromeMode"
          :on-view="(v) => (viewMode = v)"
          :on-pbp-util="toggleUtilSel"
          :on-clear-sel="() => (selectedGi = [])"
          :overlay-rounds="overlayRoundsArr"
          :overlay-window="overlayWindowSec"
          :on-overlay-window="(n) => (overlayWindowSec = n)"
          :show-avatars="showAvatars"
          :trace-on="pathingMode !== 'off'"
          :show-deaths="showDeaths"
          :on-toggle-overlay="() => (overlayMode = !overlayMode)"
          :on-toggle-overlay-round="toggleOverlayRound"
          :on-toggle-avatars="() => (showAvatars = !showAvatars)"
          :on-toggle-trace="togglePathing"
          :on-toggle-deaths="() => (showDeaths = !showDeaths)"
        />

        <!-- Round timer (top-left) + HUD controls (top-right) are
             anchored to the STAGE edges, not the centered map, so they
             hug the viewport corners and the map reads wider. -->
        <!-- Top-right HUD cluster: marker-style toggle + pop-out. Both
           sized 40×40 to read as broadcast-grade action buttons. -->
        <div v-if="false" class="absolute top-2 right-2 z-20 flex items-center gap-1.5">
          <Tooltip v-if="radarSrc">
            <TooltipTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center justify-center w-10 h-10 border transition-colors backdrop-blur-sm"
                :class="
                  viewMode === '3d'
                    ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                    : 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--card)/0.85)] text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)]'
                "
                @click="viewMode = viewMode === '3d' ? '2d' : '3d'"
              >
                <Box class="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{{ viewMode === "3d" ? "2D" : "3D" }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center justify-center w-10 h-10 border border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--card)/0.85)] text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] transition-colors backdrop-blur-sm"
                @click="showScoreboard = !showScoreboard"
              >
                <PanelRightClose v-if="showScoreboard" class="w-5 h-5" />
                <PanelRightOpen v-else class="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {{
                showScoreboard
                  ? $t("match.replay.hide_scoreboard")
                  : $t("match.replay.show_scoreboard")
              }}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center justify-center w-10 h-10 border border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--card)/0.85)] text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] transition-colors backdrop-blur-sm"
                @click="showAvatars = !showAvatars"
              >
                <Users v-if="showAvatars" class="w-5 h-5" />
                <Hash v-else class="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {{
                showAvatars
                  ? $t("match.replay.toggle_to_slots")
                  : $t("match.replay.toggle_to_avatars")
              }}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center justify-center w-10 h-10 border bg-[hsl(var(--card)/0.85)] transition-colors backdrop-blur-sm"
                :class="
                  pathingMode === 'off'
                    ? 'border-[hsl(var(--tac-amber)/0.35)] text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.7)] hover:text-[hsl(var(--tac-amber))]'
                    : 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                "
                @click="togglePathing"
              >
                <Route class="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {{
                pathingMode === "off"
                  ? t("match.replay.pathing_off")
                  : t("match.replay.pathing_progress")
              }}
            </TooltipContent>
          </Tooltip>
          <Popover>
            <PopoverTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center justify-center w-10 h-10 border border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--card)/0.85)] text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] transition-colors backdrop-blur-sm"
                :title="$t('match.replay.overlays')"
              >
                <Settings2 class="w-5 h-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-56 p-2 text-xs font-mono">
              <div
                class="px-1 py-1 text-[0.55rem] tracking-[0.22em] uppercase text-muted-foreground"
              >
                {{ $t("match.replay.overlays") }}
              </div>
              <label
                class="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/40 cursor-pointer"
              >
                <input
                  v-model="showC4"
                  type="checkbox"
                  class="accent-[hsl(var(--tac-amber))]"
                />
                <span>{{ $t("match.replay.overlay_c4") }}</span>
              </label>
              <label
                class="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/40 cursor-pointer"
              >
                <input
                  v-model="showDefuser"
                  type="checkbox"
                  class="accent-[hsl(var(--tac-amber))]"
                />
                <span>{{ $t("match.replay.overlay_defuser") }}</span>
              </label>
              <label
                class="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/40 cursor-pointer"
              >
                <input
                  v-model="showGroundBomb"
                  type="checkbox"
                  class="accent-[hsl(var(--tac-amber))]"
                />
                <span>{{ $t("match.replay.overlay_ground_bomb") }}</span>
              </label>
              <label
                class="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/40 cursor-pointer"
              >
                <input
                  v-model="showGroundKits"
                  type="checkbox"
                  class="accent-[hsl(var(--tac-amber))]"
                />
                <span>{{ $t("match.replay.overlay_ground_kits") }}</span>
              </label>
            </PopoverContent>
          </Popover>
          <Tooltip v-if="!isPopout">
            <TooltipTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center justify-center w-10 h-10 border border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--card)/0.85)] text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] transition-colors backdrop-blur-sm"
                @click="openReplayPopout"
              >
                <ExternalLink class="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{{ $t("match.replay.popout") }}</TooltipContent>
          </Tooltip>
        </div>

        <!-- Old top-left timer HUD — replaced by ReplayChrome's center HUD. -->
        <div
          v-if="false"
          class="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none z-10"
        >
          <template v-if="overlayMode">
            <div
              class="inline-flex items-center gap-2 px-2.5 py-1 border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--card)/0.85)] backdrop-blur-sm"
            >
              <Layers class="w-3.5 h-3.5 text-[hsl(var(--tac-amber))] shrink-0" />
              <span
                class="font-mono text-[0.5rem] tracking-[0.22em] uppercase text-[hsl(var(--tac-amber)/0.8)]"
              >
                {{ t("match.replay.overlay_buy_section") }}
              </span>
              <span
                class="font-mono text-sm font-bold tabular-nums text-[hsl(var(--tac-amber))]"
              >
                +{{ formatMMSS(overlayElapsedSec) }}
                <span class="text-[hsl(var(--tac-amber)/0.5)]">/</span>
                {{ formatMMSS(overlayWindowSec) }}
              </span>
            </div>
            <div class="px-1 font-mono text-[0.6rem] text-muted-foreground">
              {{
                t("match.replay.overlay_buy_explainer", {
                  sec: overlayWindowSec,
                  count: overlaySelectedRounds.size,
                })
              }}
            </div>
          </template>
          <template v-else>
          <!-- stacked score + RD + time box (mirrors the 3D viewer's HUD) -->
          <div
            class="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--card)/0.85)] backdrop-blur-sm"
          >
            <div class="font-mono text-lg font-bold tabular-nums leading-none">
              <span :style="{ color: colorFor('ct') }">{{ sideScores.ct }}</span>
              <span class="text-muted-foreground/50 mx-1.5">:</span>
              <span :style="{ color: colorFor('t') }">{{ sideScores.t }}</span>
            </div>
            <div
              class="font-mono text-[0.62rem] tabular-nums leading-none flex items-center gap-1.5"
              :class="
                timer.phase === 'bomb' ? 'text-[hsl(var(--destructive))]' : 'text-muted-foreground'
              "
            >
              <span
                v-if="activeRound != null"
                class="tracking-[0.18em] text-[hsl(var(--tac-amber)/0.85)]"
              >RD {{ activeRound }}</span>
              <span class="opacity-40">·</span>
              <span v-if="timer.phase === 'freeze'" class="tracking-[0.18em] uppercase">{{ $t("match.replay.phase_freeze") }}</span>
              <span v-else-if="timer.phase === 'bomb'" class="tracking-[0.18em] uppercase">{{ $t("match.replay.phase_bomb") }}</span>
              <span>{{ formatMMSS(timer.secondsRemaining) }}</span>
            </div>
          </div>
          <div
            v-if="timer.phase === 'bomb'"
            class="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.2em] uppercase border border-[hsl(var(--destructive)/0.6)] bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))] backdrop-blur-sm"
          >
            <span class="relative inline-flex h-1.5 w-1.5">
              <span
                class="absolute inline-flex h-full w-full rounded-full bg-current animate-ping"
              />
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            {{
              $t("match.replay.bomb_planted", {
                site: bombPlantThisRound?.site ?? "",
              })
            }}
          </div>
          <div
            v-else-if="
              bombDefuseThisRound && bombDefuseThisRound.tick <= currentTick
            "
            class="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.2em] uppercase border border-[hsl(var(--success)/0.6)] bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] backdrop-blur-sm"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-current" />
            {{ $t("match.replay.bomb_defused") }}
          </div>
          <div
            v-else-if="
              bombExplodeThisRound && bombExplodeThisRound.tick <= currentTick
            "
            class="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.2em] uppercase border border-[hsl(var(--destructive)/0.8)] bg-[hsl(var(--destructive)/0.25)] text-[hsl(var(--destructive))] backdrop-blur-sm"
          >
            {{ $t("match.replay.bomb_exploded") }}
          </div>
          </template>
        </div>

        <!-- Floating scoreboard: the ONLY floating element. Stacked at the
             stage's right edge (dead space) so it never overlays the map
             action. Holds both side rosters + the round kill feed. Wrapper
             is pointer-events-none so gaps don't swallow map interactions;
             cards re-enable pointer events for click-to-follow. -->
        <Transition name="scoreboard">
          <div
            v-show="showScoreboard && !overlayMode"
            class="absolute top-14 right-2 bottom-3 z-20 hidden md:flex flex-col gap-1.5 w-[400px] pointer-events-none"
          >
            <div
              class="pointer-events-auto px-2 py-1.5 border bg-[hsl(var(--card)/0.85)] backdrop-blur-sm"
              :style="{ borderColor: 'hsl(210 80% 60% / 0.45)' }"
            >
              <ReplayLineupTeam
                team="ct"
                :label="$t('match.replay.counter_terrorists')"
                :score="sideScores.ct"
                :members="lineupRows.ct"
                :live-state-by-steam="liveStateBySteam"
                :loadout-by-steam="loadoutBySteam"
                :focused-player-id="focusedPlayerId"
                :show-avatars="showAvatars"
                :show-c4="showC4"
                :stats-for="statsFor"
                :has-bomb-for="hasBombFor"
                :follow-label="followLabelFor"
                @focus="toggleFocus"
              />
            </div>
            <div
              class="pointer-events-auto px-2 py-1.5 border bg-[hsl(var(--card)/0.85)] backdrop-blur-sm"
              :style="{ borderColor: 'hsl(33 94% 58% / 0.45)' }"
            >
              <ReplayLineupTeam
                team="t"
                :label="$t('match.replay.terrorists')"
                :score="sideScores.t"
                :members="lineupRows.t"
                :live-state-by-steam="liveStateBySteam"
                :loadout-by-steam="loadoutBySteam"
                :focused-player-id="focusedPlayerId"
                :show-avatars="showAvatars"
                :show-c4="showC4"
                :stats-for="statsFor"
                :has-bomb-for="hasBombFor"
                :follow-label="followLabelFor"
                @focus="toggleFocus"
              />
            </div>
            <p
              class="pointer-events-none text-[0.55rem] leading-tight text-muted-foreground/70 px-0.5"
            >
              {{ $t("match.replay.follow_hint") }}
            </p>

            <!-- Round kill feed, tucked under the rosters so it floats WITH
                 the scoreboard (right-side dead space) — no overlay on the
                 action, and nothing else floats. flex-1 fills the space
                 beneath the rosters and scrolls internally. -->
            <div
              v-if="killsBeforeCursor.length > 0"
              class="pointer-events-auto flex-1 min-h-0 flex flex-col gap-1 px-2 py-1.5 border border-border bg-[hsl(var(--card)/0.85)] backdrop-blur-sm"
            >
            <div
              class="font-mono text-[0.55rem] tracking-[0.22em] uppercase text-muted-foreground shrink-0"
            >
              {{ $t("match.round_kills") }}
            </div>
            <div
              ref="killFeedEl"
              class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-1"
            >
              <div
                v-for="(k, i) of killFeedDisplay"
                :key="'kf-' + i"
                class="font-mono text-[0.65rem] tabular-nums flex items-center gap-1 py-0.5"
              >
                <!-- Killer block: identity pip (avatar or slot number) +
                   name, colored to the killer's team. -->
                <img
                  v-if="
                    showAvatars && k.killer && playerAvatarMap[String(k.killer)]
                  "
                  :src="playerAvatarMap[String(k.killer)]"
                  :alt="playerName(k.killer ?? '')"
                  :title="playerName(k.killer ?? '')"
                  class="w-4 h-4 rounded-full object-cover shrink-0 border ring-1 ring-black/60"
                  :style="{ borderColor: colorFor(k.killer_team ?? null) }"
                  @error="
                    ($event.target as HTMLImageElement).style.display = 'none'
                  "
                />
                <span
                  v-else
                  class="w-4 h-4 rounded-full inline-flex items-center justify-center font-mono font-bold text-[9px] shrink-0"
                  :title="playerName(k.killer ?? '')"
                  :style="{
                    background: colorFor(k.killer_team ?? null),
                    color:
                      k.killer_team === 't' ? 'hsl(0 0% 10%)' : 'hsl(0 0% 98%)',
                  }"
                >
                  {{ slotByPlayer[String(k.killer ?? "")]?.slot ?? "?" }}
                </span>
                <span
                  class="truncate max-w-[5rem]"
                  :style="{ color: colorFor(k.killer_team ?? null) }"
                >
                  {{ playerName(k.killer ?? "") }}
                </span>
                <img
                  v-if="k.weapon && weaponIconPath(k.weapon)"
                  :src="weaponIconPath(k.weapon)"
                  :alt="k.weapon"
                  :title="k.weapon"
                  class="h-4 w-auto opacity-90 shrink-0"
                  @error="onWeaponIconError($event, k.weapon)"
                />
                <Crosshair
                  v-if="k.headshot"
                  class="w-3 h-3 text-[hsl(var(--tac-amber))] drop-shadow-[0_0_4px_hsl(var(--tac-amber)/0.6)] shrink-0"
                  :stroke-width="2.5"
                  :title="$t('match.replay.headshot')"
                />
                <!-- Victim block: same identity pip + name, team color. -->
                <img
                  v-if="
                    showAvatars && k.victim && playerAvatarMap[String(k.victim)]
                  "
                  :src="playerAvatarMap[String(k.victim)]"
                  :alt="playerName(k.victim ?? '')"
                  :title="playerName(k.victim ?? '')"
                  class="w-4 h-4 rounded-full object-cover shrink-0 border ring-1 ring-black/60"
                  :style="{ borderColor: colorFor(k.victim_team ?? null) }"
                  @error="
                    ($event.target as HTMLImageElement).style.display = 'none'
                  "
                />
                <span
                  v-else
                  class="w-4 h-4 rounded-full inline-flex items-center justify-center font-mono font-bold text-[9px] shrink-0"
                  :title="playerName(k.victim ?? '')"
                  :style="{
                    background: colorFor(k.victim_team ?? null),
                    color:
                      k.victim_team === 't' ? 'hsl(0 0% 10%)' : 'hsl(0 0% 98%)',
                  }"
                >
                  {{ slotByPlayer[String(k.victim ?? "")]?.slot ?? "?" }}
                </span>
                <span
                  class="truncate max-w-[5rem]"
                  :style="{ color: colorFor(k.victim_team ?? null) }"
                >
                  {{ playerName(k.victim ?? "") }}
                </span>
              </div>
            </div>
          </div>
          </div>
        </Transition>
      </div>

      <!-- Old docked transport — replaced by ReplayChrome's bottom transport. -->
      <div
        v-if="false"
        ref="playbarDockEl"
        class="flex flex-col bg-[hsl(var(--card)/0.6)] border border-border rounded-md overflow-hidden"
      >
          <!-- Round row. In overlay mode the per-round nav is replaced by
               the overlay's window slider + full-buy round chips; the
               overlay toggle is an icon pinned at the end either way. -->
          <div
            v-if="roundStripEntries.length || overlayAvailable"
            class="flex flex-wrap items-center gap-1.5 px-3 pt-2 pb-1 border-b transition-colors"
            :class="
              overlayMode
                ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)]'
                : 'border-border/40'
            "
          >
            <template v-if="!overlayMode">
              <button
                type="button"
                class="inline-flex items-center justify-center w-7 h-7 shrink-0 border border-border/60 rounded-sm text-muted-foreground hover:text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber)/0.7)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                :title="$t('match.replay.prev_round')"
                :disabled="!canPrevRound"
                @click="jumpToRound(-1)"
              >
                <ChevronLeft class="w-4 h-4" />
              </button>
              <RoundSelector
                class="min-w-0 flex-1"
                :rounds="roundStripEntries"
                :model-value="activeRound"
                :halftime-index="roundStripHalftime"
                @update:model-value="selectStripRound"
              />
              <button
                type="button"
                class="inline-flex items-center justify-center w-7 h-7 shrink-0 border border-border/60 rounded-sm text-muted-foreground hover:text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber)/0.7)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                :title="$t('match.replay.next_round')"
                :disabled="!canNextRound"
                @click="jumpToRound(1)"
              >
                <ChevronRight class="w-4 h-4" />
              </button>
            </template>
            <template v-else>
              <div class="flex items-center gap-2 min-w-[9rem] flex-1">
                <input
                  v-model.number="overlayWindowSec"
                  type="range"
                  min="10"
                  max="115"
                  step="5"
                  class="flex-1 accent-[hsl(var(--tac-amber))]"
                  :title="
                    t('match.replay.overlay_buy_window', { sec: overlayWindowSec })
                  "
                />
                <span
                  class="font-mono text-xs tabular-nums text-[hsl(var(--tac-amber))] shrink-0 w-9"
                >
                  {{ overlayWindowSec }}s
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-1">
                <button
                  v-for="rn in fullBuyRounds"
                  :key="rn"
                  type="button"
                  class="inline-flex items-center justify-center min-w-6 h-6 px-1.5 border text-[0.65rem] tabular-nums transition-colors"
                  :class="
                    overlaySelectedRounds.has(rn)
                      ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                      : 'border-border/60 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.7)]'
                  "
                  @click="toggleOverlayRound(rn)"
                >
                  {{ rn }}
                </button>
              </div>
            </template>
            <!-- Overlay toggle: icon-only, pinned at the end of the row. -->
            <button
              v-if="overlayAvailable"
              type="button"
              class="inline-flex items-center justify-center w-7 h-7 shrink-0 border rounded-sm transition-colors ml-auto"
              :class="
                overlayMode
                  ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                  : 'border-border/60 text-muted-foreground hover:text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber)/0.7)]'
              "
              :title="t('match.replay.overlay_buy_section')"
              :aria-pressed="overlayMode"
              @click="overlayMode = !overlayMode"
            >
              <Layers class="w-4 h-4" />
            </button>
          </div>
          <!-- YouTube-style transport: play/step on the left, then a tall
               scrubber that carries the round's kill + grenade event track,
               time readout, speed, and a shortcuts popover. -->
          <div
            ref="playbarRowEl"
            class="flex items-center gap-3 px-3 py-2.5"
          >
            <!-- Left transport cluster -->
            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                class="inline-flex items-center justify-center w-10 h-10 border border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.28)] transition-colors"
                :title="
                  playing ? $t('match.replay.pause') : $t('match.replay.play')
                "
                @click="toggle()"
              >
                <Play v-if="!playing" class="w-5 h-5" />
                <Pause v-else class="w-5 h-5" />
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center w-8 h-10 text-muted-foreground hover:text-[hsl(var(--tac-amber))] transition-colors"
                :title="$t('match.replay.step_back')"
                @click="step(-1)"
              >
                <SkipBack class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center w-8 h-10 text-muted-foreground hover:text-[hsl(var(--tac-amber))] transition-colors"
                :title="$t('match.replay.step_forward')"
                @click="step(1)"
              >
                <SkipForward class="w-4 h-4" />
              </button>
            </div>

            <!-- Scrubber -->
            <div
              class="relative flex-1 min-w-[6rem] h-8 group cursor-pointer select-none"
              @pointerdown="onScrubStart"
            >
              <!-- Kill markers above the rail. -->
              <div
                v-if="!overlayMode"
                class="absolute inset-x-0 top-0 h-3 pointer-events-none"
              >
                <span
                  v-for="(m, i) in scrubberMarkers"
                  v-show="m.lane === 'kill'"
                  :key="'k' + i"
                  class="absolute bottom-0 w-[2px] h-3 -translate-x-1/2 rounded-sm"
                  :style="{ left: m.left + '%', backgroundColor: m.color }"
                  :title="m.title"
                />
              </div>
              <div
                class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 bg-[hsl(var(--border))] rounded-full overflow-hidden group-hover:h-3 transition-[height] duration-100"
              >
                <div
                  class="absolute inset-y-0 left-0 bg-[hsl(var(--tac-amber))] transition-[width] duration-100 ease-linear"
                  :style="{
                    width: (overlayMode ? overlayProgressPct : progressPct) + '%',
                  }"
                />
              </div>
              <!-- Grenade ICONS below the rail (Replay3D-style util lane). -->
              <div
                v-if="!overlayMode"
                class="absolute inset-x-0 -bottom-1 h-4 pointer-events-none"
              >
                <img
                  v-for="(m, i) in scrubberMarkers"
                  v-show="m.lane === 'nade' && m.icon"
                  :key="'n' + i"
                  :src="m.icon"
                  class="absolute top-0 h-4 w-4 -translate-x-1/2 object-contain"
                  :style="{ left: m.left + '%', filter: 'brightness(0) invert(1)' }"
                  :title="m.title"
                />
              </div>
              <div
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_0_2px_hsl(var(--background)),0_0_10px_hsl(var(--tac-amber)/0.6)] transition-[left] duration-100 ease-linear pointer-events-none z-10 group-hover:scale-110"
                :style="{
                  left: (overlayMode ? overlayProgressPct : progressPct) + '%',
                }"
              />
            </div>

            <!-- Time readout -->
            <span
              class="font-mono text-xs tabular-nums text-muted-foreground shrink-0"
            >
              <template v-if="overlayMode">
                {{ formatMMSS(overlayElapsedSec) }}
                <span class="text-muted-foreground/50">/</span>
                {{ formatMMSS(overlayWindowSec) }}
              </template>
              <template v-else>
                {{ formatMMSS(tickIndex * 0.25) }}
                <span class="text-muted-foreground/50">/</span>
                {{ formatMMSS(Math.max(0, ticks.length - 1) * 0.25) }}
              </template>
            </span>

            <div class="w-px h-6 bg-border shrink-0" />

            <!-- Speed -->
            <div class="inline-flex items-center gap-0.5 shrink-0">
              <Gauge class="w-3.5 h-3.5 text-muted-foreground mr-1" />
              <button
                v-for="s of SPEEDS"
                :key="s"
                type="button"
                class="px-1.5 py-0.5 font-mono text-[0.65rem] font-bold tabular-nums transition-colors border rounded-sm"
                :class="
                  speed === s
                    ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                "
                @click="speed = s"
              >
                {{ s }}x
              </button>
            </div>

            <!-- Keyboard shortcuts -->
            <Popover>
              <PopoverTrigger as-child>
                <button
                  type="button"
                  class="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-[hsl(var(--tac-amber))] transition-colors shrink-0"
                  :title="$t('match.replay.shortcuts_title')"
                >
                  <Keyboard class="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                class="w-auto p-3 text-[0.65rem] text-muted-foreground"
              >
                <div
                  class="font-mono text-[0.55rem] tracking-[0.22em] uppercase mb-2"
                >
                  {{ $t("match.replay.shortcuts_title") }}
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="inline-flex items-center gap-1.5">
                    <Kbd>Space</Kbd> {{ $t("match.replay.shortcut_play") }}
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <Kbd>←</Kbd><Kbd>→</Kbd>
                    {{ $t("match.replay.shortcut_step") }}
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <Kbd>[</Kbd><Kbd>]</Kbd>
                    {{ $t("match.replay.shortcut_round") }}
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <Kbd>1</Kbd>–<Kbd>5</Kbd>
                    {{ $t("match.replay.shortcut_speed") }}
                  </span>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
  </div>
</template>

<style scoped>
/* Scoreboard show/hide: slide in from the right edge + fade. */
.scoreboard-enter-active,
.scoreboard-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.scoreboard-enter-from,
.scoreboard-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
/* 2D <-> 3D map swap: fade + a subtle "grow in" scale. */
.mapfade-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.mapfade-leave-active {
  transition: opacity 0.25s ease;
}
.mapfade-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.mapfade-leave-to {
  opacity: 0;
}
</style>
