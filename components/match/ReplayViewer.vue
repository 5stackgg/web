<script lang="ts" setup>
import {
  computed,
  markRaw,
  ref,
  shallowRef,
  toRaw,
  watch,
  onMounted,
  onUnmounted,
} from "vue";
import { useI18n } from "vue-i18n";
import type { Inferno, SmokeVolume } from "~/utils/smokeVolume";
import { isFullBuyRound } from "~/utilities/buyType";
import { useReplayAnalysis } from "~/composables/useReplayAnalysis";
import {
  startMoney,
  teamValuesByRound,
} from "~/utilities/replayAnalysis/buy";
import ReplayStage from "~/components/match/ReplayStage.vue";
import ReplayStageUnavailable from "~/components/match/ReplayStageUnavailable.vue";
import { buildStageFrame } from "~/utilities/replayStage/frame";
import { buildOverlayFrame } from "~/utilities/replayStage/overlayFrame";
import type { StageBlob } from "~/utilities/replayStage/frameIndex";
import type { MapLevel } from "~/utilities/replayStage/mapLevels";
import {
  roundPlan,
  speedAt,
  weaponLabel,
} from "~/utilities/replayStage/director";
import type {
  DirectorLabel,
  DirectorReplay,
} from "~/utilities/replayStage/director";
import { EMPTY_FRAME } from "~/utilities/replayStage/types";
import { RotateCcw, Smartphone } from "lucide-vue-next";
import { useMapCallouts } from "~/composables/useMapCallouts";
import { normalizeMapName } from "~/utilities/mapAssets";
import ReplayChrome from "~/components/match/ReplayChrome.vue";
import ReplayShareMenu from "~/components/match/ReplayShareMenu.vue";
import { useReplayShare } from "~/composables/useReplayShare";

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
  pitch?: number | null;
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
  // Exact firing geometry + outcome (schema v5+). Drives the 3D tracer.
  yaw?: number | null;
  pitch?: number | null;
  eye_x?: number | null;
  eye_y?: number | null;
  eye_z?: number | null;
  result?: "hit" | "headshot" | null;
  impact_x?: number | null;
  impact_y?: number | null;
  impact_z?: number | null;
  // Where a missed round met world geometry (blob v9+). Absent on older blobs
  // and on maps with no collision mesh.
  miss_x?: number | null;
  miss_y?: number | null;
  miss_z?: number | null;
};

type Damage = {
  round: number;
  time: string;
  attacker_steam_id: string | null;
  attacked_steam_id: string;
  damage: number;
  health: number;
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
  // Per-smoke occupancy grids measured against the map's collision mesh
  // (blob schema v9+). Absent on older blobs, which fall back to a disc.
  smokeVolumes?: SmokeVolume[];
  // Per-molotov flame positions and lifetimes (blob schema v9+). Absent on
  // older blobs, which fall back to the invented flame cluster.
  infernos?: Inferno[];
  // CS2's own smoke grids and who each flash blinded (blob schema v11+). Only
  // the new renderer reads them.
  smokeVoxels?: StageBlob["smoke_voxels"];
  flashes?: StageBlob["flashes"];
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
  // The map row's label: a workshop map's name is its workshop id.
  mapTitle?: string | null;
  // Initial map view ("2d" default; "3d" for the standalone 3D page).
  initialView?: "2d" | "3d";
  // One part of a longer page (the welcome page's demo round): the keys only
  // work with focus inside it, there is no match to share, a phone held
  // upright still sees it, and it plays in broadcast while it is on screen
  // without touching the viewer's saved preferences.
  embedded?: boolean;
}>();

// CS2 defaults: 20s freezetime warmup (we anchor to the engine's
// reported freeze_end_tick), 1:55 (115s) round time, 0:40 (40s) bomb
// timer after plant.
const { t } = useI18n();
const ROUND_TIME_SEC = 115;
const BOMB_TIMER_SEC = 40;

// The stage straight down (2D) or in perspective (3D). Toggling preserves all
// playback state.
const viewMode = ref<"2d" | "3d">(props.initialView ?? "2d");

const normalizedMap = computed(() => normalizeMapName(props.mapName ?? ""));

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
// Broadcast mode's held slow motion: a share of `speed` until a tick, while
// an instant replay plays (see playReplay).
const slowmo = shallowRef<{
  speed: number;
  fromTick: number;
  untilTick: number;
} | null>(null);
let slowRate = 1;

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
const SCRUB_UTILITY_COLORS: Record<string, string> = {
  HE: "rgb(239,68,68)",
  Molotov: "rgb(249,115,22)",
  Smoke: "rgb(148,163,184)",
  Flash: "rgb(250,204,21)",
  Decoy: "rgb(34,211,238)",
};
const UTILITY_SCRUB_ICON: Record<string, string> = {
  Smoke: "/img/equipment/smokegrenade.svg",
  Molotov: "/img/equipment/molotov.svg",
  HE: "/img/equipment/hegrenade.svg",
  Flash: "/img/equipment/flashbang.svg",
  Decoy: "/img/equipment/decoy.svg",
};
const scrubberMarkers = computed<
  Array<{
    left: number;
    lane: "kill" | "utility" | "bomb";
    color: string;
    title: string;
    icon?: string;
    gid?: number;
    // Bomb lane: which event; a defuse attempt spans `width` (% of the bar).
    bomb?: "planted" | "defused" | "exploded" | "defuse";
    width?: number;
  }>
