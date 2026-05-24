<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
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
  ArrowLeftRight,
  RotateCcw,
  Bone,
  PanelBottom,
  Film,
  Sparkles,
  Scissors,
  Wand2,
  Trophy,
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
import { useClipEditor } from "~/composables/useClipEditor";
import SpectatorSlots from "~/components/stream-deck/SpectatorSlots.vue";
import { resolveKeyToRealSlot } from "~/utilities/streamerSpecSlots";

// API gates clip creation at verified_user; we only check "logged in"
// on the client so any logged-in viewer sees the button.
const canCreateClip = computed(() => !!useAuthStore().me?.steam_id);
const showCreateClipDialog = ref(false);
const dialogInitialMode = ref<"manual" | "auto">("auto");
const editor = useClipEditor();
function openAutoClip() {
  dialogInitialMode.value = "auto";
  showCreateClipDialog.value = true;
}
function toggleClipEditor() {
  if (editor.active.value) editor.close();
  else editor.open();
}

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
  setHudMode,
  toggleHudSides,
  toggleDemoUI,
  toggleAutodirector,
  setScoreboard,
} = useDemoPlayback();

// JTs Hud's default bundle declares variants ["default","horizontal",
// "vertical"] in hud.json — but `default` and `horizontal` render the
// same layout, so we only expose the two distinct ones. Legacy
// `default` payloads are folded into `horizontal` at the boundary.
const HUD_MODES: Array<"horizontal" | "vertical"> = ["horizontal", "vertical"];
const HUD_MODE_LABELS: Record<(typeof HUD_MODES)[number], string> = {
  horizontal: "Horizontal",
  vertical: "Vertical",
};

// Slot identity is GSI — survives a demo attached to the wrong match_map.
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

// Kill-filter dropdown uses these for the side group labels even
// after the slot row moved into SpectatorSlots, so they stay here.
function ctTeamName(): string {
  return store.gsiTeamCtName || t("match.replay.counter_terrorists");
}
function tTeamName(): string {
  return store.gsiTeamTName || t("match.replay.terrorists");
}

// Flash holds until GSI's spec target lands on the slot we pressed,
// or a 2.5s ceiling — so the operator sees their press is "in
// flight" while cs2 round-trips, instead of a 220ms blip that's
// gone before the demo player actually switches cameras.
const flashSlot = ref<number | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;
function pressSlot(slot: number) {
  flashSlot.value = slot;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashSlot.value = null;
    flashTimer = null;
  }, 2500);
  switchToSlot(slot);
}
watch(
  () => store.spectatedSteamId,
  (sid) => {
    if (flashSlot.value == null || !sid) return;
    const matched = store.specSlots.find(
      (s) => s.slot === flashSlot.value && s.steam_id === sid,
    );
    if (matched) {
      flashSlot.value = null;
      if (flashTimer) {
        clearTimeout(flashTimer);
        flashTimer = null;
      }
    }
  },
);

// Seek/round-jump need parser metadata; without it we fall back to
// just play/pause/skip/speed.
const hasMetadata = computed(() => store.totalTicks > 0 && store.tickRate > 0);

const seekModel = ref<number[]>([0]);
const dragging = ref(false);

// Smooths the seek thumb on jumps; small per-frame diffs track 1:1.
const visualTick = ref(0);
let rafHandle: number | null = null;

// :key bumps each pulse so the CSS animation restarts from frame 0.
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
// Skip writes when nothing changed so a paused demo doesn't fire a
// reactive update every frame.
function frame() {
  if (rafHandle === null) return;
  rafHandle = requestAnimationFrame(frame);
  if (!hasMetadata.value || dragging.value) return;
  const target = store.currentTick;
  const diff = target - visualTick.value;
  if (diff === 0) return;
  const threshold = store.tickRate * 0.75;
  if (Math.abs(diff) > threshold) {
    // Big jump — ease in (0.18 ≈ 300ms at 60fps).
    visualTick.value += diff * 0.18;
    if (Math.abs(target - visualTick.value) < 2) visualTick.value = target;
  } else {
    visualTick.value = target;
  }
  const nextSlider = Math.round(visualTick.value);
  if (seekModel.value[0] !== nextSlider) {
    seekModel.value = [nextSlider];
  }
}

function syncVisualTickFromStore() {
  visualTick.value = store.currentTick;
  seekModel.value = [store.currentTick];
}

function startFrameLoop() {
  if (rafHandle !== null) return;
  rafHandle = requestAnimationFrame(frame);
}

