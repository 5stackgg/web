<script lang="ts" setup>
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
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
} from "lucide-vue-next";
import { Kbd } from "~/components/ui/kbd";

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
  player?: { name?: string | null; avatar_url?: string | null } | null;
};

type Grenade = {
  round: number;
  tick: number;
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

type TimerPhase = "freeze" | "live" | "bomb" | "ended";
type TimerState = {
  phase: TimerPhase;
  secondsRemaining: number;
};

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
  shots?: Shot[];
  damages?: Damage[];
  demoPlayers?: DemoPlayer[];
  demoKills?: DemoKill[];
  demoBombs?: DemoBomb[];
  demoRoundTicks?: RoundTick[];
  tickRate?: number;
  mapName?: string | null;
}>();

// CS2 defaults: 20s freezetime warmup (we anchor to the engine's
// reported freeze_end_tick), 1:55 (115s) round time, 0:40 (40s) bomb
// timer after plant.
const ROUND_TIME_SEC = 115;
const BOMB_TIMER_SEC = 40;

const calibrations = ref<Record<string, RadarMeta> | null>(null);
const radarFailed = ref(false);

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
  (props.mapName || "").trim().toLowerCase(),
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

const damagesByRoundPlayer = computed(() => {
  // Keyed by victim steam_id so we can show "took damage recently" rings.
  const out = new Map<number, Map<string, Damage[]>>();
  for (const d of props.damages ?? []) {
    if (!out.has(d.round)) out.set(d.round, new Map());
    const m = out.get(d.round)!;
    const sid = String(d.attacked_steam_id);
    if (!m.has(sid)) m.set(sid, []);
    m.get(sid)!.push(d);
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
const nextTickValue = computed(
  () => ticks.value[Math.min(tickIndex.value + 1, ticks.value.length - 1)] ?? 0,
);

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
    hurting: boolean;
    blinded: number;
    // null when the loaded demo predates the health column — skip
    // rendering the bar entirely rather than showing a fake full bar.
    health: number | null;
  }> = [];
  const t0 = currentTick.value;
  const t1 = nextTickValue.value;
  const span = Math.max(1, t1 - t0);
  const f = fractional.value;
  const shotsMap = shotsByRoundPlayer.value.get(activeRound.value ?? -1);
  const dmgMap = damagesByRoundPlayer.value.get(activeRound.value ?? -1);
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

    const recentShots = shotsMap?.get(sid) ?? [];
    let firing = false;
    for (const s of recentShots) {
      if (s.tick > t0) break;
      if (t0 - s.tick <= RECENT_TICKS) {
        firing = true;
        break;
      }
    }
    const recentDmg = dmgMap?.get(sid) ?? [];
    const hurting = cur.alive && recentDmg.length > 0;

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

    result.push({
      steamId: sid,
      team: cur.attacker_team,
      alive: cur.alive,
      x,
      y,
      z: cur.z + (next.z - cur.z) * k,
      yaw,
      firing,
      hurting,
      blinded,
      health,
    });
  }
  return result;
});