>(() => {
  const range = tickRange.value;
  const span = range.max - range.min;
  const round = activeRound.value;
  if (span <= 0 || round === null) {
    return [];
  }
  const out: Array<{
    left: number;
    lane: "kill" | "utility" | "bomb";
    color: string;
    title: string;
    icon?: string;
    gid?: number;
    // Bomb lane: which event; a defuse attempt spans `width` (% of the bar).
    bomb?: "planted" | "defused" | "exploded" | "defuse";
    width?: number;
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
      lane: "utility",
      color: SCRUB_UTILITY_COLORS[g.type] ?? "rgb(148,163,184)",
      title: g.type,
      icon: UTILITY_SCRUB_ICON[g.type],
      gid: g.grenade_id ?? undefined,
    });
  }
  // Bomb plant — a single distinct marker so it's obvious the bomb went down
  // this round (and roughly when).
  const plant = bombPlantThisRound.value;
  if (plant) {
    const left = ((plant.tick - range.min) / span) * 100;
    if (left >= -1 && left <= 101) {
      out.push({
        left: Math.max(0, Math.min(100, left)),
        lane: "bomb",
        color: "#ff5a4d",
        title: plant.site ? `Bomb planted ${plant.site}` : "Bomb planted",
        bomb: "planted",
      });
    }
  }
  // How the bomb ended, and every defuse tried along the way (a band from
  // its start to where it was let go, or finished).
  const at = (tick: number) => ((tick - range.min) / span) * 100;
  const clamp = (left: number) => Math.max(0, Math.min(100, left));
  const bombs = activeRoundBombs.value;
  for (let i = 0; i < bombs.length; i++) {
    const b = bombs[i];
    if (b.type === "defused" || b.type === "exploded") {
      out.push({
        left: clamp(at(b.tick)),
        lane: "bomb",
        color: b.type === "defused" ? SCRUB_KILL_CT : "#ffb03b",
        title: b.type === "defused" ? "Bomb defused" : "Bomb exploded",
        bomb: b.type,
      });
    } else if (b.type === "defuse_begin") {
      const end = bombs
        .slice(i + 1)
        .find(
          (e) =>
            e.type === "defuse_abort" ||
            e.type === "defused" ||
            e.type === "exploded",
        );
      const from = clamp(at(b.tick));
      const to = clamp(at(end ? end.tick : range.max));
      out.push({
        left: from,
        width: Math.max(0.3, to - from),
        lane: "bomb",
        color: SCRUB_KILL_CT,
        title: b.has_kit ? "Defuse attempt (kit)" : "Defuse attempt",
        bomb: "defuse",
      });
    }
  }
  return out;
});

const killFeedDisplay = computed(() =>
  killsBeforeCursor.value.slice().reverse(),
);

const nextTickValue = computed(
  () => ticks.value[Math.min(tickIndex.value + 1, ticks.value.length - 1)] ?? 0,
);

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

// Each player's state at the playhead, for the scoreboard rows.
type LiveState = {
  alive: boolean;
  blinded: number;
  // null when the loaded demo predates the health column — skip
  // rendering the bar entirely rather than showing a fake full bar.
  health: number | null;
  armor: number | null;
  helmet: boolean;
  hasBomb: boolean;
};
const liveStateBySteam = computed(() => {
  const out = new Map<string, LiveState>();
  const t0 = currentTick.value;
  const t1 = nextTickValue.value;
  const span = Math.max(1, t1 - t0);
  const f = fractional.value;
  const flashesNow = flashesByRound.value.get(activeRound.value ?? -1);

  for (const [sid, samples] of positionsByPlayer.value) {
    const a = samples.find((p) => p.tick === t0);
    const b = samples.find((p) => p.tick === t1);
    const cur = a ?? b;
    if (!cur) continue;
    const next = b ?? a!;
    const blend =
      a && b ? Math.min(1, Math.max(0, (next.tick - t0) / span)) : 0;
    const k = blend * f;

    const yawA = cur.yaw ?? 0;
    const yawB = next.yaw ?? yawA;
    const yaw = lerpAngle(yawA, yawB, k);
    const x = cur.x + (next.x - cur.x) * k;
    const y = cur.y + (next.y - cur.y) * k;
    const blinded = cur.alive ? blindStrengthFor(x, y, yaw, flashesNow, t0) : 0;

    // HP: lerp between samples so the bar smoothly shrinks across the 0.25s
    // sample gap. null when neither sample carries health (older demos).
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

    out.set(sid, {
      alive: cur.alive,
      blinded,
      health,
      armor,
      helmet: cur.helmet === true || next.helmet === true,
      hasBomb: cur.has_bomb === true,
    });
  }
  return out;
});

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

// Sub-sample-smoothed tick. tickIndex steps once every SAMPLE_SEC (0.25s)
// so a tick-only animation feels like 4fps. Blending with `fractional`
// (the rAF-driven [0,1) progress toward the next sample) gives a real-
// numbered tick that updates at display rate.
const smoothCurrentTick = computed(() => {
  const t0 = currentTick.value;
  const t1 = nextTickValue.value;
  return t0 + (t1 - t0) * fractional.value;
});

let rafHandle: number | null = null;
let lastFrameTs = 0;

