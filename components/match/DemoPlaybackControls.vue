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
import { e_player_roles_enum } from "~/generated/zeus";
import CreateClipDialog from "~/components/clips/CreateClipDialog.vue";
import { Button } from "~/components/ui/button";
import { Kbd } from "~/components/ui/kbd";
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
import {
  broadcastHudLabel,
  useBroadcastHuds,
} from "~/composables/useBroadcastHuds";
import RoundSelector from "~/components/match/RoundSelector.vue";
import DemoSeekBar from "~/components/match/DemoSeekBar.vue";
import { roundIndexAt } from "~/utilities/demoTickEstimate";
import SpectatorSlots from "~/components/stream-deck/SpectatorSlots.vue";
import { resolveKeyToRealSlot } from "~/utilities/streamerSpecSlots";

// API gates clip creation at streamer; mirror that on the client so a
// non-streamer viewer (e.g. a plain-user organizer watching their own demo)
// doesn't see a button the action would reject.
const canCreateClip = computed(() =>
  useAuthStore().isRoleAbove(e_player_roles_enum.streamer),
);
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
  setHud,
  toggleHudSides,
  toggleDemoUI,
  toggleAutodirector,
  setScoreboard,
} = useDemoPlayback();

const { huds: broadcastHuds } = useBroadcastHuds();

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

// Round strip + end-of-demo prompt follow the seek bar's on-screen
// position (playhead, or the drag while scrubbing). The seek bar reports
// every frame; these only write when the value actually changes, so the
// controls re-render on a round boundary, not per frame.
const sortedRounds = computed(() =>
  store.roundTicks.slice().sort((a, b) => a.start_tick - b.start_tick),
);
const currentRound = ref<number | null>(null);
// Once the playhead crosses the end, cs2 has dropped back to the menu —
// surface a "Reload?" prompt. Auto-dismisses on R / Reload.
const showReloadPrompt = ref(false);
function onSeekPosition(tick: number) {
  const idx = roundIndexAt(sortedRounds.value, tick);
  const round = idx >= 0 ? sortedRounds.value[idx].round : null;
  if (round !== currentRound.value) currentRound.value = round;
  const ended = store.totalTicks > 0 && tick >= store.totalTicks - 32;
  if (ended !== showReloadPrompt.value) showReloadPrompt.value = ended;
}

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
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  endScoreboardHold();
});

