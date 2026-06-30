<script setup lang="ts">
// Shared replay chrome — copied verbatim from Replay3D.vue's bp-* UI so the
// ONE player looks identical in 2D and 3D. Purely presentational: it renders
// HUD / kill feed / play-by-play / scoreboard / transport over whatever map
// the host (ReplayViewer) shows underneath. All data + actions come via props.
import { Skull } from "lucide-vue-next";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { weaponIconPath } from "~/utilities/weaponIcon";
import Kbd from "~/components/ui/kbd/Kbd.vue";
import KbdGroup from "~/components/ui/kbd/KbdGroup.vue";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";

type Row = {
  sid: string;
  idx: number;
  name: string;
  side: number; // 0 = CT, 1 = T
  alive: boolean;
  hp: number;
  armor: number;
  helmet: boolean;
  k: number;
  d: number;
  a: number;
  dmg: number;
  weapon: string | null;
  nades: string[];
  bomb: boolean;
  kit: boolean;
  avatarUrl: string | null;
  blinded?: number; // 0..1 flash blind strength at the cursor
};
type PbpEvent = {
  time: string;
  killer?: string;
  victim?: string;
  weapon?: string;
  hs?: boolean;
  kc?: string;
  vc?: string;
  bomb?: string;
  util?: string | null;
  gi?: number;
  thrower?: string;
  tc?: string;
};

const props = defineProps<{
  hud: {
    ct: number;
    t: number;
    round: number;
    clock: string;
    bomb: string;
    bombClass: string;
  };
  teamA: Row[];
  teamB: Row[];
  sideA: number;
  aliveA: number;
  aliveB: number;
  feed: Array<{
    k: string;
    v: string;
    weapon: string;
    hs: boolean;
    kc: string;
    vc: string;
  }>;
  pbp: PbpEvent[];
  roundSummary?: string;
  rounds: Array<{ i: number; n: number; win: number }>;
  activeRoundUI: number;
  utilMarkers: Array<{ frac: number; icon: string; gi?: number }>;
  tickMarkers: Array<{ frac: number; cls: string }>;
  typeFilter: Record<string, boolean>;
  selectedGi: number[];
  playing: boolean;
  speed: number;
  seekFrac: number;
  timeLabel?: string;
  // 2D/3D map toggle (the only difference between the two views)
  view?: "2d" | "3d";
  onView?: (v: "2d" | "3d") => void;
  // buy-round overlay active — hides round-relative seek markers (they don't
  // map onto the shared window clock).
  overlay?: boolean;
  // 3D-only controls (camera dock); hidden in 2D
  show3d?: boolean;
  camMode?: string;
  showPbp?: boolean;
  heatOn?: boolean;
  // ceiling cut (3D): 0..100, 100 = full map / no cut
  ceiling?: number;
  onCeiling?: (v: number) => void;
  followName?: string | null;
  ctHex?: string;
  tHex?: string;
  // buy-round overlay: round tabs double as the multi-select; selected = full
  // opacity, others dimmed.
  overlayRounds?: number[];
  overlayWindow?: number;
  onOverlayWindow?: (n: number) => void;
  overlayTeam?: "all" | "1" | "2";
  onOverlayTeam?: (t: "all" | "1" | "2") => void;
  team1Name?: string;
  team2Name?: string;
  // scoreboard-side toggles
  showAvatars?: boolean;
  traceOn?: boolean;
  showDeaths?: boolean;
  // mobile: compact the floating panels for phone-sized touch screens
  mobile?: boolean;
  // scoreboard visibility — collapsible so there's room to move around the map
  showScoreboard?: boolean;
  onToggleScoreboard?: () => void;
  // fullscreen — escape the mobile browser address bar
  isFullscreen?: boolean;
  onFullscreen?: () => void;
  // callbacks
  onPlay: () => void;
  onSeek: (frac: number) => void;
  onSpeed: (s: number) => void;
  onSelectRound: (i: number) => void;
  onFollowRow: (sid: string) => void;
  onToggleType: (ty: string) => void;
  onTogglePbp?: () => void;
  onToggleHeat?: () => void;
  onMode?: (m: string) => void;
  onPbpUtil?: (gi: number) => void;
  onClearSel?: () => void;
  onToggleOverlay?: () => void;
  onToggleOverlayRound?: (rn: number) => void;
  onToggleAvatars?: () => void;
  onToggleTrace?: () => void;
  onToggleDeaths?: () => void;
}>();

const UTIL_TYPES = ["Smoke", "Molotov", "HE", "Flash", "Decoy"] as const;
const UTIL_ICON: Record<string, string> = {
  flash: "/img/equipment/flashbang.svg",
  smoke: "/img/equipment/smokegrenade.svg",
  he: "/img/equipment/hegrenade.svg",
  molotov: "/img/equipment/molotov.svg",
  decoy: "/img/equipment/decoy.svg",
};
const UTIL_LEGEND: Record<string, string> = {
  Smoke: "#32d6e0",
  Molotov: "#ff6a1a",
  HE: "#ff3b3b",
  Flash: "#ffd21a",
  Decoy: "#66dd55",
};
const sideHex = (s: number) =>
  s === 0 ? props.ctHex || "#57cdff" : props.tHex || "#ffb049";
const utilIcon = (ty: string) => UTIL_ICON[ty.toLowerCase()] || "";
const legendCol = (ty: string) => UTIL_LEGEND[ty] || "#9fb0c0";
const selIncludes = (gi: number | undefined) =>
  gi != null && props.selectedGi.includes(gi);
// Stable per-event key so the TransitionGroup only animates genuinely new rows.
// IMPORTANT: no array index — kills must keep the same key as the list grows,
// or they re-animate on every new event (utility was stable via its gid).
const pbpKey = (e: PbpEvent) =>
  e.util != null
    ? `u${e.gi}`
    : e.bomb
      ? `b${e.time}-${e.bomb}`
      : `k${e.time}-${e.killer}-${e.victim}-${e.weapon}`;
const SPEEDS = [0.5, 1, 2, 4, 8];

// Cluster utility throws that land at (nearly) the same point on the timeline
// so several thrown on the same second can each be fanned out + clicked.
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";

// Measure the live transport-bar height (round selector + seek + safe-area) so
// the floating scoreboard can cap its height to JUST above it and scroll the
// rest, instead of running underneath it.
const barEl = ref<HTMLElement | null>(null);
const barHeight = ref(64);
let barRO: ResizeObserver | null = null;
onMounted(() => {
  if (!barEl.value || typeof ResizeObserver === "undefined") return;
  barRO = new ResizeObserver(() => {
    barHeight.value = barEl.value?.offsetHeight ?? 0;
  });
  barRO.observe(barEl.value);
  barHeight.value = barEl.value.offsetHeight;
});
onBeforeUnmount(() => barRO?.disconnect());

