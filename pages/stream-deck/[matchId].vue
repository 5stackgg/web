<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useRoute } from "vue-router";
import { useToast } from "~/components/ui/toast/use-toast";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import {
  ChevronLeft,
  ChevronRight,
  Square,
  ArrowLeft,
  Lock,
  AlertTriangle,
} from "lucide-vue-next";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import StreamSessionProgress from "~/components/match/StreamSessionProgress.vue";
import ShortcutOverlay from "~/components/match/ShortcutOverlay.vue";
import { Kbd } from "~/components/ui/kbd";
import { announceFocusWindow } from "~/composables/useStreamerPopout";
import {
  specSlotsForMatchType,
  teamSizeForMatchType,
  type SpecSlot,
} from "~/utilities/streamerSpecSlots";

definePageMeta({
  middleware: "streamer",
  // Hide chrome — this page wants every pixel for the broadcast view
  // and a clear "step into a focused tool" feeling.
  layout: false,
});

const route = useRoute();
const matchId = computed(() => String(route.params.matchId));
const { toast } = useToast();
const { client: apolloClient } = useApolloClient();

const stream = ref<any | null>(null);
let streamSubscription: { unsubscribe: () => void } | undefined;

onMounted(() => {
  streamSubscription = apolloClient
    .subscribe({
      query: generateSubscription({
        match_streams: [
          {
            where: {
              is_game_streamer: { _eq: true },
              match_id: { _eq: matchId.value },
            },
            limit: 1,
          },
          {
            id: true,
            match_id: true,
            title: true,
            link: true,
            is_live: true,
            status: true,
            stream_url: true,
            error_message: true,
            last_status_at: true,
            // status_history is jsonb (array of {status, at}); the
            // stepper renders ✓ only for stages that actually fired
            // (skipped stages on warm boots stay greyed out).
            status_history: true as any,
            autodirector: true,
            match: {
              id: true,
              status: true,
              options: { type: true },
              // lineup_players w/ steam_id so we can label slot
              // buttons with player names + look them up in GSI for
              // current side / alive state. Without this we'd be
              // stuck rendering raw slot numbers like the demo deck
              // used to before the GSI wiring.
              lineup_1: {
                name: true,
                lineup_players: [
                  {},
                  {
                    placeholder_name: true,
                    player: { steam_id: true, name: true },
                  },
                ],
              },
              lineup_2: {
                name: true,
                lineup_players: [
                  {},
                  {
                    placeholder_name: true,
                    player: { steam_id: true, name: true },
                  },
                ],
              },
            } as any,
          },
        ],
      }),
    })
    .subscribe({
      next: (result: any) => {
        stream.value = result?.data?.match_streams?.[0] ?? null;
        // Sync the local toggle with the persisted DB value so a
        // caster opening the page sees the actual current state, not
        // a hardcoded default. Skipped while a mutation is in-flight
        // to avoid the optimistic toggle flickering back to the
        // pre-update value before Hasura confirms the write.
        if (!busy.value && stream.value?.autodirector !== undefined) {
          autodirector.value = !!stream.value.autodirector;
        }
      },
      error: (err: any) => {
        // eslint-disable-next-line no-console
        console.error("[streamer-focus] subscription error", err);
      },
    });
});

onBeforeUnmount(() => {
  streamSubscription?.unsubscribe();
});

function whepUrlFor(s: any): string | null {
  if (!s?.link) return null;
  return s.link.replace(/\/?$/, "/whep");
}

const STATUS_LABELS: Record<string, string> = {
  launching_steam: "Launching Steam",
  logging_in: "Logging in",
  downloading_cs2: "Downloading CS2",
  launching_cs2: "Launching CS2",
  connecting_to_game: "Connecting to game",
  starting_capture: "Starting capture",
  errored: "Errored",
  live: "Live",
};