function onSpeedChange(value: unknown) {
  const n = Number(value);
  if (Number.isFinite(n)) void setSpeed(n);
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
// steam_id → GSI name/team. GSI lands every second with fresh health, so
// this keeps its previous identity unless a name or side actually changed
// — otherwise the roster below (and the dropdown) would rebuild and
// re-sort every second of a fight.
type GsiIdentity = Map<
  string,
  { name: string | null; team: "T" | "CT" | null }
>;
const gsiIdentity = computed<GsiIdentity>((prev) => {
  const next: GsiIdentity = new Map();
  for (const s of store.specSlots) {
    if (s.steam_id) next.set(s.steam_id, { name: s.name, team: s.team });
  }
  if (prev && prev.size === next.size) {
    let same = true;
    for (const [sid, v] of next) {
      const p = prev.get(sid);
      if (!p || p.name !== v.name || p.team !== v.team) {
        same = false;
        break;
      }
    }
    if (same) return prev;
  }
  return next;
});
// Prefer GSI's name (always matches the demo file) over the api
// lineup name (which can be wrong for cross-loaded demos).
function displayNameFor(sid: string): string {
  return (
    gsiIdentity.value.get(sid)?.name ??
    store.playerNames[sid] ??
    `#${sid.slice(-4)}`
  );
}
const demoPlayers = computed<KillPlayer[]>(() => {
  const seen = new Set<string>();
  const players: KillPlayer[] = [];
  const add = (sid: string | undefined) => {
    if (!sid || seen.has(sid)) return;
    seen.add(sid);
    players.push({
      steam_id: sid,
      name: displayNameFor(sid),
      team: gsiIdentity.value.get(sid)?.team ?? null,
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
// One pass over the kill list per mode, instead of one per dropdown row
// per render.
const killCounts = computed(() => {
  const counts = new Map<string, number>();
  const byVictim = store.killFilterMode === "victim";
  for (const k of store.kills) {
    const sid = byVictim ? k.victim : k.killer;
    if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
  }
  return counts;
});
function killCountFor(steamId: string) {
  return killCounts.value.get(steamId) ?? 0;
}
// Mirrors filteredKills in useDemoPlayback: explicit pick wins, else
// the spectated player.
const followedKillSteamId = computed(
  () => store.killFilterSteamId ?? store.spectatedSteamId ?? null,
);
const followedKillName = computed(() => {
  const sid = followedKillSteamId.value;
  return sid ? displayNameFor(sid) : null;
});
const activeFilterLabel = computed(() => {
  const sid = store.killFilterSteamId;
  if (sid) {
    return `${displayNameFor(sid)} (${killCountFor(sid)})`;
  }
  const spectated = store.spectatedSteamId;
  if (spectated) {
    return `${displayNameFor(spectated)} (${killCountFor(spectated)})`;
  }
  return t("match_extras.all_players");
});

// Round strip: numbered cells with a win-colored underline (CT blue / T
// amber), matching the radar round selector. Active cell tracks the
// round the playhead currently sits in.
const playbackRounds = computed<
  Array<{ round: number; winnerSide: "CT" | "T" | null }>
>(() =>
  store.roundTicks.map((r) => ({
    round: r.round,
    winnerSide: r.winner === "ct" ? "CT" : r.winner === "t" ? "T" : null,
  })),
);
function onRoundSelect(round: number | null) {
  if (round != null) jumpToRound(round);
}

function onKillFilterChange(value: unknown) {
  const v = typeof value === "string" ? value : null;
  setKillFilter(v && v !== "__all__" ? v : null);
}
</script>

<template>
  <!-- Real <div> root so the parent's Transition has an element to
       animate; TooltipProvider renders no DOM. -->
  <div
    class="relative flex flex-col gap-3 px-5 py-4 bg-card border-t border-border/60"
  >
    <!-- Floats over the bottom of the video instead of pushing the bar
         open: growing the bar would shrink the video under it. -->
    <Transition name="reload-prompt">
      <div
        v-if="showReloadPrompt"
        class="absolute bottom-full left-1/2 z-20 mb-3 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[#0c0c0f] px-3 py-2 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.9)]"
      >
        <span
          class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          {{ $t("match.demo_playback.demo_ended") }}
        </span>
        <Button
          variant="outline"
          size="sm"
          class="h-7 cursor-pointer"
          @click="reloadDemo"
        >
          <RotateCcw class="h-3.5 w-3.5 mr-1.5" />
          {{ $t("match.demo_playback.reload") }}
          <Kbd class="ml-2">R</Kbd>
        </Button>
      </div>
    </Transition>

    <TooltipProvider>
      <RoundSelector
        v-if="store.roundTicks.length"
        :rounds="playbackRounds"
        :model-value="currentRound"
        class="pt-1"
        @update:model-value="onRoundSelect"
      />

      <DemoSeekBar v-if="hasMetadata" @position="onSeekPosition" />
      <p
        v-else
        class="text-xs uppercase tracking-wider text-muted-foreground/70"
      >
        {{ $t("match.demo_playback.metadata_not_parsed") }}
      </p>

      <SpectatorSlots
        v-if="store.isPlaying || ctSlots.length || tSlots.length"
        layout="grid"
        split
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
                class="h-9 w-9 cursor-pointer hover:border-[hsl(var(--tac-amber)/0.6)]"
                :disabled="!hasMetadata || !store.roundTicks.length"
                @click="jumpToPrevRound"
              >
                <ChevronsLeft class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              {{ $t("match.demo_playback.previous_round") }} <Kbd>[</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer hover:border-[hsl(var(--tac-amber)/0.6)]"
                :disabled="!hasMetadata || !store.roundTicks.length"
                @click="jumpToNextRound"
              >
                <ChevronsRight class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              {{ $t("match.demo_playback.next_round") }} <Kbd>]</Kbd>
            </TooltipContent>
          </Tooltip>

          <button
            v-if="hasDemoPlayers"
            type="button"
            class="ml-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] cursor-pointer transition-colors duration-100 hover:text-foreground"
            :class="
              store.killFilterMode === 'killer'
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-red-300'
            "
            :title="
              store.killFilterMode === 'killer'
                ? $t('match.replay.kill_filter_by_title')
                : $t('match.replay.kill_filter_of_title')
            "
            @click="toggleKillFilterMode"
          >
            {{
              store.killFilterMode === "killer"
                ? $t("match.replay.kills_by")
                : $t("match.replay.deaths_of")
            }}
          </button>
          <Select
            v-if="hasDemoPlayers"
            :model-value="store.killFilterSteamId ?? '__all__'"
            @update:model-value="onKillFilterChange"
          >
            <SelectTrigger
              class="h-9 w-44 text-xs cursor-pointer"
              :class="
                store.killFilterSteamId
                  ? 'border-red-500/60 text-red-200'
                  : followedKillSteamId
                    ? 'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]'
                    : ''
              "
              :title="
                store.killFilterSteamId
                  ? undefined
                  : followedKillSteamId
                    ? $t('match.demo_playback.kill_nav_follows')
                    : undefined
              "
            >
              <span class="flex items-center gap-2 truncate">
                <Skull
                  v-if="store.killFilterSteamId"
                  class="h-3 w-3 shrink-0 text-red-400"
                  :stroke-width="2.5"
                />
                <Eye
                  v-else-if="followedKillSteamId"
                  class="h-3 w-3 shrink-0 text-[hsl(var(--tac-amber))]"
                  :stroke-width="2.5"
                />
                <span class="truncate">{{ activeFilterLabel }}</span>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" class="cursor-pointer">
                {{
                  $t("match.demo_playback.all_players", {
                    count: store.kills.length,
                  })
                }}
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
                class="kill-nav inline-flex items-center justify-center gap-0.5 h-10 w-14 rounded-md border border-red-500/40 bg-red-500/5 text-red-300/90 cursor-pointer transition-colors duration-100 hover:border-red-500/80 hover:bg-red-500/15 hover:text-red-200 active:bg-red-500/25 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500/5"
                @click="jumpToPrevKill"
              >
                <ChevronsLeft class="h-3.5 w-3.5" />
                <Skull class="h-4 w-4" :stroke-width="2.25" />
              </button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              {{
                followedKillName
                  ? $t("match.demo_playback.previous_kill_player", {
                      name: followedKillName,
                    })
                  : $t("match.demo_playback.previous_kill")
              }}
              <Kbd>P</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-10 w-10 cursor-pointer hover:bg-accent/70"
                @click="skip(-15)"
              >
                <SkipBack class="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              {{ $t("match.demo_playback.skip_back", { seconds: 15 }) }}
              <Kbd>←</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="default"
                size="icon"
                class="h-12 w-12 rounded-full shadow-md cursor-pointer hover:shadow-lg"
                @click="togglePause"
              >
                <Play v-if="store.paused" class="h-6 w-6" />
                <Pause v-else class="h-6 w-6" />
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
                class="h-10 w-10 cursor-pointer hover:bg-accent/70"
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
                class="kill-nav inline-flex items-center justify-center gap-0.5 h-10 w-14 rounded-md border border-red-500/40 bg-red-500/5 text-red-300/90 cursor-pointer transition-colors duration-100 hover:border-red-500/80 hover:bg-red-500/15 hover:text-red-200 active:bg-red-500/25 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500/5"
                @click="jumpToNextKill"
              >
                <Skull class="h-4 w-4" :stroke-width="2.25" />
                <ChevronsRight class="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              {{
                followedKillName
                  ? $t("match.demo_playback.next_kill_player", {
                      name: followedKillName,
                    })
                  : $t("match.demo_playback.next_kill")
              }}
              <Kbd>N</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        <div class="flex items-center justify-end gap-2">
          <Tooltip v-if="canCreateClip">
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer hover:border-[hsl(var(--tac-amber)/0.6)]"
                :disabled="!hasMetadata"
                :title="$t('ui.auto_clip')"
                @click="openAutoClip"
              >
                <Sparkles class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{
              $t("match.replay.auto_clip_preset")
            }}</TooltipContent>
          </Tooltip>

          <Tooltip v-if="canCreateClip">
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer"
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
                editor.active.value
                  ? $t("match.replay.hide_clip_editor")
                  : $t("match.replay.open_clip_editor")
              }}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer"
                :title="$t('replay_extras.toggle_cs2_hud')"
                @click="toggleDemoUI"
              >
                <PanelBottom class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{
              $t("replay_extras.toggle_cs2_hud")
            }}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer"
                :title="$t('ui.reload_demo')"
                @click="reloadDemo"
              >
                <RotateCcw class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              {{ $t("match.demo_playback.reload_demo") }} <Kbd>R</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer"
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
                class="h-9 w-9 cursor-pointer"
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
              {{
                store.xrayEnabled
                  ? $t("match.demo_playback.xray_on")
                  : $t("match.demo_playback.xray_off")
              }}
              <Kbd>X</Kbd>
            </TooltipContent>
          </Tooltip>

          <!-- Scoreboard: press-and-hold for momentary +showscores. -->
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer select-none active:border-amber-400/60 active:text-amber-300"
                @mousedown.prevent="startScoreboardHold"
              >
                <Trophy class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{
              $t("match.replay.hold_scoreboard")
            }}</TooltipContent>
          </Tooltip>

          <!-- Hot-swap only: a pod restart reverts to the api's default HUD. -->
          <Tooltip>
            <TooltipTrigger as-child>
              <div
                class="inline-flex rounded-md border border-border/60 bg-card/40 p-0.5"
              >
                <button
                  v-for="hud in broadcastHuds"
                  :key="hud.slug"
                  type="button"
                  class="px-2 h-8 font-mono text-[0.6rem] uppercase tracking-[0.18em] rounded-sm cursor-pointer transition-colors whitespace-nowrap"
                  :class="
                    store.hudVisible && store.hudSlug === hud.slug
                      ? 'bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  :title="hud.description || broadcastHudLabel(hud)"
                  @click="setHud(hud.slug)"
                >
                  {{ broadcastHudLabel(hud) }}
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
              {{ $t("match.demo_playback.hud_layout") }} <Kbd>H</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 cursor-pointer"
                @click="toggleHudSides"
              >
                <ArrowLeftRight class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{
              $t("match.replay.swap_sides")
            }}</TooltipContent>
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
.reload-prompt-enter-active,
.reload-prompt-leave-active {
  transition: opacity 150ms ease;
}
.reload-prompt-enter-from,
.reload-prompt-leave-to {
  opacity: 0;
}
</style>