// Smoothly grow/shrink the HUD when the bomb plants (round clock -> C4 row is a
// little wider). Auto width can't be transitioned, so FLIP it: freeze the old
// width, then animate to the new one. Keyed off the planted *boolean* so the
// per-second countdown digits don't re-trigger it.
const hudEl = ref<HTMLElement | null>(null);
watch(
  () => !!props.hud?.bomb,
  () => {
    const el = hudEl.value;
    if (!el) return;
    const startW = el.offsetWidth;
    void nextTick(() => {
      const endW = el.offsetWidth;
      if (startW === endW) return;
      el.style.transition = "none";
      el.style.width = `${startW}px`;
      void el.offsetWidth; // reflow
      el.style.transition = "width 0.22s ease";
      el.style.width = `${endW}px`;
      const done = (e: TransitionEvent) => {
        if (e.propertyName !== "width") return;
        el.style.width = "";
        el.style.transition = "";
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
    });
  },
);

const scorePanelStyle = computed(() => {
  const top = props.mobile ? 8 : 14;
  return { maxHeight: `calc(100% - ${top + barHeight.value + 12}px)` };
});

// Custom pointer scrubber for the seek bar. Native <input type=range> on iOS
// only drags from the (4px) thumb and otherwise lets the touch scroll the page,
// so we drive seeking ourselves from pointer position on the whole track.
const seekWrapEl = ref<HTMLElement | null>(null);
let scrubbing = false;
function seekFromEvent(e: PointerEvent) {
  const rect = seekWrapEl.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return;
  props.onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
}
let resumeAfterScrub = false;
function onScrubDown(e: PointerEvent) {
  // Let taps on the stacked utility icons through to their own click handler.
  if ((e.target as Element)?.closest?.(".mk-util-icon")) return;
  scrubbing = true;
  // Pause while scrubbing so the playhead doesn't fight the drag, then resume
  // on release if it was playing — feels natural on touch and desktop alike.
  resumeAfterScrub = !!props.playing;
  if (props.playing) props.onPlay();
  seekFromEvent(e);
  window.addEventListener("pointermove", onScrubMove);
  window.addEventListener("pointerup", onScrubUp);
  window.addEventListener("pointercancel", onScrubUp);
}
function onScrubMove(e: PointerEvent) {
  if (scrubbing) seekFromEvent(e);
}
function onScrubUp() {
  scrubbing = false;
  window.removeEventListener("pointermove", onScrubMove);
  window.removeEventListener("pointerup", onScrubUp);
  window.removeEventListener("pointercancel", onScrubUp);
  if (resumeAfterScrub && !props.playing) props.onPlay();
  resumeAfterScrub = false;
}

// Same deal for the 3D ROOF slider in the mobile overflow menu — drive it from
// pointer position so it can be dragged on touch, not just tapped.
let ceilScrubbing = false;
let ceilScrubEl: HTMLElement | null = null;
function ceilFromEvent(e: PointerEvent) {
  const rect = ceilScrubEl?.getBoundingClientRect();
  if (!rect || rect.width === 0) return;
  const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  props.onCeiling?.(Math.round(frac * 100));
}
function onCeilScrubDown(e: PointerEvent) {
  ceilScrubEl = e.currentTarget as HTMLElement;
  ceilScrubbing = true;
  ceilFromEvent(e);
  window.addEventListener("pointermove", onCeilScrubMove);
  window.addEventListener("pointerup", onCeilScrubUp);
  window.addEventListener("pointercancel", onCeilScrubUp);
}
function onCeilScrubMove(e: PointerEvent) {
  if (ceilScrubbing) ceilFromEvent(e);
}
function onCeilScrubUp() {
  ceilScrubbing = false;
  ceilScrubEl = null;
  window.removeEventListener("pointermove", onCeilScrubMove);
  window.removeEventListener("pointerup", onCeilScrubUp);
  window.removeEventListener("pointercancel", onCeilScrubUp);
}
const utilClusters = computed(() => {
  // Respect the util-type filter so toggling a type also drops its nade icons
  // from the seek bar (2D + 3D), not just the map.
  const sorted = [...(props.utilMarkers || [])]
    .filter((m) => props.typeFilter?.[(m as any).type] !== false)
    .sort((a, b) => a.frac - b.frac);
  const groups: Array<{ frac: number; items: typeof sorted }> = [];
  const TH = 0.012; // ~1.2% of the track width counts as "same time"
  for (const m of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(m.frac - last.frac) <= TH) last.items.push(m);
    else groups.push({ frac: m.frac, items: [m] });
  }
  return groups;
});
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <div class="bp-chrome" :class="{ 'is-mobile': mobile }">
      <!-- HUD -->
      <div ref="hudEl" class="bp-hud">
        <span class="bp-score"
          ><span class="ct"><AnimatedStat :value="hud.ct" /></span
          ><span class="sep">:</span
          ><span class="t"><AnimatedStat :value="hud.t" /></span></span
        >
        <span class="bp-mid"
          ><b>RD&nbsp;<AnimatedStat :value="hud.round" /></b
          ><span class="bp-dot">·</span
          ><span
            v-if="hud.bomb"
            class="bp-clock bp-clock--bomb"
            :class="hud.bombClass"
            ><img src="/img/equipment/c4.svg" class="bp-c4" alt="C4" /><AnimatedStat
              :value="hud.bomb"
            /></span
          ><span v-else class="bp-clock"
            ><AnimatedStat :value="hud.clock"
          /></span></span
        >
      </div>

      <!-- left column: controls row (2D/3D | cam dock) + play-by-play -->
      <div class="bp-left">
        <div class="bp-controls">
          <div class="bp-viewtoggle">
            <Tooltip
              ><TooltipTrigger as-child
                ><button
                  :class="{ on: view === '2d' }"
                  @click="onView && onView('2d')"
                >
                  2D
                </button></TooltipTrigger
              ><TooltipContent>{{
                $t("match.replay.chrome.view_2d")
              }}</TooltipContent></Tooltip
            >
            <Tooltip
              ><TooltipTrigger as-child
                ><button
                  :class="{ on: view === '3d' }"
                  @click="onView && onView('3d')"
                >
                  3D
                </button></TooltipTrigger
              ><TooltipContent>{{
                $t("match.replay.chrome.view_3d")
              }}</TooltipContent></Tooltip
            >
          </div>
          <span class="bp-pipe">|</span>
          <div class="bp-cam">
            <template v-if="show3d && !mobile">
              <Tooltip
                ><TooltipTrigger as-child
                  ><button
                    :class="{ on: camMode === 'orbit' }"
                    @click="onMode && onMode('orbit')"
                  >
                    {{ $t("match.replay.chrome.cam_orbit") }}
                  </button></TooltipTrigger
                ><TooltipContent>{{
                  $t("match.replay.chrome.cam_orbit_tip")
                }}</TooltipContent></Tooltip
              >
              <Tooltip
                ><TooltipTrigger as-child
                  ><button
                    :class="{ on: camMode === 'top' }"
                    @click="onMode && onMode('top')"
                  >
                    {{ $t("match.replay.chrome.cam_top") }}
                  </button></TooltipTrigger
                ><TooltipContent>{{
                  $t("match.replay.chrome.cam_top_tip")
                }}</TooltipContent></Tooltip
              >
              <Tooltip v-if="followName"
                ><TooltipTrigger as-child
                  ><button
                    :class="{ on: camMode === 'follow' }"
                    @click="onMode && onMode('follow')"
                  >
                    {{ $t("match.replay.chrome.cam_chase") }}
                  </button></TooltipTrigger
                ><TooltipContent>{{
                  $t("match.replay.chrome.cam_chase_tip")
                }}</TooltipContent></Tooltip
              >
              <Tooltip
                ><TooltipTrigger as-child>
                  <label class="bp-ceil" :class="{ on: (ceiling ?? 50) < 100 }">
                    <span>{{ $t("match.replay.chrome.roof") }}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      :value="ceiling ?? 50"
                      @input="
                        onCeiling &&
                        onCeiling(
                          Number(($event.target as HTMLInputElement).value),
                        )
                      "
                    />
                  </label> </TooltipTrigger
                ><TooltipContent>{{
                  $t("match.replay.chrome.roof_tip")
                }}</TooltipContent></Tooltip
              >
            </template>
            <!-- PLAYS + HEAT work in both 2D and 3D. On mobile they collapse
                 into a 3-dot overflow menu (below) so the row stays narrow. -->
            <Tooltip v-if="!mobile"
              ><TooltipTrigger as-child
                ><button
                  :class="{ on: showPbp }"
                  @click="onTogglePbp && onTogglePbp()"
                >
                  {{ $t("match.replay.chrome.play_by_play") }}
                </button></TooltipTrigger
              ><TooltipContent>{{
                $t("match.replay.chrome.play_by_play_tip")
              }}</TooltipContent></Tooltip
            >
            <Tooltip v-if="!mobile && !overlay"
              ><TooltipTrigger as-child
                ><button
                  :class="{ on: heatOn }"
                  @click="onToggleHeat && onToggleHeat()"
                >
                  {{ $t("match.replay.chrome.utility_heatmap") }}
                </button></TooltipTrigger
              ><TooltipContent>{{
                $t("match.replay.chrome.utility_heatmap_tip")
              }}</TooltipContent></Tooltip
            >

            <!-- Mobile overflow menu — shadcn DropdownMenu handles open/close,
                 tap-trigger-to-close, outside-click, escape, focus + the
                 open/close animation for us. Toggle items use checkbox items
                 (checkmark = active) and @select.prevent so the menu stays open
                 while you flip things. -->
            <DropdownMenu v-if="mobile">
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  class="bp-more"
                  :aria-label="$t('match.replay.chrome.more')"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="currentColor"
                  >
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" :side-offset="6" class="bp-dd">
                <template v-if="show3d">
                  <DropdownMenuItem
                    class="bp-dd-item"
                    :class="{ 'bp-dd-on': camMode === 'orbit' }"
                    @select.prevent="onMode && onMode('orbit')"
                  >
                    {{ $t("match.replay.chrome.cam_orbit") }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="bp-dd-item"
                    :class="{ 'bp-dd-on': camMode === 'top' }"
                    @select.prevent="onMode && onMode('top')"
                  >
                    {{ $t("match.replay.chrome.cam_top") }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="followName"
                    class="bp-dd-item"
                    :class="{ 'bp-dd-on': camMode === 'follow' }"
                    @select.prevent="onMode && onMode('follow')"
                  >
                    {{ $t("match.replay.chrome.cam_chase") }}
                  </DropdownMenuItem>
                  <!-- ROOF slider: let the slider own pointer + keys instead of
                       the menu's navigation/close. -->
                  <div
                    class="bp-dd-item bp-dd-roof"
                    :class="{ 'bp-dd-on': (ceiling ?? 50) < 100 }"
                    @pointerdown.stop
                    @keydown.stop
                  >
                    <span>{{ $t("match.replay.chrome.roof") }}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      :value="ceiling ?? 50"
                      @pointerdown="onCeilScrubDown"
                      @input="
                        onCeiling &&
                        onCeiling(
                          Number(($event.target as HTMLInputElement).value),
                        )
                      "
                    />
                  </div>
                </template>
                <DropdownMenuItem
                  class="bp-dd-item"
                  :class="{ 'bp-dd-on': showPbp }"
                  @select.prevent="onTogglePbp && onTogglePbp()"
                >
                  {{ $t("match.replay.chrome.play_by_play") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="!overlay"
                  class="bp-dd-item"
                  :class="{ 'bp-dd-on': heatOn }"
                  @select.prevent="onToggleHeat && onToggleHeat()"
                >
                  {{ $t("match.replay.chrome.utility_heatmap") }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div v-if="showPbp !== false" class="bp-pbp">
          <div class="bp-pbp-h">
            <span>{{
              $t("match.replay.chrome.pbp_header", { round: hud.round })
            }}</span>
            <button
              v-if="selectedGi.length"
              class="pbp-clear"
              @click="onClearSel && onClearSel()"
            >
              {{
                $t("match.replay.chrome.clear_count", {
                  count: selectedGi.length,
                })
              }}
            </button>
          </div>
          <div v-if="roundSummary" class="bp-pbp-sum">{{ roundSummary }}</div>
          <div v-if="!pbp.length" class="bp-pbp-empty">
            {{ $t("match.replay.chrome.no_events") }}
          </div>
          <TransitionGroup name="pbp" tag="div" class="bp-pbp-list">
            <div
              v-for="e in pbp"
              :key="pbpKey(e)"
              class="bp-pbp-row"
              :class="{ util: e.util != null, hl: selIncludes(e.gi) }"
              @click="
                e.util != null && onPbpUtil && e.gi != null && onPbpUtil(e.gi)
              "
            >
              <span class="tt">{{ e.time }}</span>
              <template v-if="e.bomb"
                ><span class="bomb">💣 {{ e.bomb }}</span></template
              >
              <template v-else-if="e.util != null">
                <img :src="utilIcon(e.util)" class="wi util-i" />
                <span class="nm" :style="{ color: e.tc }">{{ e.thrower }}</span>
                <span class="utl">{{ e.util }}</span>
                <span class="pin" v-if="selIncludes(e.gi)">●</span>
              </template>
              <template v-else>
                <span class="nm" :style="{ color: e.kc }">{{ e.killer }}</span>
                <img
                  v-if="weaponIconPath(e.weapon)"
                  :src="weaponIconPath(e.weapon)!"
                  class="wi"
                />
                <span v-if="e.hs" class="hs">⊕</span>
                <span class="nm" :style="{ color: e.vc }">{{ e.victim }}</span>
              </template>
            </div>
          </TransitionGroup>
        </div>
      </div>

      <!-- scoreboard -->
      <Transition name="bp-score">
        <div
          v-show="showScoreboard !== false"
          class="bp-score-panel"
          :style="scorePanelStyle"
        >
        <div
          class="bp-team"
          v-for="(team, ti) in [
            { rows: teamA, side: sideA, score: hud.ct, alive: aliveA },
            { rows: teamB, side: 1 - sideA, score: hud.t, alive: aliveB },
          ]"
          :key="ti"
        >
          <div class="bp-team-h">
            <span class="th-side" :style="{ color: sideHex(team.side) }">{{
              team.side === 0 ? "CT" : "T"
            }}</span>
            <span class="th-alive">{{
              $t("match.replay.chrome.alive_count", { count: team.alive })
            }}</span>
            <span class="th-score" :style="{ color: sideHex(team.side) }"
              ><AnimatedStat :value="team.score"
            /></span>
          </div>
          <div
            v-for="r in team.rows"
            :key="r.idx"
            class="bp-prow"
            :class="{ dead: !r.alive, foll: followName === r.name }"
            @click="onFollowRow(r.sid)"
          >
            <!-- flash-blind indicator (eye), parked to the LEFT of the whole row -->
            <svg
              v-if="(r.blinded || 0) > 0.12"
              class="prow-flash"
              :style="{ opacity: 0.45 + (r.blinded || 0) * 0.55 }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span
              class="accent-bar"
              :style="{ background: sideHex(r.side) }"
            ></span>
            <div class="prow-top">
              <img
                v-if="showAvatars !== false && r.avatarUrl"
                :src="r.avatarUrl"
                class="av"
              />
              <svg
                v-if="followName === r.name"
                class="eye"
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                :title="$t('match.replay.chrome.following_on_map')"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span class="nm" :class="{ alive: r.alive }">{{ r.name }}</span>
              <span class="kda"
                ><AnimatedStat :value="r.k" />/<AnimatedStat :value="r.d" />/<AnimatedStat
                  :value="r.a"
              /></span>
              <span class="dmg"><AnimatedStat :value="r.dmg" /></span>
            </div>
            <div class="prow-bars">
              <div class="hpw">
                <div
                  class="hpb"
                  :style="{
                    width: Math.max(0, r.hp) + '%',
                    background:
                      r.hp > 50 ? '#46d36a' : r.hp > 20 ? '#e6c344' : '#e0503e',
                  }"
                ></div>
              </div>
              <div class="armw">
                <div
                  class="armb"
                  :style="{
                    width: Math.max(0, Math.min(100, r.armor)) + '%',
                    background: r.helmet ? '#7cd4ff' : '#4a90d6',
                  }"
                ></div>
              </div>
            </div>
            <div class="prow-gear">
              <img
                :src="
                  r.armor > 0 && r.helmet
                    ? '/img/equipment/armor_helmet.svg'
                    : '/img/equipment/kevlar.svg'
                "
                class="eq shield"
                :class="{ off: r.armor <= 0 }"
              />
              <!-- weapon swaps fade/scale in when the player changes guns -->
              <Transition name="wpn" mode="out-in">
                <img
                  v-if="weaponIconPath(r.weapon)"
                  :key="r.weapon"
                  :src="weaponIconPath(r.weapon)!"
                  class="eq gun"
                />
                <span
                  v-else-if="r.weapon"
                  :key="r.weapon + '-x'"
                  class="gun-x"
                  >{{ r.weapon }}</span
                >
              </Transition>
              <span class="util">
                <img
                  v-for="(u, ui) in r.nades"
                  :key="ui"
                  :src="UTIL_ICON[u.toLowerCase()]"
                  class="eq nade"
                  :title="u"
                />
              </span>
              <span class="badges">
                <img
                  v-if="r.kit"
                  src="/img/equipment/defuser.svg"
                  class="eq kit"
                  :title="$t('match.replay.defuse_kit')"
                />
                <img
                  v-if="r.bomb"
                  src="/img/equipment/c4.svg"
                  class="eq c4"
                  :title="$t('match.replay.chrome.bomb_carrier')"
                />
              </span>
            </div>
          </div>
        </div>
        </div>
      </Transition>

      <!-- scoreboard-side toggles (left of the CT scoreboard). The
           show/hide-scoreboard button stays mounted even when the board is
           collapsed so it can always be reopened; the rest hide with it. -->
      <div
        class="bp-sb-tools"
        :class="{ 'sb-collapsed': showScoreboard === false }"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              class="sbt sbt-icon"
              :class="{ on: showScoreboard !== false }"
              @click="onToggleScoreboard && onToggleScoreboard()"
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent>{{
            showScoreboard !== false
              ? $t("match.replay.hide_scoreboard")
              : $t("match.replay.show_scoreboard")
          }}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              class="sbt sbt-icon"
              :class="{ on: showAvatars }"
              @click="onToggleAvatars && onToggleAvatars()"
            >
              <svg
                v-if="showAvatars"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              <span v-else style="font-weight: 700">#</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{{
            showAvatars
              ? $t("match.replay.chrome.showing_avatars")
              : $t("match.replay.chrome.showing_numbers")
          }}</TooltipContent>
        </Tooltip>
        <Tooltip v-if="view === '2d'">
          <TooltipTrigger as-child>
            <button
              class="sbt"
              :class="{ on: traceOn }"
              @click="onToggleTrace && onToggleTrace()"
            >
              TRACE
            </button>
          </TooltipTrigger>
          <TooltipContent>{{
            $t("match.replay.chrome.trace_tip")
          }}</TooltipContent>
        </Tooltip>
        <Tooltip v-if="view === '2d'">
          <TooltipTrigger as-child>
            <button
              class="sbt sbt-icon"
              :class="{ on: showDeaths }"
              @click="onToggleDeaths && onToggleDeaths()"
            >
              <Skull :size="15" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{{
            $t("match.replay.chrome.deaths_tip")
          }}</TooltipContent>
        </Tooltip>
      </div>

      <!-- transport -->
      <div ref="barEl" class="bp-bar">
        <div class="bp-toprow">
          <!-- util-summary toggle is pinned on the left; only the round
               numbers scroll past it -->
          <Tooltip>
              <TooltipTrigger as-child>
                <button
                  class="rt buyt"
                  :class="{ on: overlay }"
                  @click="onToggleOverlay && onToggleOverlay()"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                  <span>{{ $t("match.replay.chrome.util_summary") }}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{{
                $t("match.replay.chrome.util_summary_tip")
              }}</TooltipContent>
          </Tooltip>
          <div class="bp-rounds">
            <Tooltip v-for="r in rounds" :key="r.i">
              <TooltipTrigger as-child>
                <button
                  class="rt"
                  :class="[
                    overlay
                      ? {
                          selsel: (overlayRounds || []).includes(r.n),
                          seldim: !(overlayRounds || []).includes(r.n),
                        }
                      : { on: activeRoundUI === r.i },
                    r.win === 0 ? 'win-ct' : r.win === 1 ? 'win-t' : '',
                  ]"
                  @click="
                    overlay
                      ? onToggleOverlayRound && onToggleOverlayRound(r.n)
                      : onSelectRound(r.i)
                  "
                >
                  {{ r.n }}
                </button>
              </TooltipTrigger>
              <TooltipContent>{{
                overlay
                  ? (overlayRounds || []).includes(r.n)
                    ? $t("match.replay.chrome.round_remove", { n: r.n })
                    : $t("match.replay.chrome.round_add", { n: r.n })
                  : $t("match.replay.chrome.round_jump", { n: r.n })
              }}</TooltipContent>
            </Tooltip>
          </div>
          <div class="bp-filters">
            <!-- highlighted-utility clear sits on the LEFT of the filter group, which
               is right-anchored — so it grows leftward and never shifts the UTIL
               icons (or the seek bar) when it appears/disappears. -->
            <Tooltip v-if="selectedGi.length">
              <TooltipTrigger as-child>
                <button class="hl-clear" @click="onClearSel && onClearSel()">
                  ✕ {{ selectedGi.length }}
                </button>
              </TooltipTrigger>
              <TooltipContent>{{
                $t("match.replay.chrome.clear_highlighted_util")
              }}</TooltipContent>
            </Tooltip>
            <span class="flbl">UTIL</span>
            <Tooltip v-for="ty in UTIL_TYPES" :key="ty">
              <TooltipTrigger as-child>
                <button
                  class="fbtn"
                  :class="{ off: !typeFilter[ty] }"
                  :style="
                    typeFilter[ty]
                      ? {
                          borderColor: legendCol(ty),
                          background: legendCol(ty) + '22',
                        }
                      : {}
                  "
                  @click="onToggleType(ty)"
                >
                  <span
                    class="fdot"
                    :style="{ background: legendCol(ty) }"
                  ></span
                  ><img :src="utilIcon(ty)" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{{
                typeFilter[ty]
                  ? $t("match.replay.chrome.hide_util", { type: ty })
                  : $t("match.replay.chrome.show_util", { type: ty })
              }}</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div class="bp-transport">
          <Tooltip>
            <TooltipTrigger as-child>
              <button class="play" @click="onPlay">
                <svg
                  v-if="playing"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                >
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                >
                  <path d="M7 5v14l12-7z" />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent
              >{{
                playing
                  ? $t("match.replay.chrome.pause")
                  : $t("match.replay.chrome.play")
              }}
              (Space)</TooltipContent
            >
          </Tooltip>
          <!-- buy-overlay window length, next to the play button -->
          <div v-if="overlay" class="bp-buywin">
            <div class="bw-row">
              <span class="lbl">{{ $t("match.replay.chrome.window") }}</span>
              <input
                type="range"
                min="10"
                max="115"
                step="5"
                :value="overlayWindow"
                @input="
                  (e: any) =>
                    onOverlayWindow && onOverlayWindow(+e.target.value)
                "
              />
              <span class="val">{{ overlayWindow }}s</span>
            </div>
            <div class="bw-row bw-team">
              <span class="lbl">{{ $t("match.replay.chrome.team") }}</span>
              <button
                :class="{ on: (overlayTeam || 'all') === 'all' }"
                @click="onOverlayTeam && onOverlayTeam('all')"
              >
                {{ $t("match.replay.chrome.all") }}
              </button>
              <button
                class="tname"
                :class="{ on: overlayTeam === '1' }"
                :title="team1Name || $t('match.replay.chrome.team_1')"
                @click="onOverlayTeam && onOverlayTeam('1')"
              >
                {{ team1Name || $t("match.replay.chrome.team_1") }}
              </button>
              <button
                class="tname"
                :class="{ on: overlayTeam === '2' }"
                :title="team2Name || $t('match.replay.chrome.team_2')"
                @click="onOverlayTeam && onOverlayTeam('2')"
              >
                {{ team2Name || $t("match.replay.chrome.team_2") }}
              </button>
            </div>
          </div>
          <div
            ref="seekWrapEl"
            class="seek-wrap"
            @pointerdown="onScrubDown"
          >
            <!-- utility lane: same-second throws STACK vertically up the tall bar
               so each is individually clickable. -->
            <div v-if="!overlay" class="util-lane">
              <div
                v-for="(g, gi2) in utilClusters"
                :key="'g' + gi2"
                class="util-cluster"
                :style="{ left: g.frac * 100 + '%' }"
              >
                <Tooltip v-for="(m, mi) in g.items" :key="'u' + mi">
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="mk-util-icon"
                      :class="{ hl: selIncludes(m.gi) }"
                      :style="{ bottom: mi * 21 + 'px' }"
                      @click.stop="m.gi != null && onPbpUtil && onPbpUtil(m.gi)"
                    >
                      <img :src="m.icon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    >{{
                      $t("match.replay.chrome.util_thrown_by", {
                        type:
                          (m as any).type || $t("match.replay.chrome.utility"),
                        name: (m as any).name || "?",
                      })
                    }}{{
                      selIncludes(m.gi)
                        ? $t("match.replay.chrome.click_to_clear")
                        : $t("match.replay.chrome.click_to_highlight")
                    }}</TooltipContent
                  >
                </Tooltip>
              </div>
            </div>
            <div class="seek-rail">
              <div
                class="seek-fill"
                :style="{ width: seekFrac * 100 + '%' }"
              ></div>
            </div>
            <input
              class="seek"
              type="range"
              min="0"
              max="1000"
              :value="Math.round(seekFrac * 1000)"
              @input="(e: any) => onSeek(+e.target.value / 1000)"
            />
            <span
              v-for="(m, i) in tickMarkers"
              v-show="!overlay"
              :key="'k' + i"
              class="mk"
              :class="m.cls"
              :style="{ left: m.frac * 100 + '%' }"
            ></span>
          </div>
          <span v-if="timeLabel" class="tl"
            ><AnimatedStat :value="timeLabel"
          /></span>
          <Tooltip v-if="onFullscreen && !mobile">
            <TooltipTrigger as-child>
              <button class="fs" @click="onFullscreen && onFullscreen()">
                <svg
                  v-if="isFullscreen"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3" />
                  <path d="M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent>{{
              isFullscreen
                ? $t("match.replay.chrome.exit_fullscreen")
                : $t("match.replay.chrome.enter_fullscreen")
            }}</TooltipContent>
          </Tooltip>
          <select class="spd" @change="(e: any) => onSpeed(+e.target.value)">
            <option
              v-for="s in SPEEDS"
              :key="s"
              :value="s"
              :selected="s === speed"
            >
              {{ s }}×
            </option>
          </select>
          <!-- keyboard shortcuts help -->
          <div v-if="!mobile" class="bp-help" tabindex="0">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path
                d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"
              />
            </svg>
            <div class="bp-help-pop">
              <div class="hk">
                <KbdGroup><Kbd>Space</Kbd></KbdGroup
                ><span>{{ $t("match.replay.chrome.kb_play_pause") }}</span>
              </div>
              <div class="hk">
                <KbdGroup><Kbd>←</Kbd><Kbd>→</Kbd></KbdGroup
                ><span>{{ $t("match.replay.chrome.kb_step_frame") }}</span>
              </div>
              <div class="hk">
                <KbdGroup><Kbd>[</Kbd><Kbd>]</Kbd></KbdGroup
                ><span>{{ $t("match.replay.chrome.kb_prev_next_round") }}</span>
              </div>
              <div class="hk">
                <KbdGroup><Kbd>1</Kbd><Kbd>–</Kbd><Kbd>5</Kbd></KbdGroup
                ><span>{{ $t("match.replay.chrome.kb_speed") }}</span>
              </div>
              <template v-if="show3d">
                <div class="hk hk-sep">
                  {{ $t("match.replay.chrome.kb_3d_camera") }}
                </div>
                <div class="hk">
                  <KbdGroup><Kbd>L-drag</Kbd></KbdGroup
                  ><span>{{ $t("match.replay.chrome.kb_look") }}</span>
                </div>
                <div class="hk">
                  <KbdGroup><Kbd>R-drag</Kbd></KbdGroup
                  ><span>{{ $t("match.replay.chrome.kb_orbit") }}</span>
                </div>
                <div class="hk">
                  <KbdGroup><Kbd>Scroll</Kbd></KbdGroup
                  ><span>{{ $t("match.replay.chrome.kb_zoom") }}</span>
                </div>
                <div class="hk">
                  <KbdGroup
                    ><Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd></KbdGroup
                  ><span>{{ $t("match.replay.chrome.kb_fly") }}</span>
                </div>
                <div class="hk">
                  <KbdGroup><Kbd>Shift</Kbd><Kbd>Ctrl</Kbd></KbdGroup
                  ><span>{{ $t("match.replay.chrome.kb_up_down") }}</span>
                </div>
                <div class="hk">
                  <KbdGroup><Kbd>Q</Kbd><Kbd>E</Kbd></KbdGroup
                  ><span>{{ $t("match.replay.chrome.kb_up_down") }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

<style scoped>
.bp-chrome {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: #d6e0ea;
  font-family: "Oxanium", system-ui, sans-serif;
  user-select: none;
  --accent: #57cdff;
  --ct: #57cdff;
  --t: #ffb049;
  --panel: rgba(12, 15, 20, 0.82);
  --line: rgba(120, 140, 165, 0.18);
}
.bp-chrome > * {
  pointer-events: auto;
}
.bp-chrome img {
  -webkit-user-drag: none;
}
/* HUD */
.bp-hud {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 18px 6px;
  backdrop-filter: blur(8px);
  /* clip content cleanly while the width FLIP-animates on bomb plant; nowrap so
     the rows never reflow to a second line mid-animation */
  overflow: hidden;
  white-space: nowrap;
}
.bp-score {
  font-size: 23px;
  font-weight: 700;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.bp-score .ct {
  color: var(--ct);
}
.bp-score .t {
  color: var(--t);
}
.bp-score .sep {
  color: #56606e;
  margin: 0 6px;
}
.bp-mid {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
}
.bp-mid b {
  font-size: 10px;
  letter-spacing: 2px;
  color: #8a98a8;
}
.bp-mid .bp-dot {
  color: #4a545f;
}
.bp-clock {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #e3edf6;
  /* fixed height so swapping the round clock for the taller C4 row doesn't
     change the HUD height (width is animated separately, see hud FLIP) */
  display: inline-flex;
  align-items: center;
  height: 15px;
}
.bp-clock.bomb {
  color: #ff6452;
  font-weight: 700;
}
.bp-clock--bomb {
  gap: 4px;
}
.bp-clock--bomb .bp-c4 {
  height: 13px;
  width: auto;
  /* tint the (monochrome) C4 svg to the same red as the countdown */
  filter: invert(40%) sepia(90%) saturate(2000%) hue-rotate(330deg);
}
.bp-clock.ct {
  color: var(--ct);
}
/* left column */
.bp-left {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 10;
  width: 264px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bp-feed {
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}
.bp-kf {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--panel);
  border-left: 2px solid var(--accent);
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 12px;
}
.bp-kf .nm {
  font-weight: 600;
}
.bp-kf .wi {
  height: 15px;
  filter: brightness(0) invert(1);
  opacity: 0.95;
}
.bp-kf .wn {
  color: #9fb6cc;
  font-size: 11px;
}
.bp-kf .hs {
  color: #ffd24d;
  font-weight: 700;
}
.bp-pbp {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 8px;
  max-height: 42vh;
  overflow-y: auto;
}
.bp-pbp-h {
  font-size: 10px;
  letter-spacing: 2px;
  color: #7f8fa0;
  margin-bottom: 5px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 24px;
}
.pbp-clear {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border: 1px solid var(--accent);
  color: var(--accent);
  font-family: inherit;
  font-size: 9px;
  letter-spacing: 1px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  text-transform: uppercase;
}
.bp-pbp-sum {
  font-size: 11px;
  color: #cfe0f2;
  margin-bottom: 7px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line);
}
.bp-pbp-empty {
  font-size: 11px;
  color: #56606e;
  font-style: italic;
}
.bp-pbp-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 8px;
  border-top: 1px solid var(--line);
}
.bp-pbp-row:first-of-type {
  border-top: 0;
}
/* premium feel: new play-by-play rows slide + fade in, others ease into place */
.pbp-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.pbp-leave-active {
  transition: opacity 0.18s ease;
  position: absolute;
}
.pbp-enter-from {
  opacity: 0;
  transform: translateX(-14px);
}
.pbp-leave-to {
  opacity: 0;
}
.pbp-move {
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.bp-pbp-row .tt {
  font-size: 10px;
  color: #6b7785;
  min-width: 26px;
  font-variant-numeric: tabular-nums;
}
.bp-pbp-row .nm {
  font-weight: 600;
}
.bp-pbp-row .wi {
  height: 14px;
  filter: brightness(0) invert(1);
  opacity: 0.95;
}
.bp-pbp-row .hs {
  color: #ffd24d;
}
.bp-pbp-row .bomb {
  color: #ff8a5a;
  font-size: 11px;
}
.bp-pbp-row.util {
  cursor: pointer;
}
.bp-pbp-row.util:hover {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
.bp-pbp-row.util.hl {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-radius: 4px;
}
.bp-pbp-row .util-i {
  width: 18px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  opacity: 0.95;
  filter: brightness(0) invert(1);
}
.bp-pbp-row .utl {
  font-size: 10px;
  color: #8a98a8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.bp-pbp-row .pin {
  color: var(--accent);
  margin-left: auto;
  font-size: 9px;
}
/* scoreboard */
.bp-score-panel {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 10;
  width: 256px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  /* Cap the height and scroll — the full two-team board is taller than a lot of
     screens. The max-height is set inline from the live transport-bar height so
     it stops just above the round selector / seek bar. */
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  overscroll-behavior: contain;
}
.bp-score-panel::-webkit-scrollbar {
  width: 6px;
}
.bp-score-panel::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 165, 0.35);
  border-radius: 3px;
}
/* scoreboard show/hide — slide in from the right + fade */
.bp-score-enter-active,
.bp-score-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.bp-score-enter-from,
.bp-score-leave-to {
  opacity: 0;
  transform: translateX(14px);
}
.bp-team {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 6px;
}
.bp-team-h {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  font-size: 11px;
  letter-spacing: 1px;
  padding: 2px 4px 6px;
  font-weight: 700;
}
.bp-team-h .th-alive {
  text-align: center;
  color: #6b7785;
  font-weight: 400;
  letter-spacing: 0;
  font-size: 10px;
}
.bp-team-h .th-score {
  font-size: 15px;
}
.bp-prow {
  position: relative;
  padding: 4px 6px 5px 9px;
  border-radius: 5px;
  cursor: pointer;
}
.bp-prow + .bp-prow {
  margin-top: 2px;
}
.bp-prow:hover {
  background: rgba(255, 255, 255, 0.05);
}
.bp-prow.foll {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.bp-prow.dead {
  opacity: 0.42;
}
.bp-prow .accent-bar {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2.5px;
  border-radius: 2px;
}
.bp-prow .prow-flash {
  position: absolute;
  left: -26px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #fff;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.9));
  pointer-events: none;
}
.prow-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.prow-top .av {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.prow-top .eye {
  color: var(--accent);
  flex-shrink: 0;
}
.bp-sb-tools .sbt-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.prow-top .nm {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #9fb0c0;
  font-size: 13px;
  flex: 1;
}
.prow-top .nm.alive {
  color: #f0f6fc;
}
.prow-top .kda {
  font-size: 11px;
  color: #7f8fa0;
  font-variant-numeric: tabular-nums;
}
.prow-top .dmg {
  font-size: 10px;
  color: #6b7785;
  font-variant-numeric: tabular-nums;
  min-width: 22px;
  text-align: right;
}
.prow-bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 3px;
}
.hpw {
  height: 5px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}
.hpb {
  height: 100%;
  border-radius: 2px;
  transition:
    width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
    background 0.28s ease;
}
.armw {
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}
.armb {
  height: 100%;
  border-radius: 2px;
  transition:
    width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
    background 0.28s ease;
}
.prow-gear {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
  min-height: 18px;
}
.eq {
  height: 17px;
  width: auto;
  filter: brightness(2.6);
  opacity: 1;
}
.eq.gun {
  height: 20px;
}
.eq.nade {
  height: 16px;
}
.eq.kit {
  filter: invert(58%) sepia(80%) saturate(700%) hue-rotate(150deg);
}
.eq.c4 {
  filter: invert(40%) sepia(90%) saturate(2000%) hue-rotate(330deg);
}
.gun-x {
  font-size: 10px;
  color: #8a98a8;
}
.wpn-enter-active,
.wpn-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.wpn-enter-from {
  opacity: 0;
  transform: translateX(6px) scale(0.85);
}
.wpn-leave-to {
  opacity: 0;
  transform: translateX(-6px) scale(0.85);
}
.eq.shield {
  height: 16px;
}
.eq.shield.off {
  opacity: 0.25;
}
.prow-gear .util {
  display: flex;
  gap: 3px;
  margin-left: auto;
}
.prow-gear .badges {
  display: flex;
  gap: 3px;
}
/* controls row: 2D/3D | cam dock — single line (overflows the 264px column) */
.bp-controls {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: nowrap;
  width: max-content;
  position: relative;
  z-index: 50;
}
/* Mobile overflow ("3-dot") menu for PLAYS + HEAT */
/* 3-dot trigger button (the dropdown panel itself is the shadcn DropdownMenu) */
.bp-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 7px;
  color: #9fb0c0;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  cursor: pointer;
  outline: none;
}
.bp-more:hover,
.bp-more:focus,
.bp-more[data-state="open"] {
  border-color: var(--accent);
  color: #f0f6fc;
}
.bp-pipe {
  color: var(--line);
  font-size: 15px;
}
.bp-controls .bp-cam {
  width: auto;
  gap: 4px;
}
.bp-controls .bp-cam button {
  flex: 0 0 auto;
  padding: 6px 7px;
}
/* 2D/3D toggle */
.bp-viewtoggle {
  display: flex;
  gap: 4px;
}
.bp-viewtoggle button {
  background: var(--panel);
  border: 1px solid var(--line);
  color: #9fb0c0;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 5px 14px;
  border-radius: 4px;
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.bp-viewtoggle button:hover {
  border-color: var(--accent);
  color: #f0f6fc;
}
.bp-viewtoggle button.on {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: var(--accent);
  color: #fff;
}
/* camera dock */
.bp-cam {
  display: flex;
  gap: 5px;
  width: 100%;
}
.bp-cam button {
  flex: 1 1 0;
  min-width: 0;
  background: var(--panel);
  border: 1px solid var(--line);
  color: #9fb0c0;
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 1px;
  padding: 6px 4px;
  border-radius: 4px;
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.bp-cam button:hover {
  border-color: var(--accent);
  color: #f0f6fc;
}
.bp-cam button.on {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border-color: var(--accent);
  color: #fff;
}
.bp-ceil {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 5px 8px;
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.bp-ceil span {
  font-size: 10px;
  letter-spacing: 1px;
  color: #9fb0c0;
}
.bp-ceil.on {
  border-color: var(--accent);
}
.bp-ceil.on span {
  color: #fff;
}
.bp-ceil input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 64px;
  height: 3px;
  border-radius: 3px;
  background: var(--line);
  outline: none;
  cursor: pointer;
}
.bp-ceil input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
}
.bp-ceil input[type="range"]::-moz-range-thumb {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
}
.bp-foll {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--t);
  padding: 2px 8px;
  background: var(--panel);
  border: 1px solid color-mix(in srgb, var(--t) 40%, transparent);
  border-radius: 4px;
  align-self: flex-start;
}
/* transport */
.bp-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 5px 14px 6px;
  /* Mostly-opaque so the round selector + seek read against the map instead of
     blending into it; a short fade keeps the top edge soft. */
  background: linear-gradient(
    0deg,
    rgba(8, 10, 14, 0.97) 65%,
    rgba(8, 10, 14, 0.82)
  );
  backdrop-filter: blur(6px);
}
.bp-toprow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
/* Round selector: one row that scrolls horizontally instead of wrapping (so
   the transport stays a fixed height across long matches / OT). */
