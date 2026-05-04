<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
  Skull,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  RotateCcw,
  Bone,
  PanelBottom,
  Film,
} from "lucide-vue-next";
import { useAuthStore } from "~/stores/AuthStore";
import CreateClipDialog from "~/components/clips/CreateClipDialog.vue";
import { Button } from "~/components/ui/button";
import { Kbd } from "~/components/ui/kbd";
import { Slider } from "~/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useDemoPlayback } from "~/composables/useDemoPlayback";

// Clip rendering consumes a game-streamer pod, so the api gates this
// at `verified_user` server-side (matches.controller#createClipRender).
// We only check "is logged in" on the client so the button is visible
// to anyone watching a demo — the api returns a clear error if the
// caller isn't allowed, which the dialog surfaces. Hiding the button
// behind a role check on the client meant role mismatches looked like
// the feature didn't exist.
const canCreateClip = computed(() => !!useAuthStore().me?.steam_id);
const showCreateClipDialog = ref(false);

const {
  store,
  togglePause,
  skip,
  seek,
  setSpeed,
  jumpToRound,
  jumpToNextKill,
  jumpToPrevKill,
  jumpToNextRound,
  jumpToPrevRound,
  switchToSlot,
  setKillFilter,
  toggleKillFilterMode,
  reloadDemo,
  toggleXray,
  toggleHud,
  toggleDemoUI,
} = useDemoPlayback();

// Slot identity comes ENTIRELY from cs2 GSI now. Demos can be
// attached to a different match_map than they were originally from
// (operator dragged a wrong .dem file in), and the api's lineup will
// be wrong in that case — but cs2 is always reading the actual demo
// file, so observer_slot + the player's real name + their current
// team are guaranteed correct.
//
// Each slot button fires `spec_player_<slot>` via xdotool — that
// targets cs2's observer_slot directly, so click and label stay in
// lockstep automatically.
type SlotInfo = (typeof store.specSlots)[number];
const ctSlots = computed(() =>
  store.specSlots
    .filter((s) => s.team === "CT")
    .slice()
    .sort((a, b) => a.slot - b.slot),
);
const tSlots = computed(() =>
  store.specSlots
    .filter((s) => s.team === "T")
    .slice()
    .sort((a, b) => a.slot - b.slot),
);
const hasGsi = computed(() => store.specSlots.length > 0);

function slotIsActive(s: SlotInfo): boolean {
  if (!store.spectatedSteamId) return false;
  return s.steam_id === store.spectatedSteamId;
}
function sideClasses(side: "T" | "CT", isActive: boolean, isFlash: boolean) {
  const wantHighlight = isActive || isFlash;
  if (side === "CT") {
    return wantHighlight
      ? "border-blue-400 bg-blue-500/20 text-blue-200"
      : "border-blue-500/40 bg-blue-500/5 text-foreground/80 hover:border-blue-400/70 hover:bg-blue-500/10 hover:text-blue-100 active:scale-95";
  }
  return wantHighlight
    ? "border-amber-400 bg-amber-500/20 text-amber-100"
    : "border-amber-500/40 bg-amber-500/5 text-foreground/80 hover:border-amber-400/70 hover:bg-amber-500/10 hover:text-amber-100 active:scale-95";
}
function sideDotClass(side: "T" | "CT") {
  return side === "CT" ? "bg-blue-400" : "bg-amber-400";
}
// Team name source-of-truth: GSI (the demo file). API lineup name is
// only used as a fallback when GSI hasn't filled team_*_name yet —
// and even then we hedge "(team 1)" / "(team 2)" rather than commit
// to which lineup is on which side, since that's what flips at half.
function ctTeamName(): string {
  return store.gsiTeamCtName || "Counter-Terrorists";
}
function tTeamName(): string {
  return store.gsiTeamTName || "Terrorists";
}

const flashSlot = ref<number | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;
function pressSlot(slot: number) {
  flashSlot.value = slot;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashSlot.value = null;
  }, 220);
  switchToSlot(slot);
}

// Most controls bind to keys in cs2's autoexec — each click fires a
// single xdotool keystroke (no console flash). The seek slider, round
// chips, and event-jump buttons depend on parser metadata; without it
// we render a thinner UI with just play/pause/skip/speed.
const hasMetadata = computed(() => store.totalTicks > 0 && store.tickRate > 0);

const seekModel = ref<number[]>([0]);
const dragging = ref(false);