// The playback speed this frame: the user's, eased into and out of the
// director's slow motion while one is held.
function playbackRate(dt: number) {
  const tick = smoothCurrentTick.value;
  const plan = broadcastLive.value ? directorPlan.value : null;
  // The plan's own curve: eased slow motion on its big moments, and quiet
  // stretches hurried through when condensed is on.
  let want = plan
    ? speedAt(plan, tick, {
        slowmo: broadcastSlowmo.value,
        condensed: broadcastCondensed.value,
      })
    : 1;
  const held = slowmo.value;
  if (
    held &&
    (!broadcastLive.value || tick >= held.untilTick || tick < held.fromTick - 1)
  ) {
    slowmo.value = null;
  }
  if (slowmo.value) {
    want = Math.min(want, slowmo.value.speed);
  }
  slowRate += (want - slowRate) * (1 - Math.exp(-dt / 0.12));
  if (Math.abs(slowRate - want) < 0.005) {
    slowRate = want;
  }
  return speed.value * slowRate;
}

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
  // Samples are 4Hz but every tick around a grenade throw, so each step
  // lasts as long as the ticks it spans; a fixed 0.25s per sample played
  // every throw about sixteen times slow.
  const rate = props.tickRate || 64;
  let left = dt * playbackRate(dt);
  while (left > 0) {
    const span = Math.max(1, nextTickValue.value - currentTick.value) / rate;
    const toNext = (1 - fractional.value) * span;
    if (left < toNext) {
      fractional.value += left / span;
      break;
    }
    left -= toNext;
    fractional.value = 0;
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
  slowmo.value = null;
  slowRate = 1;
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
      Math.min(
        overlayWindowSec.value,
        overlayElapsedSec.value + delta * STEP_SEC,
      ),
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

function jumpToRound(delta: number) {
  // Single-round navigation is meaningless while the overlay stacks
  // every selected round on one clock.
  if (overlayMode.value) return;
  pause();
  const idx = rounds.value.indexOf(activeRound.value ?? rounds.value[0]);
  const next = Math.max(0, Math.min(rounds.value.length - 1, idx + delta));
  activeRound.value = rounds.value[next] ?? null;
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
//   L              next storey (stage, stacked maps)
//   B              broadcast camera (stage)
//   G              fog of war and sight lines (stage)
function onKeyDown(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (props.embedded && !layoutRootEl.value?.contains(t)) return;
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
    (tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      t.isContentEditable)
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
    case "l":
    case "L":
      if (
        stageActive.value &&
        stageLevels.value.length &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        levelsSideBySide.value = !levelsSideBySide.value;
      }
      return;
    case "b":
    case "B":
      if (stageActive.value && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleBroadcast();
      }
      return;
    case "g":
    case "G":
      if (stageActive.value && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        showVision.value = !showVision.value;
      }
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

// Embedded, the round plays while it is on screen and stops off it.
let embeddedObserver: IntersectionObserver | undefined;
onMounted(() => {
  if (
    !props.embedded ||
    !layoutRootEl.value ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  embeddedObserver = new IntersectionObserver(
    ([entry]) => (entry?.isIntersecting ? play() : pause()),
    { threshold: 0.5 },
  );
  embeddedObserver.observe(layoutRootEl.value);
});
onUnmounted(() => embeddedObserver?.disconnect());

// Focus target: clicking a player in the roster or on the stage follows
// them. Click again to clear. Single-select — focusing a new player swaps
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
// Toggle for the round's death (kill-location) markers on the map.
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

// Where the match was played, the outliers trimmed: what the stage frames
// on a map with no callouts (a Rush room, not the twenty around it).
const stagePlay = computed(() => {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const p of props.positions) {
    if (p.alive && p.x != null && p.y != null && p.z != null) {
      xs.push(p.x);
      ys.push(p.y);
      zs.push(p.z);
    }
  }
  if (xs.length < 20) {
    return null;
  }
  const trim = (values: number[]) => {
    values.sort((a, b) => a - b);
    return [
      values[Math.floor(values.length * 0.01)],
      values[Math.floor(values.length * 0.99)],
    ];
  };
  const [x0, x1] = trim(xs);
  const [y0, y1] = trim(ys);
  const [z0, z1] = trim(zs);
  return { min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } };
});

// No WebGL2, or no model of this map: a message stands in the stage's place.
const stageUnavailable = ref<"unsupported" | "missing-map" | null>(null);
const stageActive = computed(() => !stageUnavailable.value);
const stageEl = ref<InstanceType<typeof ReplayStage> | null>(null);

// The stage reads the blob as one object, indexed once in a WeakMap, and
// walks every row: the parts arrive here separately and reactive, so they are
// put back together unwrapped.
const stageBlob = computed(
  () =>
    markRaw({
      schema_version: 0,
      match_map_id: "",
      map_name: props.mapName ?? null,
      tick_rate: props.tickRate || 64,
      total_ticks: 0,
      positions: toRaw(props.positions) ?? [],
      shots_fired: toRaw(props.shots) ?? [],
      damages: toRaw(props.damages) ?? [],
      grenade_throws: toRaw(props.grenades) ?? [],
      grenade_trajectories: toRaw(props.grenadeTrajectories) ?? [],
      smoke_volumes: toRaw(props.smokeVolumes) ?? [],
      smoke_voxels: toRaw(props.smokeVoxels) ?? [],
      flashes: toRaw(props.flashes),
      infernos: toRaw(props.infernos) ?? [],
      kills: toRaw(props.demoKills) ?? [],
      bombs: toRaw(props.demoBombs) ?? [],
      kit_drops: toRaw(props.demoKitDrops) ?? [],
      round_ticks: toRaw(props.demoRoundTicks) ?? [],
      players: toRaw(props.demoPlayers) ?? [],
    }) as StageBlob,
);

// The chrome's legend filter, in the stage's utility types.
const stageUtility = computed(() => {
  const f = utilTypeFilter.value;
  return {
    smoke: f.Smoke !== false,
    molotov: f.Molotov !== false,
    incendiary: f.Molotov !== false,
    he: f.HE !== false,
    flash: f.Flash !== false,
    decoy: f.Decoy !== false,
  };
});
const stageSlots = computed(() => {
  const out: Record<string, number> = {};
  for (const [id, entry] of Object.entries(slotByPlayer.value)) {
    out[id] = entry.slot;
  }
  return out;
});

// The buy-round overlay's team filter: one lineup's players across halves.
const overlayInclude = computed(() => {
  if (overlayTeam.value === "all") {
    return null;
  }
  const ids = new Set<string>();
  for (const [id, lineup] of lineupBySteam.value) {
    if (lineup === overlayTeam.value) {
      ids.add(id);
    }
  }
  return ids;
});
// Seconds of walk behind each player stacked in the overlay.
const OVERLAY_TAIL_SECS = 5;

const stageFrame = computed(() => {
  if (overlayMode.value) {
    return buildOverlayFrame(
      stageBlob.value,
      overlayRoundsArr.value,
      overlayElapsedSec.value,
      {
        include: overlayInclude.value,
        utility: stageUtility.value,
        tail: OVERLAY_TAIL_SECS,
        callouts: showCallouts.value,
        levelBand: stageLevelBand.value,
      },
    );
  }
  if (activeRound.value === null) {
    return EMPTY_FRAME;
  }
  return buildStageFrame(
    stageBlob.value,
    activeRound.value,
    smoothCurrentTick.value,
    {
      names: playerNameMap.value,
      avatars: showAvatars.value ? playerAvatarMap.value : undefined,
      slots: showAvatars.value ? undefined : stageSlots.value,
      selectedId: focusedPlayerId.value,
      utility: stageUtility.value,
      selectedGids: selectedGi.value,
      heatmap: heatOn.value,
      trails: pathingMode.value !== "off",
      deaths: showDeaths.value,
      groundBomb: showGroundBomb.value,
      groundKits: showGroundKits.value,
      callouts: showCallouts.value,
      levelBand: stageLevelBand.value,
      vision: showVision.value,
      visionSide: visionSidePin.value,
    },
  );
});

// Picking a player follows them; letting go hands the camera back. Moving
// the camera by hand stops following, so it lets go of the player too.
watch([focusedPlayerId, () => stageEl.value?.camera], ([id, camera]) =>
  camera?.setFollow(!!id),
);
watch(
  () => stageEl.value?.camera,
  (camera, _, onCleanup) => {
    if (camera) {
      const off = [
        camera.onFollowChange((following) => {
          if (!following) {
            focusedPlayerId.value = null;
          }
        }),
        camera.onPlayerClick(toggleFocus),
        // A heatmap disc or a picked grenade's landing toggles that grenade.
        // A cluster of them picks them all, or lets them all go.
        camera.onClick((x, y, slop) => {
          const gids = stageEl.value?.utility?.pickUtilities(x, y, slop);
          if (!gids?.length) {
            return;
          }
          const all = gids.every((gid) => selectedGi.value.includes(gid));
          selectedGi.value = all
            ? selectedGi.value.filter((gid) => !gids.includes(gid))
            : [...new Set([...selectedGi.value, ...gids])];
        }),
        camera.onViewKey(() => {
          viewMode.value = viewMode.value === "3d" ? "2d" : "3d";
        }),
      ];
      onCleanup(() => off.forEach((fn) => fn()));
    }
  },
);

// Broadcast mode: the camera plays the round's planned shots, with planned
// slow motion on the big moments. Moving the camera by hand, or following a
// player, pauses it until the toggle (or B) resumes it; the preference
// itself stays on.
const broadcastOn = props.embedded
  ? ref(true)
  : persistedBool("5s.replay.broadcast", false);
const broadcastSlowmo = persistedBool("5s.replay.broadcast_slowmo", true);
const broadcastPaused = ref(false);
const broadcastShot = shallowRef<DirectorLabel | null>(null);
const broadcastLive = computed(
  () => broadcastOn.value && !broadcastPaused.value && stageActive.value,
);
const broadcastState = computed(() =>
  !broadcastOn.value ? "off" : broadcastPaused.value ? "paused" : "on",
);
// "1v2 clutch · ResQ (AWP) · B Site", and what is coming up during a lull.
function shotCaption(kind: string, place: string | null, extra?: string) {
  return [kind, extra, place].filter(Boolean).join(" · ");
}
const broadcastCaption = computed(() => {
  const shot = broadcastShot.value;
  if (!shot || !broadcastLive.value) {
    return null;
  }
  const kind = t(`match.replay.chrome.shot_${shot.kind}`, {
    n: shot.versus ?? 1,
  });
  const weapon = shot.weapon ? weaponLabel(shot.weapon) : null;
  const player = shot.player
    ? weapon
      ? `${shot.player} (${weapon})`
      : shot.player
    : undefined;
  return shotCaption(kind, shot.place, player);
});
const broadcastNext = computed(() => {
  const next = broadcastShot.value?.next;
  if (!next || !broadcastLive.value) {
    return null;
  }
  return t("match.replay.chrome.shot_coming_up", {
    shot: shotCaption(
      t(`match.replay.chrome.shot_${next.kind}`, { n: 1 }),
      next.place,
    ),
  });
});

function toggleBroadcast() {
  if (broadcastOn.value && broadcastPaused.value) {
    broadcastPaused.value = false;
    return;
  }
  broadcastOn.value = !broadcastOn.value;
  broadcastPaused.value = false;
}

// The round's plan: the shots, slow motion and replays the director worked
// out ahead of time (director.ts), built once per round while it is on.
const directorPlan = computed(() =>
  broadcastOn.value && stageActive.value && activeRound.value !== null
    ? roundPlan(stageBlob.value, activeRound.value)
    : null,
);
const broadcastCondensed = persistedBool(
  "5s.replay.broadcast_condensed",
  false,
);

// Once the action settles the plan offers an instant replay (a fight it cut
// away from, or a multi-kill): a chip that rewinds to it and plays it at half
// speed from a new angle.
const REPLAY_OFFER_MS = 6000;
const REPLAY_SPEED = 0.5;
const replayOffer = shallowRef<DirectorReplay | null>(null);
let replayOfferTimer: ReturnType<typeof setTimeout> | null = null;

function offerReplay(offer: DirectorReplay) {
  if (!playing.value) {
    return;
  }
  replayOffer.value = offer;
  if (replayOfferTimer) {
    clearTimeout(replayOfferTimer);
  }
  replayOfferTimer = setTimeout(() => {
    replayOffer.value = null;
  }, REPLAY_OFFER_MS);
}

function seekToTick(tick: number) {
  const list = ticks.value;
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (list[mid] <= tick) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  const next = list[lo + 1];
  tickIndex.value = lo;
  fractional.value =
    next !== undefined && next > list[lo]
      ? Math.min(0.999, Math.max(0, (tick - list[lo]) / (next - list[lo])))
      : 0;
}

function playReplay() {
  const offer = replayOffer.value;
  const camera = stageEl.value?.camera;
  replayOffer.value = null;
  if (!offer || !camera) {
    return;
  }
  camera.replay(offer);
  seekToTick(offer.fromTick);
  slowmo.value = {
    speed: REPLAY_SPEED,
    fromTick: offer.fromTick,
    untilTick: offer.untilTick,
  };
  play();
}

watch(
  () => stageEl.value?.camera,
  (camera, _, onCleanup) => {
    if (!camera) {
      return;
    }
    const off = [
      camera.onDirectorChange((directing) => {
        // The director stopping by itself means input took the camera.
        if (!directing && broadcastLive.value) {
          broadcastPaused.value = true;
        }
      }),
      camera.onDirectorShot((shot) => {
        broadcastShot.value = shot;
      }),
      camera.onDirectorReplay(offerReplay),
    ];
    camera.setDirectorPlan(directorPlan.value);
    camera.setDirector(broadcastLive.value);
    onCleanup(() => off.forEach((fn) => fn()));
  },
);
watch(directorPlan, (plan) => stageEl.value?.camera?.setDirectorPlan(plan));
watch(broadcastLive, (live) => {
  stageEl.value?.camera?.setDirector(live);
  if (!live) {
    slowmo.value = null;
    replayOffer.value = null;
  }
});
watch(activeRound, () => {
  replayOffer.value = null;
});
onUnmounted(() => {
  if (replayOfferTimer) {
    clearTimeout(replayOfferTimer);
  }
});

// Stacked maps (Nuke, Vertigo): which storey the stage shows. Following a
// player tracks the storey they stand on; picking one by hand holds until
// the focus changes. With nobody followed it is the pick, else the top.
const stageLevels = shallowRef<MapLevel[]>([]);
const levelPick = ref<string | null>(null);
const levelPickedInFocus = ref(false);
const levelFollowed = ref<string | null>(null);
// Both storeys laid side by side on the table (the default), or one at a
// time with the rest cut away.
const levelsSideBySide = persistedBool("5s.replay.levels_layout_side", true);
// How far past a storey's edge a followed player goes before it switches, so
// walking the stairs does not flicker between them.
const LEVEL_HYSTERESIS = 32;

function onStageLevels(levels: MapLevel[]) {
  stageLevels.value = levels;
  levelPick.value = null;
  levelFollowed.value = null;
}

function followLevel(levels: MapLevel[], current: string | null, z: number) {
  const found = levels.findIndex((level) => z >= level.from);
  const target = found < 0 ? levels.length - 1 : found;
  const at = levels.findIndex((level) => level.id === current);
  if (at < 0 || at === target) {
    return levels[target].id;
  }
  const clear =
    target < at
      ? z >= levels[target].from + LEVEL_HYSTERESIS
      : z < levels[at].from - LEVEL_HYSTERESIS;
  return clear ? levels[target].id : current;
}

const stageLevel = computed(() => {
  const levels = stageLevels.value;
  if (!levels.length || levelsSideBySide.value) {
    return null;
  }
  if (
    focusedPlayerId.value &&
    !levelPickedInFocus.value &&
    levelFollowed.value
  ) {
    return levelFollowed.value;
  }
  return levelPick.value ?? levels[0].id;
});

function pickLevel(id: string) {
  levelPick.value = id;
  levelPickedInFocus.value = !!focusedPlayerId.value;
}

// Players off the storey in view dim; this is the height band that is on it.
const stageLevelBand = computed(() => {
  const level = stageLevels.value.find((l) => l.id === stageLevel.value);
  if (!level) {
    return null;
  }
  return level.below != null
    ? { min: -Infinity, max: level.below }
    : { min: level.from, max: Infinity };
});

const chromeLevels = computed(() =>
  stageActive.value ? stageLevels.value.map((level) => level.id) : [],
);

// A workshop map's file name is its id: the stage titles it with the label.
const stageMapTitle = computed(() =>
  props.mapTitle && /^\d+$/.test(normalizedMap.value) ? props.mapTitle : null,
);

// The followed player's height, for the storey to follow them.
const focusedZ = computed(() => {
  const id = focusedPlayerId.value;
  if (!id || !stageActive.value || !stageLevels.value.length) {
    return null;
  }
  return stageFrame.value.players.find((p) => p.id === id)?.z ?? null;
});
watch([focusedPlayerId, focusedZ], ([id, z], [previous]) => {
  if (id !== previous) {
    levelPickedInFocus.value = false;
    levelFollowed.value = null;
  }
  if (z !== null) {
    levelFollowed.value = followLevel(
      stageLevels.value,
      levelFollowed.value,
      z,
    );
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
const { hasCallouts } = useMapCallouts(normalizedMap);
const showGroundBomb = persistedBool("5s.replay.show_ground_bomb", true);
const showGroundKits = persistedBool("5s.replay.show_ground_kits", true);
// The map's own vocabulary, off by default: it is a reference layer, and the
// board is busy enough during a round without forty labelled boxes under it.
const showCallouts = persistedBool("5s.replay.show_callouts", false);
// Fog of war and who sees whom on the stage; off by default, an analysis layer.
const showVision = persistedBool("5s.replay.show_vision", false);
// Whose sight the fog shows once a side is picked; until then (null) the
// followed player's side, or both sides while nobody is followed.
type VisionSide = "ct" | "t" | "both";
const VISION_SIDE_KEY = "5s.replay.vision_side";
const visionSidePin = ref<VisionSide | null>(null);
if (typeof window !== "undefined") {
  try {
    const v = localStorage.getItem(VISION_SIDE_KEY);
    if (v === "ct" || v === "t" || v === "both") visionSidePin.value = v;
  } catch {
    /* localStorage unavailable */
  }
}
watch(visionSidePin, (v) => {
  try {
    if (v) localStorage.setItem(VISION_SIDE_KEY, v);
    else localStorage.removeItem(VISION_SIDE_KEY);
  } catch {
    /* private browsing — fail silent */
  }
});
// Picking the side already pinned goes back to following the player.
function pickVisionSide(side: VisionSide) {
  visionSidePin.value = visionSidePin.value === side ? null : side;
}
// Pathing always starts off — it's a heavy overlay, not a sticky preference.
const pathingMode = ref<PathingMode>("off");
// TRACE is a simple on/off for the live-tracing "progress" mode.
function togglePathing() {
  pathingMode.value = pathingMode.value === "off" ? "progress" : "off";
}

// ── Buy-round overlay ──────────────────────────────────────────────
// Optional mode (off by default): instead of one round at a time, stack
// every selected full-buy round on a shared "seconds since freezetime"
// clock so you can study utility + CT/T setups across all buys at once.
const overlayMode = ref(false);
const overlayWindowSec = ref(30); // slider 10..115
// util-summary team filter: show all / only team 1 / only team 2 (persistent
// team membership, NOT side — sides swap at halftime across stacked rounds).
const overlayTeam = ref<"all" | "1" | "2">("all");
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
// A side's buy is its freeze-end equipment value; without loadouts, the
// money it went into the round with. The money on a round is what the
// lineups ended it with, so the round's own figure belongs to the next one.
const fullBuyRounds = computed<number[]>(() => {
  const out: number[] = [];
  const economy = props.roundEconomy ?? [];
  const values = teamValuesByRound(props.roundInventory ?? []);
  for (const r of economy) {
    const v = values.get(r.round);
    const full = v
      ? isFullBuyRound(v.ct, v.t)
      : isFullBuyRound(
          startMoney(economy, r.round, "ct"),
          startMoney(economy, r.round, "t"),
        );
    if (!full) continue;
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

// switching the util-summary team filter (or back to ALL) restarts the shared clock
watch(overlayTeam, () => {
  overlayElapsedSec.value = 0;
});

function toggleOverlayRound(round: number) {
  const next = new Set(overlaySelectedRounds.value);
  if (next.has(round)) next.delete(round);
  else next.add(round);
  overlaySelectedRounds.value = next;
}

const layoutRootEl = ref<HTMLElement | null>(null);

// ── Mobile / orientation handling ──────────────────────────────────────────
// The replay stage is built for a wide layout (floating scoreboard + a
// horizontal transport bar), so on touch devices — phones AND tablets — we
// (1) gate it behind a "rotate to landscape" prompt and (2) hand ReplayChrome a
// `mobile` flag so it scales its panels down. `(pointer: coarse)` is the
// primary-touch signal (true on phones/tablets, false on a mouse/trackpad
// laptop even if it has a touchscreen). The chrome scoreboard gets its own
// visibility ref so it can be collapsed for room.
const isCoarsePointer = ref(false);
const isPortrait = ref(false);
const isTablet = ref(false);
const chromeScoreboardOpen = ref(true);
let orientationMql: MediaQueryList | null = null;
function syncMobileEnv() {
  isPortrait.value = orientationMql?.matches ?? false;
  // Tablet = a touch device whose SHORT edge is large (≥600px) — orientation
  // independent, so a phone in landscape (short edge ~400) stays a phone.
  isTablet.value =
    isCoarsePointer.value &&
    Math.min(window.innerWidth, window.innerHeight) >= 600;
}
// Compact chrome on any touch device.
const mobileChrome = computed(() => isCoarsePointer.value);
// Block the viewer while a touch device is held portrait — the wide layout is
// unusable that narrow, so we ask the user to rotate instead of cramming it.
const needsRotate = computed(
  () => !props.embedded && isCoarsePointer.value && isPortrait.value,
);

onMounted(() => {
  if (typeof window === "undefined" || !window.matchMedia) return;
  isCoarsePointer.value = window.matchMedia("(pointer: coarse)").matches;
  orientationMql = window.matchMedia("(orientation: portrait)");
  orientationMql.addEventListener("change", syncMobileEnv);
  syncMobileEnv();
  // Phones start collapsed (scoreboard + play-by-play) for room; tablets have
  // enough space to keep both up. Either stays toggleable from the chrome.
  const compact = mobileChrome.value && !isTablet.value;
  chromeScoreboardOpen.value = !compact;
  if (compact) showPbpPanel.value = false;
  // On touch, start with only smokes shown — the full utility set clutters the
  // smaller map; the rest are one tap away in the util filters.
  if (mobileChrome.value) {
    utilTypeFilter.value = {
      Smoke: true,
      Molotov: false,
      HE: false,
      Flash: false,
      Decoy: false,
    };
  }
});
onUnmounted(() => {
  orientationMql?.removeEventListener("change", syncMobileEnv);
});

// Fullscreen the stage (map + chrome). Desktop-only: the button is hidden on
// touch because iOS (incl. iOS Chrome, which is WebKit) has no element
// Fullscreen API at all, and the CSS "fake fullscreen" still can't hide the
// address bar there — so it's not worth the surprise. Android/desktop use the
// real API (with webkit fallback).
const isFullscreen = ref(false);
function nativeFsElement(): Element | null {
  if (typeof document === "undefined") return null;
  return (
    document.fullscreenElement ??
    ((document as any).webkitFullscreenElement || null)
  );
}
function syncFullscreen() {
  isFullscreen.value = !!nativeFsElement();
}
async function toggleFullscreen() {
  if (typeof document === "undefined") return;
  const el = layoutRootEl.value as any;
  if (nativeFsElement()) {
    const exit =
      document.exitFullscreen ?? (document as any).webkitExitFullscreen;
    try {
      await exit?.call(document);
    } catch {
      /* ignore */
    }
    return;
  }
  const req = el?.requestFullscreen ?? el?.webkitRequestFullscreen;
  try {
    await req?.call(el);
  } catch {
    /* permissions-policy rejection — leave state as the event reports */
  }
}
onMounted(() => {
  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("webkitfullscreenchange", syncFullscreen as any);
  syncFullscreen();
});
onUnmounted(() => {
  document.removeEventListener("fullscreenchange", syncFullscreen);
  document.removeEventListener("webkitfullscreenchange", syncFullscreen as any);
});

const SPEEDS = [0.5, 1, 2, 4, 8];

function colorFor(team: string | null) {
  if (team === "t") return "hsl(33, 94%, 58%)";
  if (team === "ct") return "hsl(210, 80%, 60%)";
  return "hsl(0, 0%, 60%)";
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

// Play-by-play for the active round: kills + utility + bomb, up to cursor.
const pbp3d = computed(() => {
  const cursor = currentTick.value;
  const rt = activeRoundTick.value;
  const fe = rt?.freeze_end_tick ?? rt?.start_tick ?? 0;
  const rate = props.tickRate || 64;
  const names = playerNameMap.value;
  const evts: Array<{
    t: number;
    kind: string;
    a?: string;
    b?: string;
    w?: string;
    hs?: boolean;
    team?: string | null;
    gid?: number | null;
    kill?: EnrichedKill;
  }> = [];
  for (const k of killsByRound.value.get(activeRound.value ?? -1) ?? []) {
    if (k.tick > cursor) continue;
    evts.push({
      t: k.tick,
      kind: "kill",
      a: names[String(k.killer ?? "")] ?? "",
      b: names[String(k.victim ?? "")] ?? "",
      w: k.weapon ?? "",
      hs: !!k.headshot,
      team: k.killer_team ?? null,
      kill: k,
    });
  }
  for (const g of roundGrenades.value) {
    if (g.phase !== "thrown" || g.tick > cursor) continue;
    evts.push({
      t: g.tick,
      kind: "util",
      a: names[String(g.thrower_steam_id ?? "")] ?? "",
      w: g.type,
      team: g.thrower_team ?? null,
      gid: g.grenade_id ?? null,
    });
  }
  for (const b of activeRoundBombs.value) {
    if (b.tick > cursor) continue;
    if (b.type === "planted")
      evts.push({
        t: b.tick,
        kind: "bomb",
        a: names[String(b.player ?? "")] ?? "",
        w: "planted",
      });
    else if (b.type === "defused")
      evts.push({
        t: b.tick,
        kind: "bomb",
        a: names[String(b.player ?? "")] ?? "",
        w: "defused",
      });
  }
  // Whole round, newest first — the PBP panel is scrollable.
  evts.sort((x, y) => y.t - x.t);
  return evts.map((e) => ({
    ...e,
    sec: Math.max(0, Math.round((e.t - fe) / rate)),
  }));
});

// ===================================================================
// Unified chrome (ReplayChrome) adapters — map ReplayViewer's live
// playback state onto Replay3D's bp-* chrome shape so 2D and 3D share
// ONE identical chrome. Only the map underneath differs.
// ===================================================================
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

function utilityArray(lo: RoundInventoryEntry | undefined): string[] {
  if (!lo) return [];
  const out: string[] = [];
  for (let i = 0; i < (lo.flash ?? 0); i++) out.push("flash");
  for (let i = 0; i < (lo.smoke ?? 0); i++) out.push("smoke");
  for (let i = 0; i < (lo.he ?? 0); i++) out.push("he");
  for (let i = 0; i < (lo.molotov ?? 0); i++) out.push("molotov");
  for (let i = 0; i < (lo.decoy ?? 0); i++) out.push("decoy");
  return out;
}

const {
  summary: roundAnalysis,
  killTrade,
  flashNote,
  playerValue,
} = useReplayAnalysis({
  round: () => activeRound.value,
  kills: () => roundKills.value,
  grenades: () => roundGrenades.value,
  flashes: () => props.flashes,
  inventory: () => props.roundInventory,
  economy: () => props.roundEconomy,
  sideByRound: () => sideByRound.value,
  cursor: () => currentTick.value,
  roundEnd: () => activeRoundTick.value?.end_tick ?? null,
  tickRate: () => props.tickRate || 64,
  name: (sid) => playerNameMap.value[sid] ?? "",
});

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
      blinded: (ls?.alive && ls.blinded) || 0,
      hp: ls?.alive ? (ls?.health ?? 0) : 0,
      armor: ls?.armor ?? 0,
      helmet: ls?.helmet ?? false,
      k: st.k,
      d: st.d,
      a: st.a,
      dmg: st.dmg,
      weapon: lo?.primary || lo?.secondary || null,
      utility: utilityArray(lo),
      bomb: ls?.hasBomb ?? false,
      kit: lo?.kit ?? false,
      avatarUrl: r.avatarUrl,
      value: playerValue(r.steamId),
    };
  });
}
const chromeTeamA = computed(() => buildChromeRows(lineupRows.value.ct, 0));
const chromeTeamB = computed(() => buildChromeRows(lineupRows.value.t, 1));
const chromeHud = computed(() => {
  const ss = sideScores.value;
  const tm = timer.value;
  return {
    ct: ss.ct,
    t: ss.t,
    round: activeRoundTick.value?.round ?? activeRound.value ?? 0,
    clock: formatMMSS(tm.secondsRemaining),
    // Just the countdown — the chrome renders the C4 icon in front of it.
    bomb: tm.phase === "bomb" ? `${tm.secondsRemaining}s` : "",
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
        trade: killTrade(e.kill),
      };
    if (e.kind === "util")
      return {
        time: `${e.sec}s`,
        util: e.w,
        thrower: e.a,
        tc: colorFor(e.team ?? null),
        gi: e.gid ?? undefined,
        flash: e.w === "Flash" ? flashNote(e.gid) : undefined,
      };
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
  for (const g of roundGrenades.value) {
    if (g.phase === "thrown" && g.grenade_id != null) {
      nameByGid.set(
        g.grenade_id,
        playerNameMap.value[String(g.thrower_steam_id ?? "")] ?? "",
      );
    }
  }
  return scrubberMarkers.value
    .filter((m) => m.lane === "utility" && m.icon)
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
    .filter((m) => m.lane === "kill" || m.lane === "bomb")
    .map((m) => ({
      frac: m.left / 100,
      width: m.width != null ? m.width / 100 : undefined,
      cls:
        m.lane === "bomb"
          ? m.bomb === "defused"
            ? "mk-bomb mk-defused"
            : m.bomb === "exploded"
              ? "mk-bomb mk-exploded"
              : m.bomb === "defuse"
                ? "mk-defuse"
                : "mk-bomb"
          : m.color === SCRUB_KILL_CT
            ? "mk-ct"
            : m.color === SCRUB_KILL_T
              ? "mk-t"
              : "mk-ct",
    })),
);
const chromeSeekFrac = computed(() =>
  overlayMode.value ? overlayProgressPct.value / 100 : progressPct.value / 100,
);
// Seconds into the round's samples, from ticks: the samples are not evenly
// spaced, so their index is not a clock.
const roundElapsedSec = computed(
  () => (smoothCurrentTick.value - tickRange.value.min) / (props.tickRate || 64),
);
const roundLengthSec = computed(
  () => (tickRange.value.max - tickRange.value.min) / (props.tickRate || 64),
);
const chromeTimeLabel = computed(() =>
  overlayMode.value
    ? `${formatMMSS(overlayElapsedSec.value)} / ${formatMMSS(overlayWindowSec.value)}`
    : `${formatMMSS(roundElapsedSec.value)} / ${formatMMSS(roundLengthSec.value)}`,
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
    overlayElapsedSec.value = Math.max(
      0,
      Math.min(overlayWindowSec.value, frac * overlayWindowSec.value),
    );
    return;
  }
  // The bar is drawn by tick (progressPct), and samples bunch up around
  // throws, so land on the tick under the pointer, not the nth sample.
  const list = ticks.value;
  if (list.length < 2) {
    tickIndex.value = 0;
    fractional.value = 0;
    return;
  }
  const first = list[0];
  const last = list[list.length - 1];
  const target = first + Math.min(1, Math.max(0, frac)) * (last - first);
  let lo = 0;
  let hi = list.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = list[hi] - list[lo];
  tickIndex.value = lo;
  fractional.value =
    span > 0 ? Math.min(0.999, Math.max(0, (target - list[lo]) / span)) : 0;
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
const overlayRoundsArr = computed(() =>
  Array.from(overlaySelectedRounds.value),
);
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

// Links to the moment on screen, and clip export of the stage (the share
// button in the chrome's transport).
const replayShare = useReplayShare({
  stage: () => stageEl.value,
  stageActive: () => stageActive.value,
  rounds: () => rounds.value,
  round: activeRound,
  ticks: () => ticks.value,
  tickIndex,
  fractional,
  tick: () => smoothCurrentTick.value,
  tickRate: () => props.tickRate || 64,
  liveStart: () => activeRoundTick.value?.freeze_end_tick ?? null,
  playing: () => playing.value,
  play,
  pause,
  speed,
  view: viewMode,
  level: () => stageLevel.value,
  levels: () => stageLevels.value,
  pickLevel,
  follow: focusedPlayerId,
  caption: () => {
    const ctLineup = lineupRows.value.ct
      .map((row) => lineupBySteam.value.get(row.steamId))
      .find(Boolean);
    const board = scoreboard.value;
    const hud = chromeHud.value;
    const swapped = ctLineup === "2";
    return {
      ctName: swapped ? board.rightName : board.leftName,
      tName: swapped ? board.leftName : board.rightName,
      ctScore: hud.ct,
      tScore: hud.t,
      round: hud.round,
      clock: hud.clock,
      bomb: hud.bomb || null,
    };
  },
  mapName: () => props.mapName ?? null,
});
</script>

<template>
  <div class="flex flex-col gap-3 flex-1 min-h-0">
    <div
      ref="layoutRootEl"
      class="relative w-full flex-1 min-h-0 overflow-hidden bg-black"
    >
      <ReplayStage
        v-if="!stageUnavailable"
        ref="stageEl"
        class="absolute inset-0 z-[1]"
        :map-name="mapName?.trim() || null"
        :frame="stageFrame"
        :view="viewMode"
        :level="stageLevel"
        :level-layout="levelsSideBySide ? 'side' : 'single'"
        :map-title="stageMapTitle"
        :play="stagePlay"
        @unsupported="stageUnavailable = 'unsupported'"
        @missing-map="stageUnavailable = 'missing-map'"
        @levels="onStageLevels"
      />
      <ReplayStageUnavailable
        v-else
        class="z-[1]"
        :reason="stageUnavailable"
      />

      <!-- Unified chrome (Replay3D look) — shown over BOTH 2D and 3D so the
             player is identical; only the map underneath differs. -->
      <ReplayChrome
        class="z-[20]"
        :mobile="mobileChrome"
        :show-scoreboard="chromeScoreboardOpen"
        :on-toggle-scoreboard="() => (chromeScoreboardOpen = !chromeScoreboardOpen)"
        :is-fullscreen="isFullscreen"
        :on-fullscreen="toggleFullscreen"
        :hud="chromeHud"
        :team-a="chromeTeamA"
        :team-b="chromeTeamB"
        :feed="chromeFeed"
        :pbp="chromePbp"
        :analysis="roundAnalysis"
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
        :stage="stageActive"
        :overlay="overlayMode"
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
        :on-view="(v) => (viewMode = v)"
        :levels="chromeLevels"
        :level="stageLevel"
        :on-level="pickLevel"
        :levels-side="levelsSideBySide"
        :on-levels-side="(v) => (levelsSideBySide = v)"
        :on-pbp-util="toggleUtilSel"
        :on-clear-sel="() => (selectedGi = [])"
        :overlay-rounds="overlayRoundsArr"
        :overlay-window="overlayWindowSec"
        :on-overlay-window="(n) => (overlayWindowSec = n)"
        :overlay-team="overlayTeam"
        :on-overlay-team="(t) => (overlayTeam = t)"
        :team1-name="scoreboard.leftName"
        :team2-name="scoreboard.rightName"
        :show-avatars="showAvatars"
        :trace-on="pathingMode !== 'off'"
        :show-deaths="showDeaths"
        :on-toggle-overlay="() => (overlayMode = !overlayMode)"
        :on-toggle-overlay-round="toggleOverlayRound"
        :on-toggle-avatars="() => (showAvatars = !showAvatars)"
        :on-toggle-trace="togglePathing"
        :on-toggle-deaths="() => (showDeaths = !showDeaths)"
        :show-callouts="showCallouts"
        :has-callouts="hasCallouts"
        :on-toggle-callouts="() => (showCallouts = !showCallouts)"
        :vision-on="showVision"
        :on-toggle-vision="() => (showVision = !showVision)"
        :vision-side="stageFrame.visionSide ?? 'both'"
        :vision-side-pinned="!!visionSidePin"
        :on-vision-side="pickVisionSide"
        :broadcast="broadcastState"
        :broadcast-shot="broadcastCaption"
        :slowmo="broadcastSlowmo"
        :on-broadcast="toggleBroadcast"
        :on-slowmo="() => (broadcastSlowmo = !broadcastSlowmo)"
        :broadcast-replay="!!replayOffer && broadcastLive"
        :on-broadcast-replay="playReplay"
        :broadcast-next="broadcastNext"
        :condensed="broadcastCondensed"
        :on-condensed="() => (broadcastCondensed = !broadcastCondensed)"
        :clip-marks="replayShare.chromeMarks"
      >
        <template v-if="!embedded" #share>
          <ReplayShareMenu :share="replayShare" />
        </template>
      </ReplayChrome>

      <!-- Rotate gate: the stage is unusable at phone-portrait widths, so we
           ask the user to turn the device sideways instead of cramming the
           floating scoreboard + transport into a narrow column. -->
      <Transition name="mapfade">
        <div
          v-if="needsRotate"
          class="absolute inset-0 z-[40] flex flex-col items-center justify-center gap-4 bg-[hsl(var(--background)/0.92)] px-8 text-center backdrop-blur-sm"
        >
          <div class="relative">
            <Smartphone
              class="h-12 w-12 text-[hsl(var(--tac-amber))] [animation:replay-rotate-hint_2.4s_ease-in-out_infinite]"
            />
            <RotateCcw
              class="absolute -right-3 -top-3 h-5 w-5 text-muted-foreground"
            />
          </div>
          <p
            class="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-foreground"
          >
            {{ $t("match.replay.rotate_title") }}
          </p>
          <p class="max-w-[28ch] text-xs text-muted-foreground">
            {{ $t("match.replay.rotate_description") }}
          </p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* Rotate gate: fade + a subtle "grow in" scale. */
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
/* Rotate-gate phone: a gentle tip toward landscape. */
@keyframes replay-rotate-hint {
  0%,
  60%,
  100% {
    transform: rotate(0deg);
  }
  30% {
    transform: rotate(-90deg);
  }
}
</style>
