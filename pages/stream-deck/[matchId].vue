<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
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
              lineup_1: { name: true },
              lineup_2: { name: true },
            },
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

const team1Slots = computed(() => slotKeys.value.filter((s) => s.team === 1));
const team2Slots = computed(() => slotKeys.value.filter((s) => s.team === 2));
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

            <!-- Team 1 -->
            <div>
              <div class="mb-1 flex items-center gap-1.5">
                <span
                  class="inline-block size-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
                />
                <span
                  class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/80"
                >
                  {{ stream?.match?.lineup_1?.name ?? "Team 1" }}
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
                  v-for="slot in team1Slots"
                  :key="slot.slot"
                  type="button"
                  :disabled="!controlsActive()"
                  :class="[
                    'group relative aspect-[5/4] rounded-md border font-mono text-2xl font-bold transition-all duration-100 select-none',
                    flashKey === slot.key
                      ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))] scale-95 shadow-[0_0_0_3px_hsl(var(--tac-amber)/0.15),0_0_22px_hsl(var(--tac-amber)/0.45)]'
                      : 'border-border/70 bg-card/40 text-foreground/80 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-foreground active:scale-95',
                    !controlsActive()
                      ? 'opacity-40 hover:bg-card/40 hover:border-border/70 hover:text-foreground/80 cursor-not-allowed'
                      : 'cursor-pointer',
                  ]"
                  @click="pressSlot(slot.slot, slot.key)"
                >
                  {{ slot.slot }}
                  <span
                    class="absolute bottom-1 right-1.5 font-sans text-[0.55rem] uppercase tracking-[0.1em] text-muted-foreground/60"
                  >
                    key {{ slot.key }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Team 2 -->
            <div>
              <div class="mb-1 mt-1 flex items-center gap-1.5">
                <span
                  class="inline-block size-1.5 rounded-full bg-destructive"
                />
                <span
                  class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/80"
                >
                  {{ stream?.match?.lineup_2?.name ?? "Team 2" }}
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
                  v-for="slot in team2Slots"
                  :key="slot.slot"
                  type="button"
                  :disabled="!controlsActive()"
                  :class="[
                    'group relative aspect-[5/4] rounded-md border font-mono text-2xl font-bold transition-all duration-100 select-none',
                    flashKey === slot.key
                      ? 'border-destructive bg-destructive/25 text-destructive scale-95 shadow-[0_0_0_3px_hsl(var(--destructive)/0.15),0_0_22px_hsl(var(--destructive)/0.45)]'
                      : 'border-border/70 bg-card/40 text-foreground/80 hover:border-destructive/50 hover:bg-destructive/10 hover:text-foreground active:scale-95',
                    !controlsActive()
                      ? 'opacity-40 hover:bg-card/40 hover:border-border/70 hover:text-foreground/80 cursor-not-allowed'
                      : 'cursor-pointer',
                  ]"
                  @click="pressSlot(slot.slot, slot.key)"
                >
                  <span>{{ slot.slot }}</span>
                  <span
                    class="absolute bottom-1 right-1.5 font-sans text-[0.55rem] uppercase tracking-[0.1em] text-muted-foreground/60"
                  >
                    key {{ slot.key }}
                  </span>
                </button>
              </div>
            </div>
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