.bp-rounds {
  display: flex;
  gap: 3px;
  flex-wrap: nowrap;
  flex: 1 1 0;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  /* Soft-fade only the RIGHT edge so round numbers dissolve into the util
     filters instead of hard-overlapping them; the left butts cleanly against
     the pinned util-summary button. */
  -webkit-mask-image: linear-gradient(
    to right,
    #000 calc(100% - 14px),
    transparent 100%
  );
  mask-image: linear-gradient(to right, #000 calc(100% - 14px), transparent 100%);
}
.bp-rounds::-webkit-scrollbar {
  display: none;
}
.bp-filters {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.bp-filters .flbl {
  font-size: 9px;
  letter-spacing: 1.5px;
  color: #6b7785;
  margin-right: 2px;
}
.bp-filters .fbtn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 3px 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
}
.bp-filters .fbtn .fdot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.bp-filters .fbtn img {
  width: auto;
  height: 16px;
  max-width: 16px;
  object-fit: contain;
}
.bp-filters .fbtn:hover {
  border-color: var(--accent);
}
.bp-filters .fbtn.off {
  opacity: 0.4;
}
.bp-filters .fbtn.off img {
  filter: grayscale(1);
  opacity: 0.6;
}
.bp-filters .fclear {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid var(--accent);
  color: var(--accent);
  font-family: inherit;
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 4px;
}
.bp-toprow .rt {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line);
  border-bottom-width: 2px;
  border-bottom-color: var(--line);
  color: #8a98a8;
  font-family: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
}
.bp-toprow .rt:hover {
  color: #f0f6fc;
}
.bp-toprow .rt.win-ct {
  border-bottom-color: var(--ct);
}
.bp-toprow .rt.win-t {
  border-bottom-color: var(--t);
}
.bp-toprow .rt.buyt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #c7d2dd;
  letter-spacing: 0.5px;
  font-size: 10px;
}
.bp-toprow .rt.buyt.on {
  background: color-mix(in srgb, var(--accent) 26%, transparent);
  border-color: var(--accent);
  color: #fff;
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 55%, transparent);
}
/* overlay round multi-select: selected = bright, others dimmed */
.bp-toprow .rt.selsel {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  border-color: var(--accent);
  color: #fff;
}
.bp-toprow .rt.seldim {
  opacity: 0.32;
}
.bp-toprow .rt.seldim:hover {
  opacity: 0.7;
}
/* scoreboard-side tools */
.bp-sb-tools {
  position: absolute;
  top: 14px;
  right: 278px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.bp-sb-tools .sbt {
  min-width: 34px;
  height: 26px;
  padding: 0 6px;
  background: var(--panel);
  border: 1px solid var(--line);
  color: #9fb0c0;
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  border-radius: 4px;
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.bp-sb-tools .sbt:hover {
  border-color: var(--accent);
  color: #f0f6fc;
}
.bp-sb-tools .sbt.on {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: var(--accent);
  color: #fff;
}
/* Scoreboard collapsed: the tools strip slides to the screen edge so its
   show/hide button stays put after the 256px panel is gone. */
.bp-sb-tools.sb-collapsed {
  right: 14px;
}

/* ── Compact chrome for phone-sized touch screens ─────────────────────────
   The panels keep their look but shrink so the floating scoreboard, kill
   feed and transport all fit a landscape phone without burying the map. */
.bp-chrome.is-mobile .bp-hud {
  top: 8px;
  padding: 3px 12px 4px;
}
.bp-chrome.is-mobile .bp-score {
  font-size: 18px;
}
.bp-chrome.is-mobile .bp-left {
  top: 8px;
  left: 8px;
  width: 188px;
  gap: 5px;
}
.bp-chrome.is-mobile .bp-pbp {
  max-height: 26vh;
  padding: 5px 6px;
}
.bp-chrome.is-mobile .bp-score-panel {
  top: 8px;
  right: 8px;
  width: 196px;
  gap: 6px;
}
.bp-chrome.is-mobile .bp-sb-tools {
  top: 8px;
  right: 212px;
  flex-direction: row;
}
.bp-chrome.is-mobile .bp-sb-tools.sb-collapsed {
  right: 8px;
}
.bp-chrome.is-mobile .bp-bar {
  /* Lift the controls off the very bottom so they clear the iOS home-indicator
     / app-switcher gesture zone. env() adds the device inset where exposed. */
  padding: 5px 10px calc(9px + env(safe-area-inset-bottom, 0px));
  gap: 4px;
}
/* On touch the seek bar keeps its normal height (so the transport row stays
   vertically centered), and the nade lane drops into reserved space BELOW it
   via padding — a finger dragging the bar never lands on a nade. Desktop keeps
   them overlaid since a mouse can thread between them. */
.bp-chrome.is-mobile .seek-wrap {
  height: 38px;
  min-width: 120px;
  overflow: visible;
}
.bp-chrome.is-mobile .bp-transport {
  padding-bottom: 30px;
}
.bp-chrome.is-mobile .bp-transport .play {
  width: 32px;
  height: 32px;
}
.bp-chrome.is-mobile .seek-wrap .seek::-webkit-slider-thumb {
  height: 34px;
}
.bp-chrome.is-mobile .seek-wrap .seek::-moz-range-thumb {
  height: 34px;
}
.bp-chrome.is-mobile .seek-wrap .util-lane {
  top: calc(100% + 2px);
  bottom: auto;
  height: 26px;
}
/* Touch tap targets — bump a little for phones; tablets (taller short edge)
   get noticeably bigger since they have the room. */
.bp-chrome.is-mobile .bp-viewtoggle button,
.bp-chrome.is-mobile .bp-more {
  padding: 7px 13px;
  font-size: 12px;
}
.bp-chrome.is-mobile .bp-sb-tools .sbt {
  min-width: 40px;
  height: 34px;
  font-size: 12px;
}
.bp-chrome.is-mobile .bp-toprow .rt {
  padding: 5px 11px;
  font-size: 12px;
}
.bp-chrome.is-mobile .bp-filters .fbtn img {
  height: 19px;
  max-width: 19px;
}
@media (pointer: coarse) and (min-height: 600px) {
  .bp-chrome.is-mobile .bp-viewtoggle button,
  .bp-chrome.is-mobile .bp-more {
    padding: 10px 18px;
    font-size: 14px;
  }
  .bp-chrome.is-mobile .bp-sb-tools .sbt {
    min-width: 48px;
    height: 42px;
    font-size: 14px;
  }
  .bp-chrome.is-mobile .bp-toprow .rt {
    padding: 8px 14px;
    font-size: 14px;
  }
  .bp-chrome.is-mobile .bp-transport .play {
    width: 44px;
    height: 44px;
  }
  .bp-chrome.is-mobile .bp-filters .fbtn {
    padding: 6px 8px;
  }
  .bp-chrome.is-mobile .bp-filters .fbtn img {
    height: 23px;
    max-width: 23px;
  }
  /* tablets keep the left column (play-by-play) — give it room so the rows
     aren't clipped the way they are at the phone width. */
  .bp-chrome.is-mobile .bp-left {
    width: 300px;
  }
}
.bp-toprow .rt.on {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: #fff;
  border-color: var(--accent);
}
.bp-transport {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bp-transport > * {
  flex-shrink: 0;
}
.bp-transport .seek-wrap {
  flex-shrink: 1;
}
.bp-transport button,
.bp-transport select {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
  color: #d6e0ea;
  font-family: inherit;
  border-radius: 4px;
  padding: 5px 10px;
  cursor: pointer;
}
.bp-transport button:hover {
  border-color: var(--accent);
}
.bp-transport .play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, rgba(255, 255, 255, 0.04));
  border-radius: 50%;
}
.bp-transport .play:hover {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  border-color: var(--accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 45%, transparent);
}
.bp-transport .fs {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 44px;
  padding: 0;
  color: #9fb0c0;
}
.hl-clear {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  border: 1px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
}
.hl-clear:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}
.bp-buywin {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 4px;
  flex-shrink: 0;
}
.bp-buywin .bw-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bp-buywin .lbl {
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--accent);
  min-width: 44px;
}
.bp-buywin input {
  width: 80px;
  height: 14px;
  accent-color: var(--accent);
}
.bp-buywin .val {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  min-width: 26px;
}
.bp-buywin .bw-team button {
  font-family: inherit;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 1px 8px;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.05);
  color: #9fb0c0;
  cursor: pointer;
}
.bp-buywin .bw-team button.tname {
  max-width: 74px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bp-buywin .bw-team button:hover {
  border-color: var(--accent);
  color: #f0f6fc;
}
.bp-buywin .bw-team button.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: #fff;
}
/* "audio-editor" seek: a tall track that FILLS the wrap (so everything in the
   transport row vertically centers against it), translucent played-tint, util
   icons stacked over the track, kill/bomb dashes, and a vertical playhead. */