// Stage list mirrors the values run-live.sh + setup-steam.sh actually
// emit via report_status. Stages that don't fire on a given boot
// (e.g. downloading_cs2 only on a fresh pod) stay "pending".
const LIVE_STAGES = [
  { key: "booting", label: "Allocating GPU" },
  { key: "downloading_cs2", label: "Downloading CS2" },
  { key: "launching_steam", label: "Launching Steam" },
  { key: "logging_in", label: "Logging in" },
  { key: "launching_cs2", label: "Launching CS2" },
  { key: "connecting_to_game", label: "Connecting to game server" },
  { key: "live", label: "Streaming live" },
];
function statusBadgeLabel(s: any) {
  if (!s) return "—";
  if (s.is_live) return "LIVE";
  const v = s?.status as string | undefined;
  if (!v) return "BOOTING";
  return (STATUS_LABELS[v] ?? v.replace(/_/g, " ")).toUpperCase();
}

const autodirector = ref(true);
const busy = ref(false);

async function runMutation(
  label: string,
  build: () => Record<string, unknown>,
) {
  if (busy.value) return;
  busy.value = true;
  try {
    await apolloClient.mutate({ mutation: generateMutation(build()) });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: label,
      description: error?.message ?? "request failed",
    });
  } finally {
    busy.value = false;
  }
}

// ---- Keyboard control ----
// Driven by match type so Wingman / Duel only expose the keys that
// actually map to a real spec slot in CS2 (no orphan "8" key cycling
// nothing in a 2v2). See utilities/streamerSpecSlots.ts for the
// per-mode tables.
const slotKeys = computed<SpecSlot[]>(() =>
  specSlotsForMatchType(stream.value?.match?.options?.type),
);
const teamSize = computed(() =>
  teamSizeForMatchType(stream.value?.match?.options?.type),
);

// Tracks the most-recently-fired action so we can flash the
// corresponding button. Reset after a short window so the user gets
// clear "I pressed it" feedback even on quick taps.
const flashKey = ref<string | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;
function flash(key: string) {
  flashKey.value = key;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashKey.value = null;
  }, 220);
}

function isLive() {
  return !!stream.value?.is_live;
}
function controlsActive() {
  return isLive() && !autodirector.value && !busy.value;
}

async function pressSlot(slot: number, key: string) {
  flash(key);
  if (!controlsActive()) return;
  await runMutation(`spec slot ${slot}`, () => ({
    specSlot: [{ match_id: matchId.value, slot }, { success: true }],
  }));
}

async function pressClick(button: "left" | "right", key: string) {
  flash(key);
  if (!controlsActive()) return;
  await runMutation(`spec ${button} click`, () => ({
    specClick: [{ match_id: matchId.value, button }, { success: true }],
  }));
}

async function pressJump(key: string) {
  flash(key);
  if (!controlsActive()) return;
  await runMutation("spec jump", () => ({
    specJump: [{ match_id: matchId.value }, { success: true }],
  }));
}

async function setAutodirector(enabled: boolean) {
  autodirector.value = enabled;
  await runMutation("spec autodirector", () => ({
    specAutodirector: [{ match_id: matchId.value, enabled }, { success: true }],
  }));
}

const confirmStop = ref(false);
let confirmStopTimer: ReturnType<typeof setTimeout> | null = null;
async function stopLive() {
  if (!confirmStop.value) {
    confirmStop.value = true;
    if (confirmStopTimer) clearTimeout(confirmStopTimer);
    confirmStopTimer = setTimeout(() => (confirmStop.value = false), 5000);
    return;
  }
  confirmStop.value = false;
  await runMutation("stop live", () => ({
    stopLive: [{ match_id: matchId.value }, { success: true }],
  }));
}

function isTypingInForm(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true;
  return target.isContentEditable === true;
}

const shortcutsOpen = ref(false);
const SHORTCUT_GROUPS = computed(() => [
  {
    title: "Spectate",
    items: [
      {
        keys: ["1", "—", "0"],
        label: `Switch player (slot 1–${slotKeys.value.length})`,
      },
      { keys: ["←"], label: "Previous spec target" },
      { keys: ["→"], label: "Next spec target" },
      { keys: ["Space"], label: "Lock / free-roam" },
    ],
  },
  {
    title: "Help",
    items: [{ keys: ["?"], label: "Show this help" }],
  },
]);