// rAF-driven smoothing layer for the seek thumb. The store's
// `currentTick` is the source of truth, but raw it advances by ~1
// tick per frame during playback (smooth) and by thousands of ticks
// at once on seek/skip/round-jump (jumpy). We render `visualTick`
// instead — for small diffs (normal playback) it tracks `currentTick`
// 1:1, but when a jump opens a gap larger than the threshold, we
// ease the visual position into the target with exponential
// smoothing so the thumb glides into the new position instead of
// teleporting. Threshold is ~0.75s of ticks so a single dropped
// frame at high host_timescale doesn't trigger a tween.
const visualTick = ref(0);
let rafHandle: number | null = null;

// One-shot pulse ring overlay. Bumped on every seek that originates
// from a user click (slider, skull, round tick, kill nav). The
// `:key` on the ring forces Vue to mount a fresh element each pulse
// so the CSS animation re-runs from frame 0; otherwise consecutive
// clicks at the same spot would just re-target a still-running
// animation and the ring wouldn't appear to retrigger.
const pulseSerial = ref(0);
const pulseTick = ref(0);
function pulseAt(tick: number) {
  pulseTick.value = tick;
  pulseSerial.value++;
}
const pulseLeft = computed(() =>
  store.totalTicks > 0
    ? `${(pulseTick.value / store.totalTicks) * 100}%`
    : "0%",
);
function frame() {
  rafHandle = requestAnimationFrame(frame);
  if (!hasMetadata.value || dragging.value) return;
  const target = store.currentTick;
  const diff = target - visualTick.value;
  const threshold = store.tickRate * 0.75;
  if (Math.abs(diff) > threshold) {
    // Big jump — ease toward the target. 0.18 gives a ~300ms settle
    // at 60fps, which reads as a quick glide instead of a teleport.
    visualTick.value += diff * 0.18;
    // Snap the last few ticks so the slider lands exactly on target
    // (otherwise floating-point drift leaves it perpetually short).
    if (Math.abs(target - visualTick.value) < 2) visualTick.value = target;
  } else {
    visualTick.value = target;
  }
  seekModel.value = [Math.round(visualTick.value)];
}
onMounted(() => {
  visualTick.value = store.currentTick;
  rafHandle = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  if (rafHandle !== null) cancelAnimationFrame(rafHandle);
});

function onSeekStart() {
  dragging.value = true;
}
function onSeekUpdate(v: number[] | undefined) {
  if (!v) return;
  seekModel.value = v;
  // Keep the smoothing layer pinned to the user's drag position so
  // when the drag ends + rAF resumes, visualTick already matches the
  // slider — otherwise the rAF would see a gap and yank the thumb
  // back to the pre-drag position before easing forward.
  if (typeof v[0] === "number") visualTick.value = v[0];
}
async function onSeekCommit(v: number[] | undefined) {
  dragging.value = false;
  if (v && v.length) {
    // Snap visualTick to the committed value before the seek round-
    // trip lands — otherwise the next rAF frame reads currentTick
    // (still the old value for ~1 frame), computes a "jump" back, and
    // animates the thumb backwards before catching forward.
    visualTick.value = v[0];
    pulseAt(v[0]);
    await seek(v[0]);
  }
}
function onSpeedChange(value: unknown) {
  const n = Number(value);
  if (Number.isFinite(n)) void setSpeed(n);
}