function stopFrameLoop() {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
}

const shouldAnimateScrubber = computed(
  () => hasMetadata.value && store.isPlaying && !store.paused,
);

watch(
  shouldAnimateScrubber,
  (active) => {
    if (active && !dragging.value) startFrameLoop();
    else {
      stopFrameLoop();
      if (hasMetadata.value) syncVisualTickFromStore();
    }
  },
  { immediate: true },
);

watch(dragging, (isDragging) => {
  if (isDragging) {
    stopFrameLoop();
    return;
  }
  if (shouldAnimateScrubber.value) startFrameLoop();
});
// Keyboard shortcuts. Mirrors stream-deck plus playback-specific keys.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}
// Press-and-hold scoreboard. mousedown → +showscores, mouseup OR
// window blur → -showscores. Window-level mouseup so a drag-off-then
// -release still drops the scoreboard.
let scoreboardHeld = false;
function startScoreboardHold() {
  if (scoreboardHeld) return;
  scoreboardHeld = true;
  setScoreboard(true);
  window.addEventListener("mouseup", endScoreboardHold);
  window.addEventListener("blur", endScoreboardHold);
}
function endScoreboardHold() {
  if (!scoreboardHeld) return;
  scoreboardHeld = false;
  setScoreboard(false);
  window.removeEventListener("mouseup", endScoreboardHold);
  window.removeEventListener("blur", endScoreboardHold);
}
function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isTypingTarget(e.target)) return;

  // Tab hold → +showscores. Browser auto-repeats keydown while held,
  // so gate on scoreboardHeld to fire exactly once.
  if (e.key === "Tab") {
    e.preventDefault();
    if (!scoreboardHeld) startScoreboardHold();
    return;
  }

  // Digit keys map to UI positions, not raw cs2 slots — same
  // ordering as the SpectatorSlots row, so what you press matches
  // what you see. resolveKeyToRealSlot returns null if the slot
  // is empty (placeholder) so we can no-op cleanly.
  if (/^[0-9]$/.test(e.key)) {
    const real = resolveKeyToRealSlot(
      e.key,
      ctSlots.value,
      tSlots.value,
      store.matchType,
    );
    if (real != null) {
      e.preventDefault();
      pressSlot(real);
    }
    return;
  }
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    togglePause();
    return;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    skip(-15);
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    skip(15);
    return;
  }
  if (e.key === "[") {
    e.preventDefault();
    jumpToPrevRound();
    return;
  }
  if (e.key === "]") {
    e.preventDefault();
    jumpToNextRound();
    return;
  }
  if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    jumpToPrevKill();
    return;
  }
  if (e.key === "n" || e.key === "N") {
    e.preventDefault();
    jumpToNextKill();
    return;
  }
  if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    reloadDemo();
    return;
  }
  if (e.key === "x" || e.key === "X") {
    e.preventDefault();
    toggleXray();
    return;
  }
  if (e.key === "h" || e.key === "H") {
    e.preventDefault();
    toggleHud();
    return;
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.key === "Tab" && scoreboardHeld) {
    e.preventDefault();
    endScoreboardHold();
  }
}