.seek-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
  height: 46px;
}
.seek-wrap .seek-rail {
  position: absolute;
  left: 0;
  right: 0;
  top: 4px;
  bottom: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 5px;
  overflow: hidden;
}
.seek-wrap .seek-fill {
  height: 100%;
  background: var(--accent);
  opacity: 0.16;
}
.seek-wrap .seek {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  z-index: 6;
  cursor: pointer;
  /* Pointer scrubbing is handled on .seek-wrap (reliable on touch); the native
     input stays for its thumb visual + keyboard arrows, but shouldn't capture
     pointers (iOS only drags from the tiny thumb otherwise). */
  pointer-events: none;
}
.seek-wrap {
  /* a touch drag here scrubs instead of the browser panning the page */
  touch-action: none;
}
.seek-wrap .seek::-webkit-slider-runnable-track {
  background: transparent;
  height: 100%;
}
.seek-wrap .seek::-moz-range-track {
  background: transparent;
  height: 100%;
}
.seek-wrap .seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 4px;
  height: 42px;
  border-radius: 2px;
  background: #fff;
  box-shadow:
    0 0 0 1px rgba(8, 10, 14, 0.9),
    0 0 10px color-mix(in srgb, var(--accent) 80%, transparent);
  cursor: pointer;
}
.seek-wrap .seek::-moz-range-thumb {
  width: 4px;
  height: 42px;
  border-radius: 2px;
  background: #fff;
  border: none;
  cursor: pointer;
}
/* utility lane overlays the track; clusters STACK their icons vertically */
/* above the seek slider (z-index 6) so the icons are clickable; the lane itself
   is pointer-events:none so gaps still scrub the bar. */
