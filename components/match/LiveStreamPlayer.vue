<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Square, AlertTriangle, ExternalLink, Radio } from "lucide-vue-next";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import StreamSessionProgress from "~/components/match/StreamSessionProgress.vue";
import SpectatorSlots from "~/components/stream-deck/SpectatorSlots.vue";
import { useStreamerGsi } from "~/composables/useStreamerGsi";
import { toast } from "@/components/ui/toast";

// Mirror of DemoPlayer.vue's compositional pattern, but for the live
// game-streamer pod attached to a match. Handles the same boot ↔ live
// Transition, the same "controls slide in once playback starts" idea,
// and the slot-row player switcher is a direct port of
// DemoPlaybackControls (CT/T rows, blue/amber palette, slot-key chip
// + truncated name) so the live and demo playback surfaces look
// indistinguishable at a glance.

const props = defineProps<{
  matchId: string;
  isOrganizer: boolean;
}>();

const { client: apolloClient } = useApolloClient();

const stream = ref<any | null>(null);
let streamSubscription: { unsubscribe: () => void } | undefined;

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

const autodirector = ref(true);
const busy = ref(false);

onMounted(() => {
  streamSubscription = apolloClient
    .subscribe({
      query: generateSubscription({
        match_streams: [
          {
            where: {
              is_game_streamer: { _eq: true },
              match_id: { _eq: props.matchId },
            },
            limit: 1,
          },
          {
            id: true,
            match_id: true,
            title: true,
            link: true,
            is_live: true,
            mode: true,
            status: true,
            stream_url: true,
            error_message: true,
            last_status_at: true,
            // status_history is jsonb (array of {status, at}); the
            // stepper renders ✓ only for stages that actually fired
            // so skipped stages on warm boots stay greyed out.
            status_history: true as any,
            autodirector: true,
            // Spec-grid layout (5v5/2v2/1v1) needs the match's
            // type to size the row + ordering correctly.
            match: {
              options: { type: true },
            },
          },
        ],
      } as any),
    })
    .subscribe({
      next: (result: any) => {
        stream.value = result?.data?.match_streams?.[0] ?? null;
        // Sync the local toggle with the persisted DB value, but don't
        // clobber an in-flight optimistic update mid-mutation.
        if (!busy.value && stream.value?.autodirector !== undefined) {
          autodirector.value = !!stream.value.autodirector;
        }
      },
      error: (err: any) => {
        // eslint-disable-next-line no-console
        console.error("[live-stream-player] subscription error", err);
      },
    });
});

onBeforeUnmount(() => {
  streamSubscription?.unsubscribe();
  if (flashSlotTimer) clearTimeout(flashSlotTimer);
  if (confirmStopTimer) clearTimeout(confirmStopTimer);
});

function whepUrlFor(s: any): string | null {
  if (!s?.link) return null;
  return s.link.replace(/\/?$/, "/whep");
}

const hasStream = computed(() => !!stream.value);
const isLive = computed(() => !!stream.value?.is_live);
const matchType = computed<string | null>(
  () => stream.value?.match?.options?.type ?? null,
);
const isErrored = computed(() => stream.value?.status === "errored");
// Slot buttons are "clickable" whenever the pod is live and we're not
// mid-mutation; autodirector is intentionally NOT in this gate, since
// clicking a target is a manual-takeover signal — pressSlot flips
// autodirector off automatically before issuing the spec command.
const controlsActive = computed(
  () => isLive.value && !busy.value && props.isOrganizer,
);

// GSI poller — same composable the stream-deck card and focus popout
// use, so CT/T grouping, alive state, and active highlight stay in
// lockstep across all three surfaces.
const matchIdRef = computed(() => props.matchId);
const {
  ctSlots,
  tSlots,
  spectatedSteamId,
  teamCtName,
  teamTName,
  teamCtScore,
  teamTScore,
} = useStreamerGsi(matchIdRef, isLive);

const statusBadgeLabel = computed(() => {
  const s = stream.value;
  if (!s) return "—";
  if (s.is_live) return "LIVE";
  const v = s.status as string | undefined;
  if (!v) return "BOOTING";
  return (STATUS_LABELS[v] ?? v.replace(/_/g, " ")).toUpperCase();
});

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