onMounted(() => {
  syncVisualTickFromStore();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
});
onBeforeUnmount(() => {
  stopFrameLoop();
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  endScoreboardHold();
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
  if (!sid) return t("match_extras.all_players");
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
  <!-- Real <div> root so the parent's Transition has an element to
       animate; TooltipProvider renders no DOM. -->
  <div
    class="flex flex-col gap-3 px-5 py-4 bg-card/95 backdrop-blur-sm border-t border-border/60"
  >
    <TooltipProvider :delay-duration="200">
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

      <div v-if="hasMetadata" class="flex items-center gap-4">
        <span
          class="font-mono text-sm tabular-nums text-muted-foreground min-w-[3.5rem] text-right"
        >
          {{ formattedCurrent }}
        </span>
        <div class="flex-1 relative">
          <!-- Skull rail — two-tone by victim team. Plain buttons (not
               reka-ui Tooltip) because TransitionGroup needs real DOM. -->
          <TransitionGroup
            tag="div"
            name="skull"
            class="relative h-4 mb-1 pointer-events-none"
            aria-hidden="true"
          >
            <button
              v-for="m in killMarkers"
              :key="`s-${m.tick}`"
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
          </TransitionGroup>

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

      <SpectatorSlots
        v-if="store.isPlaying || ctSlots.length || tSlots.length"
        layout="grid"
        :ct-slots="ctSlots"
        :t-slots="tSlots"
        :team-ct-name="store.gsiTeamCtName"
        :team-t-name="store.gsiTeamTName"
        :match-type="store.matchType"
        :active-steam-id="store.spectatedSteamId"
        :flash-slot="flashSlot"
        :autodirector-on="store.autodirectorEnabled"
        @press-slot="(slot: number) => pressSlot(slot)"
      />

      <!-- 3-col grid keeps the transport cluster centered regardless
           of how wide the panel gets. -->
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
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
                  {{ $t("clips.create_dialog.other_group") }}
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
              {{
                store.paused
                  ? $t("match.replay.play")
                  : $t("match.replay.pause")
              }}
              <Kbd>Space</Kbd>
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
              {{ $t("replay_extras.skip_forward_15s") }} <Kbd>→</Kbd>
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

        <div class="flex items-center justify-end gap-2">
          <Tooltip v-if="canCreateClip">
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 hover:border-[hsl(var(--tac-amber)/0.6)] active:scale-95"
                :disabled="!hasMetadata"
                :title="$t('ui.auto_clip')"
                @click="openAutoClip"
              >
                <Sparkles class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Auto clip from preset</TooltipContent>
          </Tooltip>

          <Tooltip v-if="canCreateClip">
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95"
                :class="
                  editor.active.value
                    ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                    : 'hover:border-[hsl(var(--tac-amber)/0.6)]'
                "
                :disabled="!hasMetadata"
                :title="$t('ui.create_clip')"
                @click="toggleClipEditor"
              >
                <Scissors class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{
                editor.active.value ? "Hide clip editor" : "Open clip editor"
              }}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95"
                :title="$t('replay_extras.toggle_cs2_hud')"
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
                :title="$t('ui.reload_demo')"
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
                  store.autodirectorEnabled
                    ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                    : ''
                "
                @click="toggleAutodirector"
              >
                <Wand2 class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              {{ $t("match.auto_director") }}
              {{
                store.autodirectorEnabled
                  ? $t("common.enabled")
                  : $t("common.disabled")
              }}
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

          <!-- Scoreboard: press-and-hold for momentary +showscores. -->
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95 select-none active:border-amber-400/60 active:text-amber-300"
                @mousedown.prevent="startScoreboardHold"
              >
                <Trophy class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hold to show scoreboard</TooltipContent>
          </Tooltip>

          <!-- HUD bundle picker. Hot-swaps the active JTs Hud Manager
               BrowserWindow in the streamer pod via /spec/hud-mode →
               POST /api/overlay/start. Ephemeral; reset by a pod
               restart to whatever HUD_MODE the api stamped. The
               trailing Eye toggle lives inside the picker (where the
               legacy "Default" segment used to sit) so visibility is
               framed as a third HUD state alongside the two layouts. -->
          <Tooltip>
            <TooltipTrigger as-child>
              <div
                class="inline-flex rounded-md border border-border/60 bg-card/40 p-0.5"
              >
                <button
                  v-for="m in HUD_MODES"
                  :key="m"
                  type="button"
                  class="px-2 h-8 font-mono text-[0.6rem] uppercase tracking-[0.18em] rounded-sm cursor-pointer transition-colors"
                  :class="
                    store.hudVisible && store.hudMode === m
                      ? 'bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="setHudMode(m)"
                >
                  {{ HUD_MODE_LABELS[m] }}
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center px-2 h-8 rounded-sm cursor-pointer transition-colors"
                  :class="
                    !store.hudVisible
                      ? 'bg-red-500/15 text-red-300'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  :title="
                    store.hudVisible
                      ? $t('ui_extras.hide_hud')
                      : $t('ui_extras.show_hud')
                  "
                  @click="toggleHud"
                >
                  <Eye v-if="store.hudVisible" class="h-4 w-4" />
                  <EyeOff v-else class="h-4 w-4" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              HUD layout / visibility <Kbd>H</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95"
                @click="toggleHudSides"
              >
                <ArrowLeftRight class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Swap sides (manual override)</TooltipContent>
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

      <!-- Inside this div on purpose: parent's Transition needs a
           single root, and TooltipProvider renders no DOM. -->
      <CreateClipDialog
        v-if="canCreateClip && store.matchMapId"
        v-model:open="showCreateClipDialog"
        :match-map-id="store.matchMapId"
        :initial-mode="dialogInitialMode"
      />
    </TooltipProvider>
  </div>
</template>

<style scoped>
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