// Render order: the focused player (if any) is moved to the end of
// the list so SVG paints them last → they sit on top of any kites
// they're overlapping. Without this, a focused dot can disappear
// underneath a friendly stacked at the same position.
const playersForRender = computed(() => {
  const focused = focusedPlayerId.value;
  if (!focused) return interpolatedPlayers.value;
  const rest: typeof interpolatedPlayers.value = [];
  let focusedEntry: (typeof interpolatedPlayers.value)[number] | null = null;
  for (const p of interpolatedPlayers.value) {
    if (p.steamId === focused) focusedEntry = p;
    else rest.push(p);
  }
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

// Match by type + round + tick proximity only. Source 2 demos drop
// thrower_steam_id on the detonate event for some grenade types
// (mollies always; sometimes flash), but the throw event reliably
// has it — strict steam_id matching threw most pairs out.
function nearestThrow(g: Grenade): Grenade | null {
  const throws = props.grenades?.filter(
    (t) =>
      t.phase === "thrown" &&
      t.round === g.round &&
      t.type === g.type &&
      t.tick <= g.tick,
  );
  if (!throws || throws.length === 0) return null;
  // Closest preceding throw.
  return throws.reduce((a, b) => (a.tick > b.tick ? a : b));
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
// Smoke clouds last ~18s, mollies ~7s, HE/Flash are instants.
const GRENADE_LIFETIME_TICKS: Record<Grenade["type"], number> = {
  Smoke: 18 * 64,
  Molotov: 7 * 64,
  HE: 1 * 64,
  Flash: 1 * 64,
  Decoy: 15 * 64,
};

type ResolvedGrenade = Grenade & {
  rx: number;
  ry: number;
  rz: number;
};

const detonationsByTick = computed<ResolvedGrenade[]>(() => {
  const t = currentTick.value;
  if (!t) return [];
  const out: ResolvedGrenade[] = [];
  for (const g of roundGrenades.value) {
    if (g.phase !== "detonated") continue;
    if (g.tick > t) continue;
    const lifetime = GRENADE_LIFETIME_TICKS[g.type] ?? 64;
    if (t - g.tick > lifetime) continue;
    const resolved = resolveGrenadePosition(g);
    if (!resolved) continue;
    const r: ResolvedGrenade = {
      ...g,
      rx: resolved.x,
      ry: resolved.y,
      rz: resolved.z,
    };
    if (!isProjectedInside({ x: r.rx, y: r.ry, z: r.rz })) continue;
    out.push(r);
  }
  return out;
});

// Sub-sample-smoothed tick. tickIndex steps once every SAMPLE_SEC (0.25s)
// so a tick-only animation feels like 4fps. Blending with `fractional`
// (the rAF-driven [0,1) progress toward the next sample) gives a real-
// numbered tick that updates at display rate.
const smoothCurrentTick = computed(() => {
  const t0 = currentTick.value;
  const t1 = nextTickValue.value;
  return t0 + (t1 - t0) * fractional.value;
});

// In-flight grenades: between throw tick and detonation tick we
// interpolate position linearly from throw origin → detonation landing.
// Linear is fine on a top-down 2D radar — the real vertical arc is
// invisible. We also expose the predicted landing so the renderer can
// draw a faint trajectory hint that looks like a "look-ahead" cue.
type InFlightGrenade = {
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
const inFlightGrenades = computed<InFlightGrenade[]>(() => {
  const t = smoothCurrentTick.value;
  if (!t) return [];
  const throws = roundGrenades.value.filter((g) => g.phase === "thrown");
  const detonations = roundGrenades.value.filter(
    (g) => g.phase === "detonated",
  );
  const out: InFlightGrenade[] = [];
  for (const thr of throws) {
    if (thr.tick > t) continue;
    // Loose match: same type/round, detonation tick after throw. Strict
    // steam_id match drops too many pairs since Source 2 nulls thrower
    // on some detonate events.
    const det = detonations.find(
      (d) => d.type === thr.type && d.round === thr.round && d.tick >= thr.tick,
    );
    if (!det) continue;
    if (det.tick <= t) continue; // already detonated → handled by detonationsByTick
    const landing = resolveGrenadePosition(det);
    if (!landing) continue;
    const span = Math.max(1, det.tick - thr.tick);
    const progress = Math.min(1, Math.max(0, (t - thr.tick) / span));
    const x = thr.x + (landing.x - thr.x) * progress;
    const y = thr.y + (landing.y - thr.y) * progress;
    const z = thr.z + (landing.z - thr.z) * progress;
    if (!isProjectedInside({ x, y, z })) continue;
    out.push({
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
    });
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

let rafHandle: number | null = null;
let lastFrameTs = 0;

function frame(now: number) {
  if (!playing.value) return;
  const dt = lastFrameTs ? (now - lastFrameTs) / 1000 : 0;
  lastFrameTs = now;
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

// Scrubbing: click anywhere on the bar to jump, drag to scrub. We use
// pointer events so it works for mouse, pen, and touch identically.
function seekByPointer(e: PointerEvent, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
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
  pause();
  const idx = rounds.value.indexOf(activeRound.value ?? rounds.value[0]);
  const next = Math.max(0, Math.min(rounds.value.length - 1, idx + delta));
  activeRound.value = rounds.value[next] ?? null;
}
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
  if (
    t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable)
  ) {
    return;
  }
  switch (e.key) {
    case " ":
    case "k":
    case "K":
      // Without this, pressing Space re-triggers whichever control
      // button still has focus (Play/Pause/etc.) — the browser
      // activates focused buttons on Space/Enter regardless of our
      // preventDefault. Blurring the active element drops that focus
      // ring AND stops the duplicate click on keyup.
      e.preventDefault();
      if (
        document.activeElement &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body
      ) {
        document.activeElement.blur();
      }
      toggle();
      return;
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
const showAvatars = ref(false);
if (typeof window !== "undefined") {
  try {
    showAvatars.value =
      localStorage.getItem(REPLAY_MARKER_PREF_KEY) === "avatar";
  } catch {
    /* localStorage unavailable; default to number */
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

const layoutRootEl = ref<HTMLElement | null>(null);
// playbarRowEl is referenced from the in-radar overlay; kept here so
// ResizeObserver triggers when the overlay's wrap state changes.
const playbarRowEl = ref<HTMLElement | null>(null);
const radarMaxPx = ref(560);
const LINEUP_COL_WITH_GAP = 244; // 232 min-width + 12 gap

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
  // Controls live inside the radar so there's no external bottom
  // strip, but we still subtract:
  //   - a small SAFETY so the radar isn't flush with the viewport edge
  //   - whatever fixed bottom chrome the app/devtools have docked
  //     (admin bars, floating stream PiP, etc.)
  const SAFETY = 16;
  const bottomChrome = detectBottomChromeHeight();
  const availableH = window.innerHeight - rootRect.top - SAFETY - bottomChrome;
  const availableW = rootRect.width;
  const lineupVisible = availableW >= 600;
  const reserved = lineupVisible ? LINEUP_COL_WITH_GAP : 0;
  // No upper cap on radarMaxPx — the SVG uses a 1024×1024 viewBox and
  // `preserveAspectRatio="xMidYMid meet"`, so it scales cleanly to
  // whatever size we give the container. Capping at CANVAS used to
  // strand wasted space in the popout window. Floor at 280 so the
  // radar stays usable on tight mobile viewports.
  const maxSide = Math.max(280, Math.min(availableH, availableW - reserved));
  radarMaxPx.value = Math.floor(maxSide);
}

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
      const id = String(m.steam_id);
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
      const id = String(m.steam_id);
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
    leftName: l1?.name ?? "Team 1",
    rightName: l2?.name ?? "Team 2",
    leftScore,
    rightScore,
  };
});

// steam_id → live { health, alive } for the lineup panel so we can
// render HP bars next to each name (Boltobserv/HLTV-overlay style).
const liveStateBySteam = computed(() => {
  const m = new Map<string, { health: number | null; alive: boolean }>();
  for (const p of interpolatedPlayers.value) {
    m.set(p.steamId, { health: p.health, alive: p.alive });
  }
  return m;
});

// Map a demo weapon name (e.g. "AK-47", "Desert Eagle", "Glock-18") to
// the equipment SVG filename. demoinfocs strings don't line up cleanly
// with the icon set — explicit aliases cover the common mismatches,
// and the fallback strips non-alphanumerics and lowercases.
const WEAPON_ICON_ALIASES: Record<string, string> = {
  // pistols
  "desert eagle": "deagle",
  "glock-18": "glock",
  "usp-s": "usp_silencer",
  p2000: "p2000",
  "dual berettas": "elite",
  "five-seven": "fiveseven",
  "cz75-auto": "cz75a",
  "tec-9": "tec9",
  "r8 revolver": "revolver",
  // rifles
  m4a4: "m4a1",
  "m4a1-s": "m4a1_silencer",
  "galil ar": "galilar",
  "sg 553": "sg556",
  "ssg 08": "ssg08",
  "scar-20": "scar20",
  // smgs
  "pp-bizon": "bizon",
  "mac-10": "mac10",
  "mp5-sd": "mp5sd",
  "ump-45": "ump45",
  // heavy
  "sawed-off": "sawedoff",
  "mag-7": "mag7",
  // grenades
  "he grenade": "hegrenade",
  "smoke grenade": "smokegrenade",
  "incendiary grenade": "incgrenade",
  molotov: "molotov",
  // other
  "zeus x27": "taser",
  bomb: "c4",
  world: "",
};
function weaponIconPath(w: string | undefined | null): string {
  if (!w) return "";
  const lower = w.toLowerCase().trim();
  if (lower.includes("knife") || lower === "bayonet") {
    return "/img/equipment/knife.svg";
  }
  const aliased = WEAPON_ICON_ALIASES[lower];
  if (aliased === "") return "";
  if (aliased) return `/img/equipment/${aliased}.svg`;
  const slug = lower.replace(/[^a-z0-9]/g, "");
  if (!slug) return "";
  return `/img/equipment/${slug}.svg`;
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
    demoRoundTicks: props.demoRoundTicks,
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
</script>

<template>
  <div class="flex flex-col gap-3">
    <div ref="layoutRootEl" class="flex gap-3 justify-center">
      <!-- Radar canvas. Width and height are pinned to a JS-measured
           value (`radarMaxPx`) computed from actual layout — viewport
           height minus the wrapper's top offset minus app chrome — so
           it grows to fill any pane without ever overflowing. No
           native `resize` handle; sizing is fully driven by JS so the
           browser's corner-drag affordance would only ever look out
           of place against the chrome. -->
      <div
        class="relative bg-[hsl(var(--card)/0.5)] border border-border overflow-hidden shrink-0"
        :style="{
          width: radarMaxPx + 'px',
          height: radarMaxPx + 'px',
        }"
      >
        <img
          v-if="radarSrc"
          :src="radarSrc"
          class="absolute inset-0 w-full h-full object-cover opacity-90"
          @error="radarFailed = true"
        />

        <!-- Top-right HUD cluster: marker-style toggle + pop-out. Both
             sized 40×40 to read as broadcast-grade action buttons. -->
        <div class="absolute top-2 right-2 z-20 flex items-center gap-1.5">
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
                  ? "Switch to slot numbers"
                  : "Switch to player avatars"
              }}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center justify-center w-10 h-10 border border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--card)/0.85)] text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] transition-colors backdrop-blur-sm"
                @click="openReplayPopout"
              >
                <ExternalLink class="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent> Pop out into a separate window </TooltipContent>
          </Tooltip>
        </div>

        <!-- HUD: round timer + bomb advisory in the top-left of the radar. -->
        <div
          class="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none z-10"
        >
          <div
            class="px-2.5 py-1 font-mono text-sm font-bold tabular-nums border bg-[hsl(var(--card)/0.85)] backdrop-blur-sm"
            :class="
              timer.phase === 'bomb'
                ? 'border-[hsl(var(--destructive))] text-[hsl(var(--destructive))]'
                : timer.phase === 'freeze'
                  ? 'border-[hsl(var(--muted-foreground)/0.6)] text-muted-foreground'
                  : 'border-[hsl(var(--tac-amber)/0.6)] text-[hsl(var(--tac-amber))]'
            "
          >
            <span
              v-if="timer.phase === 'freeze'"
              class="text-[0.55rem] tracking-[0.25em] uppercase mr-1.5"
            >
              Freeze
            </span>
            <span
              v-else-if="timer.phase === 'bomb'"
              class="text-[0.55rem] tracking-[0.25em] uppercase mr-1.5"
            >
              Bomb
            </span>
            {{ formatMMSS(timer.secondsRemaining) }}
          </div>
          <div
            v-if="timer.phase === 'bomb'"
            class="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.2em] uppercase border border-[hsl(var(--destructive)/0.6)] bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))] backdrop-blur-sm"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Planted {{ bombPlantThisRound?.site ?? "" }}
          </div>
          <div
            v-else-if="
              bombDefuseThisRound && bombDefuseThisRound.tick <= currentTick
            "
            class="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.2em] uppercase border border-[hsl(var(--success)/0.6)] bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] backdrop-blur-sm"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-current" />
            Defused
          </div>
          <div
            v-else-if="
              bombExplodeThisRound && bombExplodeThisRound.tick <= currentTick
            "
            class="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.2em] uppercase border border-[hsl(var(--destructive)/0.8)] bg-[hsl(var(--destructive)/0.25)] text-[hsl(var(--destructive))] backdrop-blur-sm"
          >
            Exploded
          </div>
        </div>

        <svg
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

            <!-- Hit ripple: a red-to-transparent radial used for the
                 hurting indicator. -->
            <radialGradient id="hit-ripple" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(255,40,30,0)" />
              <stop offset="65%" stop-color="rgba(255,50,40,0.55)" />
              <stop offset="100%" stop-color="rgba(220,0,0,0)" />
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

          <!-- Detonated grenades — animated SVG primitives.
               Smoke = pulsing gray disc with team-tinted ring,
               HE    = exploding starburst that flares then fades,
               Molotov = flickering layered flames,
               Flash = bright burst that decays,
               Decoy = dashed ring. -->
          <g v-for="(g, i) of detonationsByTick" :key="'grn-' + i">
            <g
              :transform="`translate(${project({ x: g.rx, y: g.ry, z: g.rz }).x}, ${project({ x: g.rx, y: g.ry, z: g.rz }).y})`"
            >
              <template v-if="g.type === 'Smoke'">
                <!-- Pseudo-volumetric smoke: a turbulence-displaced
                     gradient disc that drifts and breathes. Team-tinted
                     thin ring stays sharp so it remains identifiable.
                     The cloud body uses the `smoke-displace` filter to
                     make the silhouette wavy + organic. -->
                <g filter="url(#smoke-displace)">
                  <!-- Outer soft halo -->
                  <circle fill="url(#smoke-grad)">
                    <animate
                      attributeName="r"
                      values="0;38;34;36;34"
                      keyTimes="0;0.2;0.55;0.85;1"
                      dur="2.6s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.85;0.95;0.8;0.92;0.8"
                      dur="4.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <!-- Inner denser core -->
                  <circle fill="rgba(245, 245, 245, 0.42)">
                    <animate
                      attributeName="r"
                      values="0;22;19;21;19"
                      keyTimes="0;0.25;0.55;0.85;1"
                      dur="2.6s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.35;0.5;0.32;0.48;0.35"
                      dur="3.8s"
                      repeatCount="indefinite"
                    />
                    <!-- Subtle drift so the cloud "breathes" -->
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values="0,0;3,-2;-2,3;1,-1;0,0"
                      dur="6s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <!-- Inner highlight -->
                  <circle r="8" fill="rgba(255, 255, 255, 0.35)">
                    <animate
                      attributeName="opacity"
                      values="0.25;0.5;0.3;0.42;0.25"
                      dur="2.2s"
                      repeatCount="indefinite"
                    />
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values="-4,-3;3,2;-2,4;2,-3;-4,-3"
                      dur="5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
                <!-- Sharp team-tinted ring stays OUTSIDE the displace
                     filter so identification is unambiguous. -->
                <circle
                  fill="none"
                  :stroke="colorFor(g.thrower_team)"
                  stroke-width="1.4"
                  stroke-opacity="0.55"
                >
                  <animate
                    attributeName="r"
                    values="0;33;32;33;32"
                    keyTimes="0;0.2;0.55;0.85;1"
                    dur="2.6s"
                    fill="freeze"
                  />
                </circle>
              </template>

              <template v-else-if="g.type === 'HE'">
                <!-- Triple-stacked shockwave rings, each expanding at
                     its own rate to read as "displaced air" sweeping
                     outward. Layered with a heavy glow filter so the
                     blast feels concussive. -->
                <g filter="url(#he-glow)">
                  <circle
                    fill="none"
                    stroke="hsl(45, 100%, 75%)"
                    stroke-width="2.5"
                  >
                    <animate
                      attributeName="r"
                      from="2"
                      to="44"
                      dur="0.55s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;0.85;0"
                      keyTimes="0;0.4;1"
                      dur="0.55s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="stroke-width"
                      from="3.5"
                      to="0.5"
                      dur="0.55s"
                      fill="freeze"
                    />
                  </circle>
                  <circle
                    fill="none"
                    stroke="hsl(28, 100%, 65%)"
                    stroke-width="2"
                  >
                    <animate
                      attributeName="r"
                      from="0"
                      to="34"
                      dur="0.7s"
                      begin="0.08s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.85"
                      to="0"
                      dur="0.7s"
                      begin="0.08s"
                      fill="freeze"
                    />
                  </circle>
                  <circle
                    fill="none"
                    stroke="hsl(0, 80%, 55%)"
                    stroke-width="1.5"
                  >
                    <animate
                      attributeName="r"
                      from="0"
                      to="24"
                      dur="0.85s"
                      begin="0.18s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.7"
                      to="0"
                      dur="0.85s"
                      begin="0.18s"
                      fill="freeze"
                    />
                  </circle>
                </g>
                <!-- Bright core flash + sharp starburst body -->
                <polygon
                  points="0,-20 4,-5 20,-4 7,3 13,18 0,8 -13,18 -7,3 -20,-4 -4,-5"
                  fill="hsl(40, 100%, 60%)"
                  stroke="hsl(55, 100%, 85%)"
                  stroke-width="1.2"
                >
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    values="0.2;1.5;1.1;0.95"
                    keyTimes="0;0.3;0.6;1"
                    dur="0.6s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;1;0.7;0"
                    keyTimes="0;0.35;0.7;1"
                    dur="1.1s"
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
                      to="26"
                      dur="0.45s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;0.6;0"
                      keyTimes="0;0.5;1"
                      dur="0.5s"
                      fill="freeze"
                    />
                  </line>
                </g>
                <!-- Hot core that pulses then dies. -->
                <circle fill="hsl(55, 100%, 92%)">
                  <animate
                    attributeName="r"
                    values="8;4;0"
                    keyTimes="0;0.5;1"
                    dur="0.9s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0.6;0"
                    keyTimes="0;0.5;1"
                    dur="0.9s"
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
                <!-- Main fire body with displacement -->
                <g filter="url(#fire-displace)">
                  <circle r="22" fill="url(#fire-core)">
                    <animate
                      attributeName="r"
                      values="4;24;22;24;22"
                      keyTimes="0;0.2;0.55;0.85;1"
                      dur="1s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.85;1;0.85;0.95;0.85"
                      dur="0.7s"
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
                    from="2"
                    to="44"
                    dur="0.35s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0.8;0"
                    keyTimes="0;0.35;1"
                    dur="0.65s"
                    fill="freeze"
                  />
                </circle>
                <!-- Sharp ring chasing the shockwave -->
                <circle
                  fill="none"
                  stroke="rgba(220, 240, 255, 0.95)"
                  stroke-width="1.5"
                >
                  <animate
                    attributeName="r"
                    from="0"
                    to="30"
                    dur="0.4s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    from="1"
                    to="0"
                    dur="0.5s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="stroke-width"
                    from="2.5"
                    to="0.3"
                    dur="0.5s"
                    fill="freeze"
                  />
                </circle>
                <!-- Sharp star core -->
                <polygon
                  points="0,-18 4,-4 18,0 4,4 0,18 -4,4 -18,0 -4,-4"
                  fill="rgba(245, 250, 255, 0.98)"
                >
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    values="0.1;1.4;1.05;0.9"
                    keyTimes="0;0.3;0.55;1"
                    dur="0.55s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0.7;0"
                    keyTimes="0;0.45;1"
                    dur="1s"
                    fill="freeze"
                  />
                </polygon>
                <!-- Cyan-tinted secondary star at 22.5° for sharpness. -->
                <polygon
                  points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3"
                  fill="rgba(180, 220, 255, 0.85)"
                  transform="rotate(22.5)"
                >
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    values="0.1;1.2;0.7"
                    keyTimes="0;0.4;1"
                    dur="0.6s"
                    additive="sum"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.85;0.5;0"
                    keyTimes="0;0.4;1"
                    dur="0.9s"
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
            </g>
          </g>

          <!-- In-flight grenades: small projectile dot moving along the
               throw → landing path, with a faint dashed line ahead of
               it showing where it's about to land (the "look-ahead"
               trajectory cue). -->
          <g v-for="(g, i) of inFlightGrenades" :key="'thr-' + i">
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
            <!-- Projectile itself: small filled dot with team ring -->
            <g
              :transform="`translate(${project({ x: g.x, y: g.y, z: g.z }).x}, ${project({ x: g.x, y: g.y, z: g.z }).y})`"
            >
              <circle r="5" :fill="colorFor(g.thrower_team)" opacity="0.85" />
              <circle r="2.2" fill="white" opacity="0.95" />
            </g>
          </g>

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

          <!-- Death markers persist at the victim's location at the
               kill tick — looked up from the position sample closest
               to the demo kill's tick. -->
          <g v-for="(k, i) of roundKillsWithLocation" :key="'k-' + i">
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

          <!-- Boltobserv-style "kite" dots: rounded body with one sharp
               point at NE, rotated so the point aims at the player's
               view direction. Built-in states: dead (X cross), hurting
               (red back), firing (white corner burst), flashed-ready
               for the future. -->
          <g v-for="p of playersForRender" :key="p.steamId">
            <g :transform="`translate(${project(p).x}, ${project(p).y})`">
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
                <!-- Wounded indicator: a soft red ring around the
                     player rendered OUTSIDE the rotated kite so it
                     stays concentric. The `damages` data we have is
                     keyed by timestamp not tick, so we can't strobe on
                     individual hits — this is a slow ambient pulse
                     that just signals "took damage this round". -->
                <g v-if="p.hurting" style="pointer-events: none">
                  <circle
                    fill="none"
                    stroke="hsl(0, 90%, 55%)"
                    stroke-width="1.2"
                  >
                    <animate
                      attributeName="r"
                      values="14;19;14"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.55;0.15;0.55"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
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
                  <circle
                    r="12"
                    fill="none"
                    :stroke="colorFor(p.team)"
                    stroke-width="0.6"
                    stroke-opacity="0.95"
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
              </template>
            </g>
          </g>
        </svg>

        <!-- Overlay dock: playback controls + scrub bar sit inside the
             radar at the bottom so they're width-bound to the canvas
             and resize in lockstep with it. Backdrop-blur keeps the
             radar visible underneath. -->
        <div
          class="absolute inset-x-0 bottom-0 z-20 flex flex-col bg-[hsl(var(--background)/0.75)] backdrop-blur-md border-t border-border/70"
        >
          <!-- Scrub bar across the very top of the dock so it reads as
               the natural playhead for the radar above. -->
          <div
            ref="playbarRowEl"
            class="flex items-center gap-2 px-3 pt-2 pb-1"
          >
            <div
              class="relative flex-1 min-w-[6rem] h-3 group cursor-pointer select-none"
              @pointerdown="onScrubStart"
            >
              <div
                class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-[hsl(var(--border))] rounded-sm overflow-hidden"
              >
                <div
                  class="absolute inset-y-0 left-0 bg-[hsl(var(--tac-amber))] transition-[width] duration-100 ease-linear"
                  :style="{ width: progressPct + '%' }"
                />
              </div>
              <div
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_0_2px_hsl(var(--background)),0_0_10px_hsl(var(--tac-amber)/0.6)] transition-[left] duration-100 ease-linear pointer-events-none"
                :style="{ left: progressPct + '%' }"
              />
            </div>
            <span
              class="font-mono text-[0.6rem] tabular-nums text-muted-foreground min-w-[7ch] text-right"
            >
              {{ tickIndex + 1 }} / {{ ticks.length }}
            </span>
          </div>

          <!-- Controls row below the scrubber. Compact + wraps if the
               radar is narrow; ml-auto pushes the popout to the edge. -->
          <div
            class="flex items-center gap-1.5 px-3 pb-2 pt-1 flex-wrap text-[0.65rem]"
          >
            <button
              type="button"
              class="px-1.5 py-1 border border-border/60 hover:border-[hsl(var(--tac-amber)/0.7)] hover:text-[hsl(var(--tac-amber))] transition-colors"
              title="Previous round"
              @click="jumpToRound(-1)"
            >
              <SkipBack class="w-3 h-3" />
            </button>
            <select
              v-model.number="activeRound"
              class="bg-[hsl(var(--card)/0.9)] border border-border/60 px-1.5 py-0.5 text-[0.65rem] font-mono tabular-nums min-w-[4.5rem]"
            >
              <option v-for="r of rounds" :key="r" :value="r">
                Round {{ r }}
              </option>
            </select>
            <button
              type="button"
              class="px-1.5 py-1 border border-border/60 hover:border-[hsl(var(--tac-amber)/0.7)] hover:text-[hsl(var(--tac-amber))] transition-colors"
              title="Next round"
              @click="jumpToRound(1)"
            >
              <SkipForward class="w-3 h-3" />
            </button>

            <div class="w-px h-5 bg-border mx-1" />

            <button
              type="button"
              class="px-1.5 py-1 border border-border/60 hover:border-[hsl(var(--tac-amber)/0.7)] hover:text-[hsl(var(--tac-amber))] transition-colors"
              title="Step back"
              @click="step(-1)"
            >
              <SkipBack class="w-3 h-3" />
            </button>
            <button
              type="button"
              class="px-2.5 py-1 border border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.25)] transition-colors font-mono text-[0.6rem] font-bold tracking-[0.2em] uppercase inline-flex items-center gap-1"
              @click="toggle()"
            >
              <Play v-if="!playing" class="w-3 h-3" />
              <Pause v-else class="w-3 h-3" />
              {{ playing ? "Pause" : "Play" }}
            </button>
            <button
              type="button"
              class="px-1.5 py-1 border border-border/60 hover:border-[hsl(var(--tac-amber)/0.7)] hover:text-[hsl(var(--tac-amber))] transition-colors"
              title="Step forward"
              @click="step(1)"
            >
              <SkipForward class="w-3 h-3" />
            </button>

            <div class="w-px h-5 bg-border mx-1" />

            <div class="inline-flex items-center gap-0.5">
              <Gauge class="w-3 h-3 text-muted-foreground mr-1" />
              <button
                v-for="s of SPEEDS"
                :key="s"
                type="button"
                class="px-1.5 py-0.5 font-mono text-[0.6rem] font-bold tabular-nums transition-colors border"
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
          </div>
        </div>
      </div>

      <!-- Roster panel: generic CT/T labels keyed off each player's
           starting side from positions data — avoids guessing which
           lineup is on which side, which goes wrong on imported demos
           and after half-time swaps. Each row shows a live HP bar
           sourced from the per-tick interpolated player state.
           Bounded by the radar's height so a long kill feed scrolls
           inside the column rather than pushing the page below the
           fold. `mt-auto` on the shortcuts block pins them to the
           bottom when there's spare vertical space. -->
      <div
        class="hidden md:flex flex-col gap-2 min-w-[220px] overflow-y-auto"
        :style="{ maxHeight: radarMaxPx + 'px' }"
      >
        <!-- Discoverability hint for the focus-to-follow interaction. -->
        <p class="text-[0.6rem] text-muted-foreground/80 leading-tight px-0.5">
          Click a player below to follow them on the map.
        </p>

        <!-- Map scoreboard. Pulls lineup_1_score / lineup_2_score off
             the active match_map. Lineup names come from the match
             prop; falls back to generic team-side labels otherwise. -->
        <div
          v-if="scoreboard"
          class="flex items-center gap-2 px-2 py-1.5 border border-border bg-[hsl(var(--card)/0.6)] font-mono"
        >
          <span
            class="text-[0.6rem] tracking-[0.18em] uppercase truncate flex-1 min-w-0 text-right"
          >
            {{ scoreboard.leftName }}
          </span>
          <span
            class="text-base font-bold tabular-nums px-1 text-[hsl(210,80%,60%)]"
          >
            {{ scoreboard.leftScore }}
          </span>
          <span class="text-muted-foreground text-xs">·</span>
          <span
            class="text-base font-bold tabular-nums px-1 text-[hsl(33,94%,58%)]"
          >
            {{ scoreboard.rightScore }}
          </span>
          <span
            class="text-[0.6rem] tracking-[0.18em] uppercase truncate flex-1 min-w-0"
          >
            {{ scoreboard.rightName }}
          </span>
        </div>
        <div>
          <div
            class="font-mono text-[0.55rem] tracking-[0.22em] uppercase text-[hsl(210,80%,60%)] mb-1"
          >
            Counter-Terrorists
          </div>
          <Tooltip v-for="m of lineupRows.ct" :key="m.steamId">
            <TooltipTrigger as-child>
              <div
                class="flex items-center gap-2 py-0.5 text-xs cursor-pointer transition-colors rounded-sm pl-1 -ml-1 border-l-2"
                :class="[
                  liveStateBySteam.get(m.steamId)?.alive === false
                    ? 'opacity-40'
                    : '',
                  focusedPlayerId === m.steamId
                    ? 'bg-[hsl(var(--tac-amber)/0.12)] border-[hsl(var(--tac-amber))]'
                    : 'border-transparent hover:bg-muted/30',
                ]"
                @click="toggleFocus(m.steamId)"
              >
                <!-- Exclusive avatar OR slot indicator — mirrors the map
                 marker so the roster and the radar always match. -->
                <img
                  v-if="showAvatars && m.avatarUrl"
                  :src="m.avatarUrl"
                  :alt="m.name"
                  class="w-5 h-5 rounded-full object-cover shrink-0 border border-[hsl(210,80%,60%/0.6)]"
                  @error="
                    ($event.target as HTMLImageElement).style.display = 'none'
                  "
                />
                <span
                  v-else
                  class="w-5 h-5 rounded-full inline-flex items-center justify-center font-mono font-bold text-[10px] shrink-0"
                  :style="{
                    background: 'hsl(210,80%,60%)',
                    color: 'hsl(0 0% 98%)',
                  }"
                >
                  {{ m.slot }}
                </span>
                <span class="truncate flex-1 min-w-0">{{ m.name }}</span>
                <template
                  v-if="
                    liveStateBySteam.get(m.steamId)?.alive !== false &&
                    liveStateBySteam.get(m.steamId)?.health != null
                  "
                >
                  <span
                    class="font-mono text-[0.65rem] tabular-nums w-7 text-right text-muted-foreground"
                  >
                    {{ liveStateBySteam.get(m.steamId)!.health }}
                  </span>
                  <span
                    class="relative inline-block w-12 h-1.5 rounded-sm overflow-hidden bg-[hsl(0_0%_100%/0.12)] shrink-0"
                  >
                    <span
                      class="absolute inset-y-0 left-0 transition-all duration-150"
                      :style="{
                        width: liveStateBySteam.get(m.steamId)!.health + '%',
                        background: `hsl(${
                          (liveStateBySteam.get(m.steamId)!.health! / 100) * 130
                        }, 85%, 50%)`,
                      }"
                    />
                  </span>
                </template>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {{
                focusedPlayerId === m.steamId
                  ? "Click to stop following"
                  : `Click to follow ${m.name} on the map`
              }}
            </TooltipContent>
          </Tooltip>
        </div>
        <div>
          <div
            class="font-mono text-[0.55rem] tracking-[0.22em] uppercase text-[hsl(33,94%,58%)] mb-1 mt-2"
          >
            Terrorists
          </div>
          <Tooltip v-for="m of lineupRows.t" :key="m.steamId">
            <TooltipTrigger as-child>
              <div
                class="flex items-center gap-2 py-0.5 text-xs cursor-pointer transition-colors rounded-sm pl-1 -ml-1 border-l-2"
                :class="[
                  liveStateBySteam.get(m.steamId)?.alive === false
                    ? 'opacity-40'
                    : '',
                  focusedPlayerId === m.steamId
                    ? 'bg-[hsl(var(--tac-amber)/0.12)] border-[hsl(var(--tac-amber))]'
                    : 'border-transparent hover:bg-muted/30',
                ]"
                @click="toggleFocus(m.steamId)"
              >
                <!-- Exclusive avatar OR slot indicator — mirrors the map
                 marker so the roster and the radar always match. -->
                <img
                  v-if="showAvatars && m.avatarUrl"
                  :src="m.avatarUrl"
                  :alt="m.name"
                  class="w-5 h-5 rounded-full object-cover shrink-0 border border-[hsl(33,94%,58%/0.6)]"
                  @error="
                    ($event.target as HTMLImageElement).style.display = 'none'
                  "
                />
                <span
                  v-else
                  class="w-5 h-5 rounded-full inline-flex items-center justify-center font-mono font-bold text-[10px] shrink-0"
                  :style="{
                    background: 'hsl(33,94%,58%)',
                    color: 'hsl(0 0% 10%)',
                  }"
                >
                  {{ m.slot }}
                </span>
                <span class="truncate flex-1 min-w-0">{{ m.name }}</span>
                <template
                  v-if="
                    liveStateBySteam.get(m.steamId)?.alive !== false &&
                    liveStateBySteam.get(m.steamId)?.health != null
                  "
                >
                  <span
                    class="font-mono text-[0.65rem] tabular-nums w-7 text-right text-muted-foreground"
                  >
                    {{ liveStateBySteam.get(m.steamId)!.health }}
                  </span>
                  <span
                    class="relative inline-block w-12 h-1.5 rounded-sm overflow-hidden bg-[hsl(0_0%_100%/0.12)] shrink-0"
                  >
                    <span
                      class="absolute inset-y-0 left-0 transition-all duration-150"
                      :style="{
                        width: liveStateBySteam.get(m.steamId)!.health + '%',
                        background: `hsl(${
                          (liveStateBySteam.get(m.steamId)!.health! / 100) * 130
                        }, 85%, 50%)`,
                      }"
                    />
                  </span>
                </template>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {{
                focusedPlayerId === m.steamId
                  ? "Click to stop following"
                  : `Click to follow ${m.name} on the map`
              }}
            </TooltipContent>
          </Tooltip>
        </div>

        <!-- Kill feed sits under the roster on the right column,
             building progressively as the cursor passes each kill tick.
             Each row shows: killer → weapon icon → "HS" badge if
             headshot → victim. -->
        <div
          v-if="killsBeforeCursor.length > 0"
          class="mt-3 pt-3 border-t border-border/40 flex flex-col gap-1"
        >
          <div
            class="font-mono text-[0.55rem] tracking-[0.22em] uppercase text-muted-foreground"
          >
            Round Kills
          </div>
          <div
            v-for="(k, i) of killsBeforeCursor"
            :key="'kf-' + i"
            class="font-mono text-[0.7rem] tabular-nums flex items-center gap-1.5 py-0.5"
          >
            <span :style="{ color: colorFor(k.killer_team ?? null) }">
              {{ playerName(k.killer ?? "") }}
            </span>
            <img
              v-if="k.weapon && weaponIconPath(k.weapon)"
              :src="weaponIconPath(k.weapon)"
              :alt="k.weapon"
              :title="k.weapon"
              class="h-4 w-auto opacity-90"
              @error="
                ($event.target as HTMLImageElement).style.display = 'none'
              "
            />
            <Crosshair
              v-if="k.headshot"
              class="w-3.5 h-3.5 text-[hsl(var(--tac-amber))] drop-shadow-[0_0_4px_hsl(var(--tac-amber)/0.6)]"
              :stroke-width="2.5"
              title="Headshot"
            />
            <span :style="{ color: colorFor(k.victim_team ?? null) }">
              {{ playerName(k.victim ?? "") }}
            </span>
          </div>
        </div>

        <!-- Keyboard shortcut legend tucked into the bottom of the
             right column, below the kill feed. Compact, monospace,
             only shows the four shortcuts the user is likely to use. -->
        <div
          class="mt-auto pt-3 border-t border-border/40 flex flex-col gap-1 text-[0.6rem] text-muted-foreground"
        >
          <div
            class="font-mono text-[0.55rem] tracking-[0.22em] uppercase text-muted-foreground"
          >
            Shortcuts
          </div>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="inline-flex items-center gap-1">
              <Kbd>Space</Kbd> play
            </span>
            <span class="inline-flex items-center gap-1">
              <Kbd>←</Kbd><Kbd>→</Kbd> step
            </span>
            <span class="inline-flex items-center gap-1">
              <Kbd>[</Kbd><Kbd>]</Kbd> round
            </span>
            <span class="inline-flex items-center gap-1">
              <Kbd>1</Kbd>–<Kbd>5</Kbd> speed
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