// Slot flash holds until GSI confirms cs2 actually switched to the
// requested slot, falling back to a 2.5s ceiling so a press never
// leaves the button glowing indefinitely if the mutation silently
// failed. Without this, the flash cleared in 220ms — faster than
// the GSI poll (~1s) — and operators saw a blip then nothing,
// thinking their press hadn't registered.
const flashSlot = ref<number | null>(null);
let flashSlotTimer: ReturnType<typeof setTimeout> | null = null;
function armFlash(slot: number) {
  flashSlot.value = slot;
  if (flashSlotTimer) clearTimeout(flashSlotTimer);
  flashSlotTimer = setTimeout(() => {
    flashSlot.value = null;
    flashSlotTimer = null;
  }, 2500);
}
// GSI confirmation → drop the flash early so the button slides into
// its native "active" highlight without overlap.
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

async function pressSlot(slot: number) {
  armFlash(slot);
  if (!controlsActive.value) return;
  // Manual takeover: if autodirector is on, the next spec command
  // would be overruled by cs2 the following frame. Flip it off first
  // so the click actually sticks.
  if (autodirector.value) {
    await setAutodirector(false);
  }
  await runMutation(`spec slot ${slot}`, () => ({
    specSlot: [{ match_id: props.matchId, slot }, { success: true }],
  }));
}