function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isTypingInForm(e.target)) return;

  if (e.key === "?" || (e.shiftKey && e.key === "/")) {
    e.preventDefault();
    shortcutsOpen.value = !shortcutsOpen.value;
    return;
  }
  if (e.key === "Escape" && shortcutsOpen.value) {
    e.preventDefault();
    shortcutsOpen.value = false;
    return;
  }

  if (e.repeat) return;

  // Digits: 0..9 → slots
  const slot = slotKeys.value.find((s) => s.key === e.key);
  if (slot) {
    e.preventDefault();
    void pressSlot(slot.slot, slot.key);
    return;
  }

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    // cs2: right click cycles to previous spec target
    void pressClick("right", "ArrowLeft");
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    void pressClick("left", "ArrowRight");
    return;
  }
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    void pressJump("Space");
    return;
  }
}

let stopAnnouncing: (() => void) | null = null;
onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  // Tell the originating deck UI we own this match so it can pause
  // its own WHEP player while we're up.
  stopAnnouncing = announceFocusWindow(matchId.value);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  if (flashTimer) clearTimeout(flashTimer);
  if (confirmStopTimer) clearTimeout(confirmStopTimer);
  stopAnnouncing?.();
});


// ---- GSI polling ----
// Pulls live slot/player state from the streamer pod via a Hasura
// action that proxies spec-server's /demo/state. Source of truth for
// player names, slot indices, and team grouping is GSI (cs2 itself),
// not the api's lineup data — that way the deck always matches what
// cs2 is actually rendering, even if the api lineup is mismatched.
type LiveSpecSlot = {
  slot: number;
  steam_id: string;
  name: string | null;
  team: "T" | "CT" | null;
  alive: boolean;
  health: number;
};
const specSlots = ref<LiveSpecSlot[]>([]);
const spectatedSteamId = ref<string | null>(null);
const gsiTeamCtName = ref<string | null>(null);
const gsiTeamTName = ref<string | null>(null);
const gsiTeamCtScore = ref<number>(0);
const gsiTeamTScore = ref<number>(0);
let specPollTimer: ReturnType<typeof setInterval> | null = null;

async function pollLiveState() {
  if (!matchId.value || !isLive()) return;
  try {
    const { data } = await apolloClient.mutate({
      // Cast: action lives outside zeus until codegen runs, same
      // pattern as createClipRender / createClipFromPreset.
      mutation: generateMutation({
        getLiveStreamSpecState: [
          { match_id: matchId.value },
          {
            gsi: {
              spectated_steam_id: true,
              team_ct_name: true,
              team_t_name: true,
              team_ct_score: true,
              team_t_score: true,
              spec_slots: {
                slot: true,
                steam_id: true,
                name: true,
                team: true,
                alive: true,
                health: true,
              },
            },
          },
        ],
      } as any),
      // Don't pollute the apollo cache — this is a high-frequency
      // poll, the data is short-lived and never re-read.
      fetchPolicy: "no-cache",
    });
    const gsi = (data as any)?.getLiveStreamSpecState?.gsi;
    if (!gsi) return;
    if (Array.isArray(gsi.spec_slots)) specSlots.value = gsi.spec_slots;
    spectatedSteamId.value = gsi.spectated_steam_id ?? null;
    if (typeof gsi.team_ct_name === "string") gsiTeamCtName.value = gsi.team_ct_name;
    if (typeof gsi.team_t_name === "string") gsiTeamTName.value = gsi.team_t_name;
    if (typeof gsi.team_ct_score === "number") gsiTeamCtScore.value = gsi.team_ct_score;
    if (typeof gsi.team_t_score === "number") gsiTeamTScore.value = gsi.team_t_score;
  } catch {
    // Pod transient: ignore. Next tick will retry.
  }
}
function startSpecPoll() {
  stopSpecPoll();
  void pollLiveState();
  specPollTimer = setInterval(pollLiveState, 1000);
}
function stopSpecPoll() {
  if (specPollTimer) {
    clearInterval(specPollTimer);
    specPollTimer = null;
  }
}
// React to is_live transitions — start polling when the stream goes
// live, stop when it drops, so we don't hammer a dead pod with state
// requests while the operator's still on the page.
watch(
  () => isLive(),
  (live) => {
    if (live) startSpecPoll();
    else stopSpecPoll();
  },
  { immediate: true },
);
onBeforeUnmount(() => stopSpecPoll());

