<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useRoute } from "vue-router";
import { useToast } from "~/components/ui/toast/use-toast";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Square, ArrowLeft, AlertTriangle } from "lucide-vue-next";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import StreamSessionProgress from "~/components/match/StreamSessionProgress.vue";
import ShortcutOverlay from "~/components/match/ShortcutOverlay.vue";
import SpectatorSlots from "~/components/stream-deck/SpectatorSlots.vue";
import { Kbd } from "~/components/ui/kbd";
import { announceFocusWindow } from "~/composables/useStreamerPopout";
import { useStreamerGsi } from "~/composables/useStreamerGsi";
import {
  specSlotsForMatchType,
  resolveKeyToRealSlot,
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
              // Slot buttons are populated from GSI (`spec_slots`)
              // rather than the api lineup, so we only need lineup
              // names here for the page header.
              lineup_1: { name: true },
              lineup_2: { name: true },
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

// Stage list mirrors run-live.sh + setup-steam.sh report_status emits.
// `meta` controls non-emission rendering (see StreamSessionProgress).
const LIVE_STAGES = [
  { key: "booting", label: "Allocating GPU", meta: "required" as const },
  {
    key: "downloading_cs2",
    label: "Downloading CS2",
    meta: "conditional" as const,
  },
  {
    key: "launching_steam",
    label: "Launching Steam",
    meta: "required" as const,
  },
  { key: "logging_in", label: "Logging in", meta: "implicit" as const },
  { key: "launching_cs2", label: "Launching CS2", meta: "required" as const },
  {
    key: "connecting_to_game",
    label: "Connecting to game server",
    meta: "required" as const,
  },
  { key: "live", label: "Streaming live", meta: "required" as const },
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

function isLive() {
  return !!stream.value?.is_live;
}
// Buttons are "clickable" whenever the stream is live and we're not
// already mid-mutation. Autodirector is *not* part of this gate —
// pressing a target is a manual takeover signal, so we transparently
// flip autodirector off and then issue the spec command. (See the
// `takeManualControl` helper below.)
function controlsActive() {
  return isLive() && !busy.value;
}

// If autodirector is on, clicking/keying a target means the operator
// wants the camera under their thumb — turn it off so the next spec
// command actually lands instead of being overruled the next frame.
async function takeManualControl() {
  if (autodirector.value) {
    await setAutodirector(false);
  }
}

async function pressSlot(slot: number, _key?: string) {
  flashForSlot(slot);
  if (!controlsActive()) return;
  await takeManualControl();
  await runMutation(`spec slot ${slot}`, () => ({
    specSlot: [{ match_id: matchId.value, slot }, { success: true }],
  }));
}

// Cycle / lock keyboard handlers stay so ←/→/Space still drive cs2,
// even though we no longer render dedicated buttons for them — the
// shortcut overlay (?) documents the keys.
async function pressClick(button: "left" | "right", _key: string) {
  if (!controlsActive()) return;
  await takeManualControl();
  await runMutation(`spec ${button} click`, () => ({
    specClick: [{ match_id: matchId.value, button }, { success: true }],
  }));
}

async function pressJump(_key: string) {
  if (!controlsActive()) return;
  await takeManualControl();
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

  // Digits: 0..9 → UI position → real GSI slot of whoever is at
  // that position in the SpectatorSlots row. Keeps the keypress in
  // sync with the chip the operator sees on the tile.
  if (/^[0-9]$/.test(e.key)) {
    const real = resolveKeyToRealSlot(
      e.key,
      ctSlots.value,
      tSlots.value,
      stream.value?.match?.options?.type,
    );
    if (real != null) {
      e.preventDefault();
      void pressSlot(real, e.key);
    }
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
  if (flashSlotTimer) clearTimeout(flashSlotTimer);
  if (confirmStopTimer) clearTimeout(confirmStopTimer);
  stopAnnouncing?.();
});

// GSI polling — same composable the demo player and deck list cards
// consume so all three surfaces render identical CT/T grouping,
// scores, alive state, and active-target highlighting.
const isLiveRef = computed(() => !!stream.value?.is_live);
const {
  ctSlots,
  tSlots,
  spectatedSteamId,
  teamCtName,
  teamTName,
  teamCtScore,
  teamTScore,
} = useStreamerGsi(matchId, isLiveRef);

// Flash-by-slot mirrors the demo's pressSlot: a button click or a
// digit-key press both highlight the matching slot button. Keyboard
// arrows / Space don't have a slot button to flash, so they're
// excluded from the highlight system here (the demo treats it the
// same way).
// Flash holds until either:
//   1. GSI confirms cs2 switched to the requested slot (the button's
//      `active` styling takes over seamlessly — no visible swap), or
//   2. a 2.5s ceiling hits, so a stale press doesn't keep glowing
//      forever if the mutation silently failed.
// Without this, the flash cleared in 220ms — way before the GSI poll
// (~1s) lands the new spec target — and operators saw a brief blip
// then nothing, thinking the press hadn't registered.
const flashSlot = ref<number | null>(null);
let flashSlotTimer: ReturnType<typeof setTimeout> | null = null;
function flashForSlot(slot: number) {
  flashSlot.value = slot;
  if (flashSlotTimer) clearTimeout(flashSlotTimer);
  flashSlotTimer = setTimeout(() => {
    flashSlot.value = null;
    flashSlotTimer = null;
  }, 2500);
}
// Early-clear: when GSI's spectated_steam_id matches the slot we're
// flashing, the active styling now carries the highlight — drop the
// flash so a future press immediately re-flashes a different slot.
watch(spectatedSteamId, (sid) => {
  if (flashSlot.value == null || !sid) return;
  const matched = [...ctSlots.value, ...tSlots.value].find(
    (s) => s.slot === flashSlot.value && s.steam_id === sid,
  );
  if (matched) {
    flashSlot.value = null;
    if (flashSlotTimer) {
      clearTimeout(flashSlotTimer);
      flashSlotTimer = null;
    }
  }
});
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
            CS2 is choosing the camera — clicking a target or pressing a key
            will turn this off and take manual control.
          </p>
        </div>

        <!-- CONTROL DECK — shared SpectatorSlots used here, on the
             match page, the demo, and the deck index card so all four
             surfaces render the identical row design (health bars,
             active caret, autodirector wash). -->
        <div class="rounded-md border border-border/60 bg-card/30 px-4 py-3">
          <SpectatorSlots
            layout="grid"
            :ct-slots="ctSlots"
            :t-slots="tSlots"
            :team-ct-name="teamCtName"
            :team-t-name="teamTName"
            :active-steam-id="spectatedSteamId"
            :flash-slot="flashSlot"
            :controls-active="controlsActive()"
            :match-type="stream?.match?.options?.type"
            :autodirector-on="autodirector && isLive()"
            @press-slot="(slot: number) => pressSlot(slot, String(slot))"
          />
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