.seek-wrap .util-lane {
  position: absolute;
  left: 0;
  right: 0;
  top: 4px;
  bottom: 4px;
  pointer-events: none;
  z-index: 7;
}
.util-cluster {
  position: absolute;
  bottom: 3px;
}
.mk-util-icon {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateX(-50%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(14, 18, 24, 0.92);
  border-radius: 5px;
  cursor: pointer;
  pointer-events: auto;
  transition:
    border-color 0.1s,
    box-shadow 0.1s;
  padding: 0;
}
.mk-util-icon img {
  width: auto;
  height: 15px;
  max-width: 16px;
  object-fit: contain;
}
.mk-util-icon:hover {
  z-index: 7;
  border-color: rgba(255, 255, 255, 0.45);
}
.mk-util-icon.hl {
  z-index: 8;
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 30%, rgba(14, 18, 24, 0.92));
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 70%, transparent);
}
.mk-util-icon.hl img {
  filter: brightness(3) drop-shadow(0 0 3px var(--accent));
}
/* kill / bomb dashes span the full track height, on top of the fill */
.seek-wrap .mk {
  position: absolute;
  top: 6px;
  bottom: 6px;
  width: 2.5px;
  transform: translateX(-50%);
  border-radius: 1px;
  pointer-events: none;
  z-index: 4;
  opacity: 0.9;
}
.seek-wrap .mk.mk-ct {
  background: var(--ct);
}
.seek-wrap .mk.mk-t {
  background: var(--t);
}
.seek-wrap .mk.mk-bomb {
  background: #ff5a4d;
  width: 3.5px;
  top: 2px;
  bottom: 2px;
  opacity: 1;
  z-index: 5;
  box-shadow: 0 0 7px #ff5a4d;
}
.bp-transport .tl {
  font-size: 14px;
  font-weight: 600;
  color: #c4d2df;
  font-variant-numeric: tabular-nums;
  min-width: 96px;
  text-align: center;
  letter-spacing: 0.5px;
}
.spd {
  min-width: 62px;
  height: 44px;
  font-weight: 600;
}
/* keyboard help — full-height end button */
.bp-help {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 44px;
  color: #9fb0c0;
  border: 1px solid var(--line);
  border-radius: 4px;
  cursor: help;
  background: rgba(255, 255, 255, 0.05);
}
.bp-help:hover,
.bp-help:focus {
  border-color: var(--accent);
  color: #f0f6fc;
  outline: none;
}
.bp-help-pop {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  width: max-content;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 9px 11px;
  backdrop-filter: blur(8px);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.12s;
  display: flex;
  flex-direction: column;
  gap: 5px;
  z-index: 30;
}
.bp-help:hover .bp-help-pop,
.bp-help:focus .bp-help-pop {
  opacity: 1;
  visibility: visible;
}
.bp-help-pop .hk {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #c4d2df;
}
.bp-help-pop .hk span {
  color: #8a98a8;
}
.bp-help-pop .hk-sep {
  display: block;
  margin-top: 4px;
  padding-top: 5px;
  border-top: 1px solid var(--line);
  color: #6b7785;
  font-size: 9px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
</style>

<!-- Global (NOT scoped): the 3-dot DropdownMenu is portalled to <body>, so
     scoped styles can't reach it. Restyle it to match the broadcast chrome's
     dark bordered-button look (the previous custom-menu style). -->
<style>
.bp-dd {
  background: rgba(12, 15, 20, 0.95) !important;
  border: 1px solid rgba(120, 140, 165, 0.2) !important;
  border-radius: 6px !important;
  padding: 5px !important;
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 9.5rem;
  font-family: "Oxanium", system-ui, sans-serif;
  color: #d6e0ea;
}
.bp-dd-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(120, 140, 165, 0.2);
  color: #9fb0c0;
  font-size: 11px !important;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 6px 10px !important;
  border-radius: 4px !important;
  cursor: pointer;
}
.bp-dd-item:hover,
.bp-dd-item:focus,
.bp-dd-item[data-highlighted] {
  border-color: #57cdff;
  color: #f0f6fc !important;
  background: rgba(255, 255, 255, 0.08) !important;
  outline: none;
}
.bp-dd-item.bp-dd-on {
  background: color-mix(in srgb, #57cdff 20%, transparent) !important;
  border-color: #57cdff;
  color: #fff !important;
}
.bp-dd-roof {
  justify-content: space-between;
  gap: 10px;
}
.bp-dd-roof span {
  font-size: 10px;
}
.bp-dd-roof input[type="range"] {
  width: 96px;
  accent-color: #57cdff;
  touch-action: none;
  cursor: pointer;
}
</style>