// CT / T groupings come straight from GSI. cs2 maintains the
// keybinds (spec_player_<N> ↔ observer_slot N), so click target and
// label are sourced from the same place — no risk of drift.
const ctSlots = computed(() =>
  specSlots.value
    .filter((s) => s.team === "CT")
    .slice()
    .sort((a, b) => a.slot - b.slot),
);
const tSlots = computed(() =>
  specSlots.value
    .filter((s) => s.team === "T")
    .slice()
    .sort((a, b) => a.slot - b.slot),
);
const hasGsi = computed(() => specSlots.value.length > 0);

function slotIsActive(s: LiveSpecSlot): boolean {
  if (!spectatedSteamId.value) return false;
  return s.steam_id === spectatedSteamId.value;
}
function sideClasses(side: "T" | "CT", isActive: boolean, isFlash: boolean) {
  const wantHighlight = isActive || isFlash;
  if (side === "CT") {
    return wantHighlight
      ? "border-blue-400 bg-blue-500/20 text-blue-200"
      : "border-blue-500/40 bg-blue-500/5 text-foreground/80 hover:border-blue-400/70 hover:bg-blue-500/10 hover:text-blue-100";
  }
  return wantHighlight
    ? "border-amber-400 bg-amber-500/20 text-amber-100"
    : "border-amber-500/40 bg-amber-500/5 text-foreground/80 hover:border-amber-400/70 hover:bg-amber-500/10 hover:text-amber-100";
}
function sideDotClass(side: "T" | "CT") {
  return side === "CT" ? "bg-blue-400" : "bg-amber-400";
}
function ctTeamName(): string {
  return gsiTeamCtName.value || "Counter-Terrorists";
}
function tTeamName(): string {
  return gsiTeamTName.value || "Terrorists";
}
</script>