async function setAutodirector(enabled: boolean) {
  autodirector.value = enabled;
  await runMutation("spec autodirector", () => ({
    specAutodirector: [{ match_id: props.matchId, enabled }, { success: true }],
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
  if (confirmStopTimer) {
    clearTimeout(confirmStopTimer);
    confirmStopTimer = null;
  }
  await runMutation("stop live", () => ({
    stopLive: [{ match_id: props.matchId }, { success: true }],
  }));
}

function openExternal() {
  if (stream.value?.link) {
    window.open(stream.value.link, "_blank", "noopener,noreferrer");
  }
}
</script>

<template>
  <div
    v-if="hasStream"
    class="overflow-hidden rounded-lg border border-border/70 bg-black shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.05),0_30px_60px_-30px_rgba(0,0,0,0.7)]"
  >
    <!-- ======== HEADER BAR ========
         Status pill (LIVE / BOOTING / ERRORED) on the left, organizer
         controls on the right. Mirrors the broadcast-deck top bar from
         /stream-deck/[matchId] but slimmer for in-page embedding. -->
    <div
      class="flex items-center gap-3 border-b border-border/60 bg-card/40 backdrop-blur-sm px-3 py-2"
    >
      <span
        class="inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.22em] leading-none"
        :class="
          isLive
            ? 'border-[hsl(var(--destructive)/0.55)] bg-[hsl(var(--destructive)/0.12)] text-destructive'
            : isErrored
              ? 'border-[hsl(var(--destructive)/0.55)] bg-[hsl(var(--destructive)/0.18)] text-destructive'
              : 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
        "
      >
        <!-- Live: animated ping dot.
             Booting: spinning amber ring.
             Errored: filled red square. -->
        <span
          v-if="isLive"
          class="relative inline-flex h-1.5 w-1.5 shrink-0"
          aria-hidden="true"
        >
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"
          ></span>
          <span
            class="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive [box-shadow:0_0_5px_hsl(var(--destructive)/0.9)]"
          ></span>
        </span>
        <span
          v-else-if="isErrored"
          class="inline-block h-2 w-2 bg-destructive"
          aria-hidden="true"
        ></span>
        <Radio v-else class="h-2.5 w-2.5 animate-pulse" aria-hidden="true" />
        {{ statusBadgeLabel }}
      </span>

      <span
        v-if="stream?.mode"
        class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        {{ stream.mode === "live" ? "Direct" : "GOTV" }}
      </span>

      <span class="ml-auto flex items-center gap-3">
        <button
          v-if="stream?.link && isLive"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground hover:border-[hsl(var(--tac-amber)/0.5)] transition-colors cursor-pointer"
          title="Open HLS URL"
          @click="openExternal"
        >
          <ExternalLink class="h-3 w-3" />
          HLS
        </button>

        <div v-if="isOrganizer && isLive" class="flex items-center gap-2">
          <Label
            for="live-stream-autodirector"
            class="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground cursor-pointer"
          >
            Auto-director
          </Label>
          <Switch
            id="live-stream-autodirector"
            :model-value="autodirector"
            :disabled="busy"
            @update:model-value="(v: boolean) => setAutodirector(v)"
          />
        </div>

        <!-- Segmented tactical Stop — same treatment as the deck card.
             Idle: red text on transparent. Armed: solid destructive
             with outer halo + filled icon. -->
        <button
          v-if="isOrganizer"
          type="button"
          :disabled="busy"
          :class="[
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] leading-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
            confirmStop
              ? 'border-destructive bg-destructive text-destructive-foreground [box-shadow:0_0_18px_-2px_hsl(var(--destructive)/0.85),inset_0_1px_0_0_hsl(0_0%_100%_/_0.18)]'
              : 'border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.08)] text-destructive hover:bg-[hsl(var(--destructive)/0.18)]',
          ]"
          :title="
            confirmStop
              ? 'Click again to stop'
              : isLive
                ? 'Stop Live Stream'
                : 'Cancel Live Stream (booting…)'
          "
          @click="stopLive"
        >
          <Square
            class="size-3"
            :class="confirmStop ? 'fill-current' : ''"
            aria-hidden="true"
          />
          <span>
            {{ confirmStop ? "Confirm" : isLive ? "Stop" : "Cancel" }}
          </span>
        </button>
      </span>
    </div>

    <!-- ======== VIDEO / BOOT AREA ========
         Direct lift of DemoPlayer's boot↔live Transition pattern,
         scaled into an aspect-video tile. WhepPlayer mounts only when
         `is_live` flips true so the boot UI gets full real estate
         while the pod warms up. -->
    <div class="relative aspect-video w-full bg-black">
      <Transition name="boot-live" mode="out-in">
        <WhepPlayer
          v-if="stream?.is_live && whepUrlFor(stream)"
          key="live"
          :whep-url="whepUrlFor(stream)!"
          class="absolute inset-0"
        />
        <div
          v-else
          key="boot"
          class="absolute inset-0 flex items-center justify-center px-6 py-6 overflow-auto"
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
      </Transition>

      <!-- Corner crosshairs — broadcast-deck flourish, identical to
           /stream-deck/[matchId] so both surfaces feel tied. -->
      <div class="pointer-events-none absolute inset-0">
        <div
          class="absolute top-2 left-2 size-3 border-t-2 border-l-2 border-[hsl(var(--tac-amber)/0.6)]"
        />
        <div
          class="absolute top-2 right-2 size-3 border-t-2 border-r-2 border-[hsl(var(--tac-amber)/0.6)]"
        />
        <div
          class="absolute bottom-2 left-2 size-3 border-b-2 border-l-2 border-[hsl(var(--tac-amber)/0.6)]"
        />
        <div
          class="absolute bottom-2 right-2 size-3 border-b-2 border-r-2 border-[hsl(var(--tac-amber)/0.6)]"
        />
      </div>
    </div>

    <!-- ======== AUTODIRECTOR BANNER ========
         Only shown to organizers; otherwise it's noise to a viewer. -->
    <div
      v-if="autodirector && isLive && isOrganizer"
      class="flex items-start gap-2 border-t border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2 text-xs text-[hsl(var(--tac-amber))]"
    >
      <AlertTriangle class="size-3.5 flex-shrink-0 mt-0.5" />
      <p class="leading-snug">
        <span class="font-semibold">Auto-director is on.</span>
        CS2 is choosing the camera — clicking a player below will turn this off
        and take manual control.
      </p>
    </div>

    <!-- ======== CONTROL DECK ========
         Slides in like DemoPlayer's controls bar once the pod is live
         and an organizer is viewing. The slot rows are a direct port
         of DemoPlaybackControls — same row geometry, same blue/amber
         side palette, same slot-key chip + truncated name + struck-
         through dead state — so the live and demo player switchers
         look indistinguishable. -->
    <Transition name="controls-slide">
      <div
        v-if="isOrganizer && isLive"
        class="border-t border-border/60 bg-card/95 backdrop-blur-sm px-5 py-4"
      >
        <SpectatorSlots
          layout="grid"
          :ct-slots="ctSlots"
          :t-slots="tSlots"
          :team-ct-name="teamCtName"
          :team-t-name="teamTName"
          :match-type="matchType"
          :active-steam-id="spectatedSteamId"
          :flash-slot="flashSlot"
          :controls-active="controlsActive"
          :autodirector-on="autodirector"
          @press-slot="(slot: number) => pressSlot(slot)"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Direct port of DemoPlayer's boot↔live transition + controls slide
   so the two surfaces share the same playback choreography. */
.boot-live-enter-active,
.boot-live-leave-active {
  transition:
    opacity 350ms ease,
    transform 350ms ease;
}
.boot-live-enter-from {
  opacity: 0;
  transform: scale(1.02);
}
.boot-live-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.controls-slide-enter-active,
.controls-slide-leave-active {
  transition:
    opacity 300ms ease,
    transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.controls-slide-enter-from,
.controls-slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