// Display the smoothed visual tick so the time label, slider thumb,
// and any future markers all read from the same eased value during a
// jump. Falls back to the truth instantly outside of jumps.
const visualSeconds = computed(() =>
  store.tickRate > 0 ? visualTick.value / store.tickRate : 0,
);
const formattedCurrent = computed(() => formatSeconds(visualSeconds.value));
const formattedTotal = computed(() => formatSeconds(store.totalSeconds));
function formatSeconds(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const total = Math.floor(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// All presets are bound to F-keys in the autoexec so changing speed
// never flashes the dev console.
const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

// Kill filter dropdown derives its players from the parsed demo's
// kill events, NOT from the api lineup. Demos can be loaded against
// a mismatched match_map row, in which case the lineup contains the
// wrong steam_ids and the filter would silently report 0 kills for
// every player. The killer/victim steam_ids in the kills array are
// always the real demo players, so unique-ing those gives us the
// authoritative list. Names + side come from GSI when available,
// with a steam-id-suffix fallback for stragglers (bots, world
// damage attribution, etc).
type KillPlayer = {
  steam_id: string;
  name: string;
  team: "T" | "CT" | null;
};
const demoPlayers = computed<KillPlayer[]>(() => {
  const seen = new Set<string>();
  const players: KillPlayer[] = [];
  const gsiByStId = new Map<string, (typeof store.specSlots)[number]>();
  for (const s of store.specSlots) {
    if (s.steam_id) gsiByStId.set(s.steam_id, s);
  }
  const add = (sid: string | undefined) => {
    if (!sid || seen.has(sid)) return;
    seen.add(sid);
    const gsi = gsiByStId.get(sid);
    players.push({
      steam_id: sid,
      name: gsi?.name ?? store.playerNames[sid] ?? `#${sid.slice(-4)}`,
      team: gsi?.team ?? null,
    });
  };
  for (const k of store.kills) {
    add(k.killer);
    add(k.victim);
  }
  // Names sort within each team for predictable scanning.
  return players.sort((a, b) => a.name.localeCompare(b.name));
});
const ctDemoPlayers = computed(() =>
  demoPlayers.value.filter((p) => p.team === "CT"),
);
const tDemoPlayers = computed(() =>
  demoPlayers.value.filter((p) => p.team === "T"),
);
// Players we couldn't team-assign via GSI (their steam_id only
// shows up in kills metadata, not in current allplayers — common
// for demos where someone left mid-match, or before GSI lands).
const otherDemoPlayers = computed(() =>
  demoPlayers.value.filter((p) => p.team !== "CT" && p.team !== "T"),
);
const hasDemoPlayers = computed(() => demoPlayers.value.length > 0);
function killCountFor(steamId: string) {
  let n = 0;
  for (const k of store.kills) {
    const match =
      store.killFilterMode === "victim"
        ? k.victim === steamId
        : k.killer === steamId;
    if (match) n++;
  }
  return n;
}
const activeFilterLabel = computed(() => {
  const sid = store.killFilterSteamId;
  if (!sid) return "All players";
  // Prefer GSI's name (always matches the demo file) over the api
  // lineup name (which can be wrong for cross-loaded demos).
  const gsi = store.specSlots.find((s) => s.steam_id === sid);
  const name = gsi?.name ?? store.playerNames[sid] ?? `#${sid.slice(-4)}`;
  return `${name} (${killCountFor(sid)})`;
});

// Cumulative round score running L-R across roundTicks. The parser
// records `winner` as "ct" / "t" / "" — we don't know which lineup
// played which side first, so the score is just team1-vs-team2 in
// the order rounds were played. Falls back to no score when the
// parser hasn't filled `winner` yet.
const roundScores = computed(() => {
  const out = new Map<number, { ct: number; t: number }>();
  let ct = 0;
  let t = 0;
  for (const r of store.roundTicks) {
    if (r.winner === "ct") ct++;
    else if (r.winner === "t") t++;
    out.set(r.round, { ct, t });
  }
  return out;
});

// End-of-demo detection. Once visualTick crosses the last round's
// end + a small epsilon, surface a "Reload?" prompt — cs2 has
// dropped back to the menu by then. Auto-dismisses if the operator
// hits R / clicks Reload.
const showReloadPrompt = computed(() => {
  if (!hasMetadata.value || !store.totalTicks) return false;
  return visualTick.value >= store.totalTicks - 32;
});
function onKillFilterChange(value: unknown) {
  const v = typeof value === "string" ? value : null;
  setKillFilter(v && v !== "__all__" ? v : null);
}

// Marker rendering. Round starts are landmarks (amber tick on the
// rail itself), kills get a small skull glyph above the bar, colored
// by the victim's team — blue for CTs killed, amber for Ts killed.
// Kills are downsampled so a 36-round match doesn't render hundreds.
type Marker = {
  left: string;
  type: "kill" | "round";
  label: string;
  tick: number;
  victimTeam?: "ct" | "t";
  headshot?: boolean;
};
function jumpToKill(tick: number) {
  const lead = Math.round(5 * store.tickRate);
  const target = Math.max(0, tick - lead);
  pulseAt(target);
  seek(target);
}
function nameFor(steamId: string | undefined): string | null {
  if (!steamId) return null;
  // Steam IDs come through as numeric strings; the lineup map is
  // keyed the same way. Falls through to a short suffix so anonymous
  // bots / world damage don't render as a 17-char id.
  return store.playerNames[steamId] ?? `#${steamId.slice(-4)}`;
}
function killLabel(k: {
  killer?: string;
  victim?: string;
  headshot?: boolean;
  weapon?: string;
}) {
  const killer = nameFor(k.killer);
  const victim = nameFor(k.victim);
  const verb = k.headshot ? "headshot" : "killed";
  const weapon = k.weapon ? ` (${k.weapon})` : "";
  if (killer && victim) return `${killer} ${verb} ${victim}${weapon}`;
  if (victim) return `${victim} died${weapon}`;
  return k.headshot ? "Headshot kill" : "Kill";
}
// Kills shown on the seek bar respect the active player filter +
// filter mode (kills BY the player, or deaths OF the player).
const filteredKillsForMarkers = computed(() => {
  if (!store.killFilterSteamId) return store.kills;
  const sid = store.killFilterSteamId;
  return store.kills.filter((k) =>
    store.killFilterMode === "victim" ? k.victim === sid : k.killer === sid,
  );
});
const roundMarkers = computed<Marker[]>(() => {
  if (!hasMetadata.value) return [];
  const total = store.totalTicks;
  return store.roundTicks.map((r) => ({
    left: `${(r.start_tick / total) * 100}%`,
    type: "round" as const,
    tick: r.start_tick,
    label: `Round ${r.round}`,
  }));
});
const killMarkers = computed<Marker[]>(() => {
  if (!hasMetadata.value) return [];
  const out: Marker[] = [];
  const total = store.totalTicks;
  const kills = filteredKillsForMarkers.value;
  const killStride = Math.max(1, Math.floor(kills.length / 80));
  for (let i = 0; i < kills.length; i += killStride) {
    const k = kills[i];
    out.push({
      left: `${(k.tick / total) * 100}%`,
      type: "kill",
      tick: k.tick,
      victimTeam: k.victim_team,
      headshot: !!k.headshot,
      label: killLabel(k),
    });
  }
  return out;
});
</script>

<template>
  <!-- All Tooltip primitives in this component need a TooltipProvider
       ancestor — without it reka-ui throws "Injection
       Symbol(TooltipProviderContext) not found" at setup time and the
       whole controls panel fails to mount. -->
  <TooltipProvider :delay-duration="200">
    <div
      class="flex flex-col gap-3 px-5 py-4 bg-card/95 backdrop-blur-sm border-t border-border/60"
    >
      <!-- End-of-demo prompt. cs2 drops back to the menu when the
           demo finishes; the operator can click here (or hit R) to
           re-fire playdemo without restarting the pod. -->
      <Transition name="reload-prompt">
        <div
          v-if="showReloadPrompt"
          class="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2"
        >
          <span
            class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
          >
            Demo ended — cs2 dropped to menu
          </span>
          <Button
            variant="outline"
            size="sm"
            class="h-7 cursor-pointer transition-all hover:scale-105"
            @click="reloadDemo"
          >
            <RotateCcw class="h-3.5 w-3.5 mr-1.5" />
            Reload <Kbd class="ml-2">R</Kbd>
          </Button>
        </div>
      </Transition>

      <!-- Round chips at the top — they map directly onto the seek bar
           below as landmarks, so reading downward is "round map → time
           cursor". Render winner color when known. pt-1 leaves room
           for the hover-lift translate so it isn't clipped by the
           overflow-y-auto wrapper. -->
      <div
        v-if="store.roundTicks.length"
        class="flex flex-wrap gap-1.5 max-h-20 pt-1 overflow-y-auto"
      >
        <button
          v-for="r in store.roundTicks"
          :key="r.round"
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider border cursor-pointer transition-all duration-150 hover:bg-primary/10 hover:border-primary hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95"
          :class="{
            'border-blue-500/60 text-blue-200': r.winner === 'ct',
            'border-amber-500/60 text-amber-200': r.winner === 't',
            'border-border/60': !r.winner,
          }"
          :title="`Jump to round ${r.round}${
            roundScores.get(r.round)
              ? ` (${roundScores.get(r.round)!.ct}–${roundScores.get(r.round)!.t})`
              : ''
          }`"
          @click="jumpToRound(r.round)"
        >
          <span>R{{ r.round }}</span>
          <span
            v-if="roundScores.get(r.round)"
            class="text-[0.6rem] tracking-normal text-muted-foreground"
          >
            {{ roundScores.get(r.round)!.ct }}–{{ roundScores.get(r.round)!.t }}
          </span>
        </button>
      </div>

      <!-- Seek slider + two marker rails. The skull rail floats above
           the bar (so the icons read clearly without overlapping the
           thumb), the round-tick rail sits inside the bar as a subtle
           landmark. Both are pointer-events: auto only on the glyph
           itself so dragging the slider underneath still works. -->
      <div v-if="hasMetadata" class="flex items-center gap-4">
        <span
          class="font-mono text-sm tabular-nums text-muted-foreground min-w-[3.5rem] text-right"
        >
          {{ formattedCurrent }}
        </span>
        <div class="flex-1 relative">
          <!-- Skull rail — sits above the bar. Two-tone by victim team:
               blue = CT killed, amber = T killed. Faint missing-team
               skulls fall through to neutral red when the parser hasn't
               filled victim_team yet (older demos / partial parses).
               TransitionGroup so filter changes fade markers in/out
               instead of popping. Key includes the kill tick so Vue
               treats filtered-in skulls as new nodes. -->
          <TransitionGroup
            tag="div"
            name="skull"
            class="relative h-4 mb-1 pointer-events-none"
            aria-hidden="true"
          >
            <Tooltip v-for="m in killMarkers" :key="`s-${m.tick}`">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  :style="{ left: m.left }"
                  class="absolute bottom-0 -translate-x-1/2 pointer-events-auto cursor-pointer transition-all duration-150 hover:scale-150 hover:-translate-y-0.5 active:scale-125"
                  :title="`${m.label} — click to jump`"
                  @click="jumpToKill(m.tick)"
                >
                  <Skull
                    :class="[
                      m.headshot ? 'h-4 w-4' : 'h-3 w-3',
                      {
                        'text-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.7)]':
                          m.victimTeam === 'ct',
                        'text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.7)]':
                          m.victimTeam === 't',
                        'text-red-400/70': !m.victimTeam,
                      },
                    ]"
                    :stroke-width="m.headshot ? 3 : 2.25"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>{{ m.label }}</TooltipContent>
            </Tooltip>
          </TransitionGroup>

          <!-- Slider + round-tick rail. -->
          <div class="relative h-6">
            <Slider
              :model-value="seekModel"
              :min="0"
              :max="store.totalTicks"
              :step="1"
              class="absolute inset-0 z-10 cursor-pointer"
              @update:model-value="onSeekUpdate"
              @pointerdown="onSeekStart"
              @value-commit="onSeekCommit"
            />
            <div
              class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 pointer-events-none"
            >
              <Tooltip v-for="m in roundMarkers" :key="`r-${m.tick}`">
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    :style="{ left: m.left }"
                    class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto h-3 w-[2px] bg-[hsl(var(--tac-amber))] cursor-pointer hover:h-4 hover:w-[3px] hover:bg-[hsl(var(--tac-amber))] transition-all duration-150"
                    :title="`${m.label} — click to jump`"
                    @click="seek(m.tick)"
                  />
                </TooltipTrigger>
                <TooltipContent>{{ m.label }}</TooltipContent>
              </Tooltip>
            </div>

            <!-- Click-pulse ring. Re-keyed on every pulse so the CSS
                 animation restarts for back-to-back clicks. z-20 so it
                 paints above the slider thumb but below tooltips. -->
            <span
              v-if="pulseSerial > 0"
              :key="pulseSerial"
              :style="{ left: pulseLeft }"
              class="seek-pulse absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>
        <span
          class="font-mono text-sm tabular-nums text-muted-foreground min-w-[3.5rem]"
        >
          {{ formattedTotal }}
        </span>
      </div>
      <p
        v-else
        class="text-xs uppercase tracking-wider text-muted-foreground/70"
      >
        Demo metadata not parsed yet — play/pause + skip + speed still work.
      </p>

      <!-- Player switcher. Everything (slot index, name, side, alive)
           comes from cs2 GSI — the demo file is the source of truth.
           CT row is on top, T row below, matching cs2's HUD ordering.
           At halftime + every OT swap, players move between rows
           automatically because their `team` field flips in GSI. -->
      <div v-if="hasGsi" class="flex flex-col gap-1.5">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 min-w-[8rem]">
            <span
              :class="['inline-block size-1.5 rounded-full', sideDotClass('CT')]"
            />
            <span
              class="truncate font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground/80"
            >
              {{ ctTeamName() }}
              <span class="ml-1 px-1 rounded font-bold bg-blue-500/20 text-blue-300">
                CT
              </span>
              <span
                v-if="store.gsiTeamCtScore || store.gsiTeamTScore"
                class="ml-1 text-foreground"
              >
                {{ store.gsiTeamCtScore }}
              </span>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="s in ctSlots"
              :key="`ct-${s.slot}-${s.steam_id}`"
              type="button"
              :class="[
                'group inline-flex h-9 items-center gap-1.5 rounded-md border px-2 font-mono text-xs transition-all duration-100 select-none cursor-pointer',
                sideClasses('CT', slotIsActive(s), flashSlot === s.slot),
                !s.alive && !slotIsActive(s) ? 'opacity-50' : '',
              ]"
              :title="s.name ?? `Slot ${s.slot}`"
              @click="pressSlot(s.slot)"
            >
              <span
                class="inline-flex h-5 w-5 items-center justify-center rounded text-[0.65rem] font-bold tabular-nums bg-foreground/10"
              >
                {{ s.slot }}
              </span>
              <span
                :class="[
                  'truncate max-w-[8rem] font-medium',
                  !s.alive ? 'line-through' : '',
                ]"
              >
                {{ s.name ?? `Slot ${s.slot}` }}
              </span>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 min-w-[8rem]">
            <span
              :class="['inline-block size-1.5 rounded-full', sideDotClass('T')]"
            />
            <span
              class="truncate font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground/80"
            >
              {{ tTeamName() }}
              <span class="ml-1 px-1 rounded font-bold bg-amber-500/20 text-amber-200">
                T
              </span>
              <span
                v-if="store.gsiTeamCtScore || store.gsiTeamTScore"
                class="ml-1 text-foreground"
              >
                {{ store.gsiTeamTScore }}
              </span>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="s in tSlots"
              :key="`t-${s.slot}-${s.steam_id}`"
              type="button"
              :class="[
                'group inline-flex h-9 items-center gap-1.5 rounded-md border px-2 font-mono text-xs transition-all duration-100 select-none cursor-pointer',
                sideClasses('T', slotIsActive(s), flashSlot === s.slot),
                !s.alive && !slotIsActive(s) ? 'opacity-50' : '',
              ]"
              :title="s.name ?? `Slot ${s.slot}`"
              @click="pressSlot(s.slot)"
            >
              <span
                class="inline-flex h-5 w-5 items-center justify-center rounded text-[0.65rem] font-bold tabular-nums bg-foreground/10"
              >
                {{ s.slot }}
              </span>
              <span
                :class="[
                  'truncate max-w-[8rem] font-medium',
                  !s.alive ? 'line-through' : '',
                ]"
              >
                {{ s.name ?? `Slot ${s.slot}` }}
              </span>
            </button>
          </div>
        </div>
      </div>
      <p
        v-else-if="store.isPlaying"
        class="text-[0.65rem] uppercase tracking-wider text-muted-foreground/60 font-mono"
      >
        Waiting for cs2 game state…
      </p>

      <!-- Buttons row.
           Layout: 3-column grid so the transport cluster (prev-round,
           skip-back, play/pause, skip-fwd, next-round) stays visually
           centered no matter how wide the panel gets — the previous
           flex-wrap layout drifted left as the speed selector pushed
           everything around. Left = event jumps, center = transport,
           right = speed. -->
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <!-- Left: round nav + kill-by-player filter. The filter scopes
             prev/next-kill nav AND the skull markers — useful for
             reviewing one player's frags without scrubbing through
             everyone else's. Click "All" to clear. -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 hover:border-[hsl(var(--tac-amber)/0.6)] active:scale-95"
                :disabled="!hasMetadata || !store.roundTicks.length"
                @click="jumpToPrevRound"
              >
                <ChevronsLeft class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              Previous round <Kbd>[</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 hover:border-[hsl(var(--tac-amber)/0.6)] active:scale-95"
                :disabled="!hasMetadata || !store.roundTicks.length"
                @click="jumpToNextRound"
              >
                <ChevronsRight class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              Next round <Kbd>]</Kbd>
            </TooltipContent>
          </Tooltip>

          <button
            v-if="hasDemoPlayers"
            type="button"
            class="ml-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] cursor-pointer transition-all duration-150 hover:text-foreground"
            :class="
              store.killFilterMode === 'killer'
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-red-300'
            "
            :title="
              store.killFilterMode === 'killer'
                ? 'Showing kills BY player — click to switch to deaths OF player'
                : 'Showing deaths OF player — click to switch to kills BY player'
            "
            @click="toggleKillFilterMode"
          >
            {{ store.killFilterMode === "killer" ? "Kills by" : "Deaths of" }}
          </button>
          <Select
            v-if="hasDemoPlayers"
            :model-value="store.killFilterSteamId ?? '__all__'"
            @update:model-value="onKillFilterChange"
          >
            <SelectTrigger
              class="h-9 w-44 text-xs cursor-pointer"
              :class="
                store.killFilterSteamId ? 'border-red-500/60 text-red-200' : ''
              "
            >
              <span class="flex items-center gap-2 truncate">
                <Skull
                  v-if="store.killFilterSteamId"
                  class="h-3 w-3 shrink-0 text-red-400"
                  :stroke-width="2.5"
                />
                <span class="truncate">{{ activeFilterLabel }}</span>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" class="cursor-pointer">
                All players ({{ store.kills.length }})
              </SelectItem>
              <SelectGroup v-if="ctDemoPlayers.length">
                <SelectLabel
                  class="text-[0.65rem] uppercase tracking-wider text-blue-300"
                >
                  {{ ctTeamName() }} (CT)
                </SelectLabel>
                <SelectItem
                  v-for="p in ctDemoPlayers"
                  :key="p.steam_id"
                  :value="p.steam_id"
                  class="cursor-pointer"
                >
                  {{ p.name }} ({{ killCountFor(p.steam_id) }})
                </SelectItem>
              </SelectGroup>
              <SelectGroup v-if="tDemoPlayers.length">
                <SelectLabel
                  class="text-[0.65rem] uppercase tracking-wider text-amber-300"
                >
                  {{ tTeamName() }} (T)
                </SelectLabel>
                <SelectItem
                  v-for="p in tDemoPlayers"
                  :key="p.steam_id"
                  :value="p.steam_id"
                  class="cursor-pointer"
                >
                  {{ p.name }} ({{ killCountFor(p.steam_id) }})
                </SelectItem>
              </SelectGroup>
              <SelectGroup v-if="otherDemoPlayers.length">
                <SelectLabel
                  class="text-[0.65rem] uppercase tracking-wider text-muted-foreground"
                >
                  Other
                </SelectLabel>
                <SelectItem
                  v-for="p in otherDemoPlayers"
                  :key="p.steam_id"
                  :value="p.steam_id"
                  class="cursor-pointer"
                >
                  {{ p.name }} ({{ killCountFor(p.steam_id) }})
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <!-- Center: primary transport. Kill nav flanks play/pause so
             the most-used "go to next death" action sits within thumb
             reach of the play button. Skull buttons get a red accent on
             hover + an active:scale-95 squish for tactile feedback. -->
        <div class="flex items-center justify-center gap-1.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                :disabled="!hasMetadata || !store.kills.length"
                class="kill-nav inline-flex items-center justify-center gap-0.5 h-10 w-14 rounded-md border border-red-500/40 bg-red-500/5 text-red-300/90 cursor-pointer transition-all duration-100 hover:border-red-500/80 hover:bg-red-500/15 hover:text-red-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500/5"
                @click="jumpToPrevKill"
              >
                <ChevronsLeft class="h-3.5 w-3.5" />
                <Skull class="h-4 w-4" :stroke-width="2.25" />
              </button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              Previous kill <Kbd>P</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-10 w-10 cursor-pointer transition-all duration-150 hover:scale-110 hover:bg-accent/70 active:scale-95"
                @click="skip(-15)"
              >
                <SkipBack class="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              Skip back 15s <Kbd>←</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="default"
                size="icon"
                class="h-12 w-12 rounded-full shadow-md cursor-pointer transition-all duration-150 hover:scale-105 hover:shadow-lg active:scale-95"
                @click="togglePause"
              >
                <Transition name="play-pause" mode="out-in">
                  <Play v-if="store.paused" key="play" class="h-6 w-6" />
                  <Pause v-else key="pause" class="h-6 w-6" />
                </Transition>
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              {{ store.paused ? "Play" : "Pause" }} <Kbd>Space</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-10 w-10 cursor-pointer transition-all duration-150 hover:scale-110 hover:bg-accent/70 active:scale-95"
                @click="skip(15)"
              >
                <SkipForward class="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              Skip forward 15s <Kbd>→</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                :disabled="!hasMetadata || !store.kills.length"
                class="kill-nav inline-flex items-center justify-center gap-0.5 h-10 w-14 rounded-md border border-red-500/40 bg-red-500/5 text-red-300/90 cursor-pointer transition-all duration-100 hover:border-red-500/80 hover:bg-red-500/15 hover:text-red-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500/5"
                @click="jumpToNextKill"
              >
                <Skull class="h-4 w-4" :stroke-width="2.25" />
                <ChevronsRight class="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              Next kill <Kbd>N</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        <!-- Right: quick actions + speed selector. -->
        <div class="flex items-center justify-end gap-2">
          <Tooltip v-if="canCreateClip">
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 hover:border-[hsl(var(--tac-amber)/0.6)] active:scale-95"
                :disabled="!hasMetadata"
                title="Create clip"
                @click="showCreateClipDialog = true"
              >
                <Film class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create clip from this demo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95"
                title="Toggle CS2 demo HUD"
                @click="toggleDemoUI"
              >
                <PanelBottom class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle CS2 demo HUD</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95"
                title="Reload demo"
                @click="reloadDemo"
              >
                <RotateCcw class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              Reload demo <Kbd>R</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95"
                :class="
                  store.xrayEnabled
                    ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                    : ''
                "
                @click="toggleXray"
              >
                <Bone class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              X-ray {{ store.xrayEnabled ? "on" : "off" }} <Kbd>X</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95"
                :class="
                  !store.hudVisible ? 'border-red-500/60 text-red-300' : ''
                "
                @click="toggleHud"
              >
                <Eye v-if="store.hudVisible" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              {{ store.hudVisible ? "Hide" : "Show" }} OpenHud overlay
              <Kbd>H</Kbd>
            </TooltipContent>
          </Tooltip>

          <span class="w-px h-6 bg-border/60 mx-1" />

          <Gauge class="h-4 w-4 text-muted-foreground" />
          <Select
            :model-value="String(store.rate)"
            @update:model-value="onSpeedChange"
          >
            <SelectTrigger class="w-24 h-10 text-sm cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="s in SPEED_OPTIONS"
                :key="s"
                :value="String(s)"
              >
                {{ s }}×
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- Mounted INSIDE the single root div on purpose: TooltipProvider
           is a render-no-dom context provider, and adding the dialog
           as a sibling of this div would make the component multi-root.
           The parent's `<Transition name="controls-slide">` in
           DemoPlayer.vue can't manage multi-root children — it stops
           cleaning up old copies on reactive updates and the controls
           bar starts accumulating duplicates on every skull-click pulse. -->
      <CreateClipDialog
        v-if="canCreateClip && store.matchMapId"
        v-model:open="showCreateClipDialog"
        :match-map-id="store.matchMapId"
      />
    </div>
  </TooltipProvider>
</template>

<style scoped>
/* Play/pause icon swap. mode="out-in" runs leave then enter, so a
   quick scale-down + fade-out followed by scale-up + fade-in reads
   as the icon flipping through the button face. */
.play-pause-enter-active,
.play-pause-leave-active {
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}
.play-pause-enter-from {
  opacity: 0;
  transform: scale(0.6) rotate(-15deg);
}
.play-pause-leave-to {
  opacity: 0;
  transform: scale(0.6) rotate(15deg);
}

/* Skull marker enter/leave for the player-filter swap. Coming in: a
   little drop from above with a fade. Going out: a quick collapse so
   the rail clears before the new set lands. */
.skull-enter-active,
.skull-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}
.skull-enter-from {
  opacity: 0;
  transform: translate(-50%, -8px) scale(0.6);
}
.skull-leave-to {
  opacity: 0;
  transform: translate(-50%, 0) scale(0.4);
}
.skull-leave-active {
  /* Leaving items keep their absolute slot so the rail doesn't
     collapse during the transition. */
  position: absolute;
}

.reload-prompt-enter-active,
.reload-prompt-leave-active {
  transition:
    opacity 250ms ease,
    transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1),
    max-height 250ms ease;
  overflow: hidden;
}
.reload-prompt-enter-from,
.reload-prompt-leave-to {
  opacity: 0;
  transform: translateY(-4px);
  max-height: 0;
}
.reload-prompt-enter-to,
.reload-prompt-leave-from {
  max-height: 4rem;
}

/* One-shot click-pulse on the seek bar. Two layered rings spreading
   outward — the outer ring fades fast for impact, the inner one
   lingers a touch longer for follow-through. */
.seek-pulse {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  background: hsl(var(--tac-amber) / 0.55);
  box-shadow:
    0 0 0 0 hsl(var(--tac-amber) / 0.75),
    0 0 0 0 hsl(var(--tac-amber) / 0.5);
  animation: seek-pulse-fire 480ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
@keyframes seek-pulse-fire {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.4);
    box-shadow:
      0 0 0 0 hsl(var(--tac-amber) / 0.75),
      0 0 0 0 hsl(var(--tac-amber) / 0.5);
  }
  60% {
    opacity: 0.8;
    box-shadow:
      0 0 0 10px hsl(var(--tac-amber) / 0),
      0 0 0 18px hsl(var(--tac-amber) / 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.6);
    box-shadow:
      0 0 0 14px hsl(var(--tac-amber) / 0),
      0 0 0 24px hsl(var(--tac-amber) / 0);
  }
}
</style>