<template>
  <div
    class="relative min-h-screen bg-[hsl(var(--background))] text-foreground flex flex-col"
    style="
      background-image:
        radial-gradient(
          circle at 12% 0%,
          hsl(var(--tac-amber) / 0.06),
          transparent 45%
        ),
        radial-gradient(
          circle at 88% 100%,
          hsl(var(--destructive) / 0.05),
          transparent 50%
        );
    "
  >
    <!-- ============ TOP BAR ============ -->
    <header
      class="border-b border-border/60 bg-card/40 backdrop-blur-sm flex-shrink-0"
    >
      <div class="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
        <NuxtLink
          to="/stream-deck"
          class="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft class="size-4" />
          Back to deck
        </NuxtLink>

        <div class="h-6 w-px bg-border/60" />

        <div class="flex items-center gap-3 min-w-0">
          <h1 class="font-display text-lg font-bold tracking-tight truncate">
            <span>{{ stream?.match?.lineup_1?.name ?? "Team A" }}</span>
            <span class="mx-2 text-muted-foreground/60 font-light">vs</span>
            <span>{{ stream?.match?.lineup_2?.name ?? "Team B" }}</span>
          </h1>
        </div>

        <div class="ml-auto flex items-center gap-3 flex-shrink-0">
          <div class="flex items-center gap-2">
            <Label
              for="autodirector-focus"
              class="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              Auto-director
            </Label>
            <Switch
              id="autodirector-focus"
              :model-value="autodirector"
              :disabled="!isLive() || busy"
              @update:model-value="(v: boolean) => setAutodirector(v)"
            />
          </div>

          <!-- Same segmented tactical bar treatment as the deck card —
               armed Stop inverts to filled red w/ glow + filled icon. -->
          <div
            class="inline-flex items-stretch overflow-hidden rounded-md border border-border/70 bg-card/40 backdrop-blur-sm"
          >
            <button
              type="button"
              :disabled="busy"
              :class="[
                'inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                confirmStop
                  ? 'bg-destructive text-destructive-foreground shadow-[inset_0_0_0_1px_hsl(var(--destructive)),0_0_18px_hsl(var(--destructive)/0.5)]'
                  : 'text-destructive hover:bg-destructive/15',
              ]"
              @click="stopLive"
            >
              <Square
                :class="['size-3.5', confirmStop ? 'fill-current' : '']"
              />
              {{ confirmStop ? "Confirm" : "Stop" }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- ============ MAIN BODY ============ -->
    <PageTransition :delay="0" class="flex-1">
      <div class="mx-auto max-w-7xl w-full px-4 py-6 space-y-5">
        <!-- VIDEO (full width) -->
        <div
          class="relative overflow-hidden rounded-lg border border-border/70 bg-black shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.05),0_30px_60px_-30px_rgba(0,0,0,0.7)]"
        >
          <WhepPlayer
            v-if="stream?.is_live && whepUrlFor(stream)"
            :whep-url="whepUrlFor(stream)!"
          />
          <!-- Mirrors the deck-card overlay: full step-by-step boot
               pipeline so the caster sees how far the pod has gotten
               and whether a stage has stalled, instead of a generic
               "no signal" placeholder. -->
          <div
            v-else
            class="aspect-video w-full flex items-center justify-center px-6"
          >
            <StreamSessionProgress
              :status="stream?.status || 'booting'"
              :error-message="stream?.error_message"
              :last-status-at="stream?.last_status_at"
              :status-history="stream?.status_history || []"
              :stages="LIVE_STAGES"
              header-label="Stream boot"
            />
          </div>

          <!-- Corner crosshairs — broadcast-deck flourish -->
          <div class="pointer-events-none absolute inset-0">
            <div
              class="absolute top-2 left-2 size-4 border-t-2 border-l-2 border-[hsl(var(--tac-amber)/0.6)]"
            />
            <div
              class="absolute top-2 right-2 size-4 border-t-2 border-r-2 border-[hsl(var(--tac-amber)/0.6)]"
            />
            <div
              class="absolute bottom-2 left-2 size-4 border-b-2 border-l-2 border-[hsl(var(--tac-amber)/0.6)]"
            />
            <div
              class="absolute bottom-2 right-2 size-4 border-b-2 border-r-2 border-[hsl(var(--tac-amber)/0.6)]"
            />
          </div>
        </div>

        <div
          v-if="autodirector && isLive()"
          class="flex items-start gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2 text-xs text-[hsl(var(--tac-amber))]"
        >
          <AlertTriangle class="size-4 flex-shrink-0 mt-px" />
          <p>
            <span class="font-semibold">Auto-director is on.</span>
            CS2 is choosing the camera — keypresses are previewed but not sent.
            Disable above to take manual control.
          </p>
        </div>

        <!-- CONTROL DECK (below video) -->
        <div class="grid gap-5 lg:grid-cols-3">
          <!-- Observer target — spans 2 cols on lg -->
          <section class="lg:col-span-2 space-y-2">
            <div class="flex items-center justify-between">
              <span
                class="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                Observer target
              </span>
              <span
                class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/60"
              >
                Tap or press the matching key
              </span>
            </div>

            <!-- CT row + T row from GSI. Cs2 itself decides who's on
                 which side — at halftime + every OT swap, players move
                 between rows automatically. The slot number on the
                 button is cs2's observer_slot (== the digit-key bind),
                 so click target stays in lockstep with the label. -->
            <div v-if="hasGsi">
              <div class="mb-1 flex items-center gap-1.5">
                <span :class="['inline-block size-1.5 rounded-full', sideDotClass('CT')]" />
                <span class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/80">
                  {{ ctTeamName() }}
                  <span class="ml-1 px-1 rounded font-bold bg-blue-500/20 text-blue-300">CT</span>
                  <span class="ml-1 text-foreground">{{ gsiTeamCtScore }}</span>
                </span>
              </div>
              <div
                :class="[
                  'grid gap-2',
                  teamSize === 5 && 'grid-cols-5',
                  teamSize === 2 && 'grid-cols-2 max-w-[40%]',
                  teamSize === 1 && 'grid-cols-1 max-w-[20%]',
                ]"
              >
                <button
                  v-for="s in ctSlots"
                  :key="`ct-${s.slot}-${s.steam_id}`"
                  type="button"
                  :disabled="!controlsActive()"
                  :class="[
                    'group relative aspect-[5/4] rounded-md border font-mono transition-all duration-100 select-none flex flex-col items-center justify-center gap-0.5 px-1',
                    sideClasses('CT', slotIsActive(s), flashKey === String(s.slot)),
                    !s.alive && !slotIsActive(s) ? 'opacity-50' : '',
                    !controlsActive() ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                  ]"
                  :title="s.name ?? `Slot ${s.slot}`"
                  @click="pressSlot(s.slot, String(s.slot))"
                >
                  <span class="text-2xl font-bold">{{ s.slot }}</span>
                  <span
                    :class="[
                      'text-[0.65rem] truncate w-full text-center font-medium',
                      !s.alive ? 'line-through' : '',
                    ]"
                  >
                    {{ s.name ?? `Slot ${s.slot}` }}
                  </span>
                </button>
              </div>
            </div>

            <div v-if="hasGsi">
              <div class="mb-1 mt-1 flex items-center gap-1.5">
                <span :class="['inline-block size-1.5 rounded-full', sideDotClass('T')]" />
                <span class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/80">
                  {{ tTeamName() }}
                  <span class="ml-1 px-1 rounded font-bold bg-amber-500/20 text-amber-200">T</span>
                  <span class="ml-1 text-foreground">{{ gsiTeamTScore }}</span>
                </span>
              </div>
              <div
                :class="[
                  'grid gap-2',
                  teamSize === 5 && 'grid-cols-5',
                  teamSize === 2 && 'grid-cols-2 max-w-[40%]',
                  teamSize === 1 && 'grid-cols-1 max-w-[20%]',
                ]"
              >
                <button
                  v-for="s in tSlots"
                  :key="`t-${s.slot}-${s.steam_id}`"
                  type="button"
                  :disabled="!controlsActive()"
                  :class="[
                    'group relative aspect-[5/4] rounded-md border font-mono transition-all duration-100 select-none flex flex-col items-center justify-center gap-0.5 px-1',
                    sideClasses('T', slotIsActive(s), flashKey === String(s.slot)),
                    !s.alive && !slotIsActive(s) ? 'opacity-50' : '',
                    !controlsActive() ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                  ]"
                  :title="s.name ?? `Slot ${s.slot}`"
                  @click="pressSlot(s.slot, String(s.slot))"
                >
                  <span class="text-2xl font-bold">{{ s.slot }}</span>
                  <span
                    :class="[
                      'text-[0.65rem] truncate w-full text-center font-medium',
                      !s.alive ? 'line-through' : '',
                    ]"
                  >
                    {{ s.name ?? `Slot ${s.slot}` }}
                  </span>
                </button>
              </div>
            </div>
            <p
              v-else-if="isLive()"
              class="text-[0.6rem] uppercase tracking-wider text-muted-foreground/60 font-mono"
            >
              Waiting for cs2 game state…
            </p>
          </section>

          <!-- Cycle / lock + keybinds (right column) -->
          <aside class="space-y-4">
            <div>
              <span
                class="mb-2 block font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                Cycle &amp; lock
              </span>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  :disabled="!controlsActive()"
                  :class="[
                    'flex flex-col items-center justify-center gap-1.5 rounded-md border aspect-[5/4] transition-all duration-100 select-none',
                    flashKey === 'ArrowLeft'
                      ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))] scale-95 shadow-[0_0_0_3px_hsl(var(--tac-amber)/0.15),0_0_22px_hsl(var(--tac-amber)/0.45)]'
                      : 'border-border/70 bg-card/40 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.08)] active:scale-95',
                    !controlsActive()
                      ? 'opacity-40 cursor-not-allowed'
                      : 'cursor-pointer',
                  ]"
                  @click="pressClick('right', 'ArrowLeft')"
                >
                  <ChevronLeft class="size-8" :stroke-width="2.5" />
                  <span
                    class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Prev <span class="opacity-60">←</span>
                  </span>
                </button>

                <button
                  type="button"
                  :disabled="!controlsActive()"
                  :class="[
                    'flex flex-col items-center justify-center gap-1.5 rounded-md border aspect-[5/4] transition-all duration-100 select-none',
                    flashKey === 'Space'
                      ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))] scale-95 shadow-[0_0_0_3px_hsl(var(--tac-amber)/0.15),0_0_22px_hsl(var(--tac-amber)/0.45)]'
                      : 'border-border/70 bg-card/40 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.08)] active:scale-95',
                    !controlsActive()
                      ? 'opacity-40 cursor-not-allowed'
                      : 'cursor-pointer',
                  ]"
                  @click="pressJump('Space')"
                >
                  <Lock class="size-7" :stroke-width="2.5" />
                  <span
                    class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Lock <span class="opacity-60">␣</span>
                  </span>
                </button>

                <button
                  type="button"
                  :disabled="!controlsActive()"
                  :class="[
                    'flex flex-col items-center justify-center gap-1.5 rounded-md border aspect-[5/4] transition-all duration-100 select-none',
                    flashKey === 'ArrowRight'
                      ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))] scale-95 shadow-[0_0_0_3px_hsl(var(--tac-amber)/0.15),0_0_22px_hsl(var(--tac-amber)/0.45)]'
                      : 'border-border/70 bg-card/40 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.08)] active:scale-95',
                    !controlsActive()
                      ? 'opacity-40 cursor-not-allowed'
                      : 'cursor-pointer',
                  ]"
                  @click="pressClick('left', 'ArrowRight')"
                >
                  <ChevronRight class="size-8" :stroke-width="2.5" />
                  <span
                    class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Next <span class="opacity-60">→</span>
                  </span>
                </button>
              </div>
            </div>

            <div class="rounded-md border border-border/60 bg-card/30 p-3">
              <span
                class="mb-2 block font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                Keybinds
              </span>
              <ul class="space-y-1.5 text-xs text-muted-foreground">
                <li class="flex items-center justify-between gap-2">
                  <span>Jump to slot</span>
                  <span class="flex items-center gap-1">
                    <kbd
                      v-for="entry in slotKeys"
                      :key="entry.slot"
                      class="font-mono text-[0.65rem] rounded border border-border/70 bg-background/60 px-1.5 py-0.5"
                    >
                      {{ entry.key }}
                    </kbd>
                  </span>
                </li>
                <li class="flex items-center justify-between gap-2">
                  <span>Prev / Next target</span>
                  <span class="flex items-center gap-1">
                    <kbd
                      class="font-mono text-[0.65rem] rounded border border-border/70 bg-background/60 px-1.5 py-0.5"
                      >←</kbd
                    >
                    <kbd
                      class="font-mono text-[0.65rem] rounded border border-border/70 bg-background/60 px-1.5 py-0.5"
                      >→</kbd
                    >
                  </span>
                </li>
                <li class="flex items-center justify-between gap-2">
                  <span>Toggle lock / free-roam</span>
                  <kbd
                    class="font-mono text-[0.65rem] rounded border border-border/70 bg-background/60 px-1.5 py-0.5"
                    >Space</kbd
                  >
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </PageTransition>
    <button
      type="button"
      class="fixed bottom-4 right-4 z-20 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground/80 backdrop-blur-md cursor-pointer transition-all duration-150 hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground hover:scale-105 active:scale-95"
      title="Show keyboard shortcuts"
      @click="shortcutsOpen = true"
    >
      Shortcuts
      <Kbd>?</Kbd>
    </button>
    <ShortcutOverlay
      :open="shortcutsOpen"
      :groups="SHORTCUT_GROUPS"
      @close="shortcutsOpen = false"
    />
  </div>
</template>
