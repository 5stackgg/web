<script setup lang="ts">
import { reactive } from "vue";
import { storeToRefs } from "pinia";
import { useApolloClient } from "@vue/apollo-composable";
import { useStreamerStore } from "~/stores/StreamerStore";
import { useToast } from "~/components/ui/toast/use-toast";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Square,
  ExternalLink,
  Radio,
  PictureInPicture2,
  X,
  Cpu,
  CircleAlert,
} from "lucide-vue-next";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import { useStreamerPopout } from "~/composables/useStreamerPopout";
import {
  specSlotsForMatchType,
  teamSizeForMatchType,
} from "~/utilities/streamerSpecSlots";
import NodeGpuMetrics from "~/components/system-metrics/NodeGpuMetrics.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";
import { computed, ref, watch } from "vue";

const isAdmin = computed(() =>
  useAuthStore().isRoleAbove(e_player_roles_enum.administrator),
);

// List of GPU-enabled nodes. The set rarely changes during a deck
// session, so a one-shot query (refetched if the user gains admin)
// is enough — the per-panel poll covers the live telemetry.
const gpuNodes = ref<Array<{ id: string; label: string | null }>>([]);
// GPU panels are hidden by default; admins toggle them on via the GPU
// pill in the header so the deck stays focused on streams during a
// normal session.
const showGpu = ref(false);

const {
  isOpen: isPopoutOpen,
  openPopout,
  focusPopout,
  closePopout,
} = useStreamerPopout();

// Derive the WHEP URL from the row's HLS link rather than configuring
// a separate domain — mediamtx serves both protocols from the same
// process and the ingress routes /<matchId>/whep to port 8889 while
// everything else under /<matchId>/ goes to HLS on 8888.
function whepUrlFor(stream: any): string | null {
  if (!stream?.link) return null;
  return stream.link.replace(/\/?$/, "/whep");
}

definePageMeta({
  middleware: "streamer",
});

const { toast } = useToast();
const { client: apolloClient } = useApolloClient();

watch(
  isAdmin,
  async (admin) => {
    if (!admin) {
      gpuNodes.value = [];
      return;
    }
    try {
      const { data } = await apolloClient.query({
        query: generateQuery({
          game_server_nodes: [
            {
              where: {
                gpu: { _eq: true },
                enabled: { _eq: true },
              },
            },
            { id: true, label: true },
          ],
        }),
        fetchPolicy: "network-only",
      });
      gpuNodes.value = (data as any)?.game_server_nodes ?? [];
    } catch (error) {
      console.error("failed to load GPU nodes for stream deck", error);
    }
  },
  { immediate: true },
);

// `busy` is the only piece of UI state kept locally — autodirector
// state lives on the match_streams row now and rides the Hasura
// subscription, so multiple casters on the same match see the same
// toggle without bespoke broadcast logic.
type MatchControlState = {
  busy: boolean;
};
const controlState = reactive<Record<string, MatchControlState>>({});

function ensureState(matchId: string): MatchControlState {
  if (!controlState[matchId]) {
    controlState[matchId] = { busy: false };
  }
  return controlState[matchId];
}

// Read the persisted autodirector flag off the streams row. Defaults
// to true to match the cs2 autoexec, which is what the pod actually
// runs with on first launch.
function isAutodirector(stream: any): boolean {
  return stream?.autodirector !== false;
}

// Derive the slot list and grid sizing from the match type so a
// Wingman row doesn't expose 10 buttons that map to nothing in CS2.
function streamSpecSlots(stream: any) {
  return specSlotsForMatchType(stream?.match?.options?.type);
}
function streamTeamSize(stream: any) {
  return teamSizeForMatchType(stream?.match?.options?.type);
}

// Subscription lives on the global StreamerStore so the sidebar badge
// and this page share one socket. The store's subscription is normally
// kicked off in AuthStore on login (gated to streamer role), but call
// it here too as a safety net for cold-start navigations.
const streamerStore = useStreamerStore();
streamerStore.subscribeToLiveStreams();
streamerStore.subscribeToGpuNodes();
const {
  liveStreams,
  hasLoaded,
  activeStreamingMatchesCount,
  maxStreams,
  isAtCapacity,
  hasGpuNode,
  hasLoadedGpuNodes,
  gpuNodeCount,
} = storeToRefs(streamerStore);

async function runMutation(
  matchId: string,
  label: string,
  build: () => Record<string, unknown>,
) {
  const state = ensureState(matchId);
  if (state.busy) return;
  state.busy = true;
  try {
    await apolloClient.mutate({
      mutation: generateMutation(build()),
    });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: label,
      description: error?.message ?? "request failed",
    });
  } finally {
    state.busy = false;
  }
}

function specClick(matchId: string, button: "left" | "right") {
  return runMutation(matchId, `spec ${button} click`, () => ({
    specClick: [{ match_id: matchId, button }, { success: true }],
  }));
}

function specJump(matchId: string) {
  return runMutation(matchId, "spec jump", () => ({
    specJump: [{ match_id: matchId }, { success: true }],
  }));
}

function specSlot(matchId: string, slot: number) {
  return runMutation(matchId, `spec slot ${slot}`, () => ({
    specSlot: [{ match_id: matchId, slot }, { success: true }],
  }));
}

const confirmStop = reactive<Record<string, boolean>>({});
function stopLive(matchId: string) {
  if (!confirmStop[matchId]) {
    confirmStop[matchId] = true;
    setTimeout(() => {
      confirmStop[matchId] = false;
    }, 5000);
    return;
  }
  confirmStop[matchId] = false;
  return runMutation(matchId, "stop live", () => ({
    stopLive: [{ match_id: matchId }, { success: true }],
  }));
}

async function setAutodirector(matchId: string, enabled: boolean) {
  // No optimistic local state — the API persists the flag on
  // match_streams.autodirector and the Hasura subscription pushes the
  // updated row back, which the template reads via isAutodirector().
  await runMutation(matchId, "spec autodirector", () => ({
    specAutodirector: [{ match_id: matchId, enabled }, { success: true }],
  }));
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

function statusBadgeLabel(stream: any) {
  if (stream.is_live) return "LIVE";
  const s = stream?.status as string | undefined;
  if (!s) return "BOOTING";
  return (STATUS_LABELS[s] ?? s.replace(/_/g, " ")).toUpperCase();
}
</script>

<template>
  <PageTransition :delay="0">
    <TacticalPageHeader>
      <template #title>Stream Deck</template>
      <template #actions>
        <!-- GPU node pill — green chip when ≥1 GPU node is enabled,
             destructive chip when none. Skipped until the subscription
             reports back so we don't render a misleading "no GPU" on
             first paint.
             Admins get a toggle that shows live per-node GPU
             telemetry below; non-admins (or no-GPU clusters) get a
             link to the nodes page. -->
        <template v-if="hasLoadedGpuNodes">
          <button
            v-if="isAdmin && hasGpuNode"
            type="button"
            :class="[
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.18em] backdrop-blur-sm transition-colors',
              showGpu
                ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))]'
                : 'border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.14)]',
            ]"
            :aria-pressed="showGpu"
            :title="
              showGpu
                ? 'Hide GPU telemetry'
                : 'Show live GPU telemetry for each GPU node'
            "
            @click="showGpu = !showGpu"
          >
            <Cpu class="size-3.5" />
            <span class="font-semibold">GPU</span>
            <span class="opacity-60">·</span>
            <span class="tabular-nums">{{ gpuNodeCount }}</span>
          </button>
          <NuxtLink
            v-else
            to="/game-server-nodes"
            :class="[
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.18em] backdrop-blur-sm transition-colors',
              hasGpuNode
                ? 'border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.14)]'
                : 'border-destructive/45 bg-destructive/10 text-destructive hover:bg-destructive/15',
            ]"
            :title="
              hasGpuNode
                ? 'One or more game-server-nodes report a GPU'
                : 'No GPU detected on any game-server-node'
            "
          >
            <Cpu class="size-3.5" />
            <span class="font-semibold">GPU</span>
            <span class="opacity-60">·</span>
            <span class="tabular-nums">{{
              hasGpuNode ? gpuNodeCount : "0"
            }}</span>
          </NuxtLink>
        </template>

        <!-- Capacity readout. Reads n / max from StreamerStore so once
             the backend exposes a real cap (gpu nodes × credentials)
             this number scales without any template change. -->
        <div
          :class="[
            'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.18em] backdrop-blur-sm',
            isAtCapacity
              ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
              : 'border-border/70 bg-card/40 text-muted-foreground',
          ]"
        >
          <span class="opacity-70">Capacity</span>
          <span class="font-semibold tabular-nums text-foreground">
            {{ activeStreamingMatchesCount }}
            <span class="opacity-40">/</span>
            {{ maxStreams }}
          </span>
          <span
            v-if="isAtCapacity"
            class="text-[0.6rem] tracking-[0.18em] text-[hsl(var(--tac-amber))]"
          >
            • Full
          </span>
        </div>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="100">
    <!-- Single root child for <Transition> — multiple siblings here
         confuse Vue's animation pass and produce a flicker / empty
         top region during the v-if swap from skeleton → cards. -->
    <div class="mt-6 space-y-4">
      <!-- No-GPU callout — game-streamer pods need a GPU node to
           schedule onto, so without one the deck can't actually
           drive a broadcast. Linked to the nodes page so the user
           can enable GPU on an existing node or add a new one. -->
      <div
        v-if="hasLoadedGpuNodes && !hasGpuNode"
        class="relative flex items-start gap-3 overflow-hidden rounded-xl border border-destructive/40 bg-destructive/5 p-4"
      >
        <div
          class="flex size-9 flex-shrink-0 items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive"
        >
          <Cpu class="size-4" />
        </div>
        <div class="min-w-0 flex-1">
          <p
            class="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-destructive flex items-center gap-2"
          >
            <CircleAlert class="size-3.5" />
            No GPU detected
          </p>
          <p class="mt-1 text-sm text-foreground/85">
            Stream Deck needs at least one game-server-node with a GPU to launch
            broadcast pods. Add a GPU to one of your nodes (or enable an
            existing GPU node) to unlock streaming.
          </p>
          <NuxtLink
            to="/game-server-nodes"
            class="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-destructive hover:underline"
          >
            Open game-server-nodes →
          </NuxtLink>
        </div>
      </div>

      <!-- Admin GPU telemetry — live utilization + memory for each
           GPU-enabled node so an operator can see at a glance whether
           a streamer pod is going to fight for VRAM/util before they
           kick off a broadcast. Hidden until the operator clicks the
           GPU pill in the header so the deck stays focused on streams
           by default. Each panel is full-width so the two charts
           inside have room to align side-by-side. -->
      <div v-if="isAdmin && showGpu && gpuNodes.length" class="space-y-4">
        <NodeGpuMetrics
          v-for="node in gpuNodes"
          :key="node.id"
          :node-id="node.id"
          :node-label="node.label || ''"
        />
      </div>

      <!-- Empty state — only after the first subscription result so
           we don't briefly flash "Off air" when streams are present. -->
      <div
        v-if="hasLoaded && liveStreams.length === 0"
        class="relative rounded-xl border border-dashed border-border/70 bg-card/30 p-10 text-center overflow-hidden"
      >
        <div
          class="pointer-events-none absolute inset-0 opacity-40"
          style="
            background-image: radial-gradient(
              circle at 50% 0%,
              hsl(var(--tac-amber) / 0.08),
              transparent 60%
            );
          "
        />
        <Radio class="mx-auto size-7 text-muted-foreground/70" />
        <p
          class="mt-3 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground"
        >
          Off air
        </p>
        <p class="mt-1 text-sm text-muted-foreground/80">
          No active game-streamer broadcasts. Start one from a match page.
        </p>
      </div>

      <!-- Stream cards -->
      <article
        v-for="stream in liveStreams"
        :key="stream.id"
        class="relative overflow-hidden rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm"
      >
        <!-- Status accent strip on the left -->
        <div
          :class="[
            'absolute inset-y-0 left-0 w-[3px]',
            stream.is_live
              ? 'bg-destructive shadow-[0_0_12px_hsl(var(--destructive)/0.7)]'
              : stream.status === 'errored'
                ? 'bg-destructive'
                : 'bg-[hsl(var(--tac-amber))] shadow-[0_0_12px_hsl(var(--tac-amber)/0.5)]',
          ]"
        />

        <div class="p-5 space-y-4">
          <!-- Header -->
          <header class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="text-base font-semibold tracking-tight truncate">
                {{ stream.match?.lineup_1?.name ?? "Team A" }}
                <span class="mx-1 text-muted-foreground/60 font-light">vs</span>
                {{ stream.match?.lineup_2?.name ?? "Team B" }}
              </h3>
            </div>

            <div class="flex items-center gap-3 flex-shrink-0">
              <div class="flex items-center gap-2">
                <Label
                  :for="`autodirector-${stream.id}`"
                  class="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Auto-director
                </Label>
                <Switch
                  :id="`autodirector-${stream.id}`"
                  :model-value="isAutodirector(stream)"
                  :disabled="
                    !stream.is_live || ensureState(stream.match_id).busy
                  "
                  @update:model-value="
                    (v: boolean) => setAutodirector(stream.match_id, v)
                  "
                />
              </div>

              <!-- Tactical control bar — segmented action group with
                 consistent mono-uppercase labels and a single shared
                 chrome. Replaces three mismatched shadcn buttons that
                 felt visually competitive. -->
              <div
                class="inline-flex items-stretch overflow-hidden rounded-md border border-border/70 bg-card/40 backdrop-blur-sm"
              >
                <!-- Control (open popout) — primary -->
                <button
                  v-if="!isPopoutOpen(stream.match_id)"
                  type="button"
                  class="group inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-foreground/90 hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))] transition-colors"
                  @click="openPopout(stream.match_id)"
                >
                  <ExternalLink class="size-3.5" />
                  Control
                </button>

                <!-- Popout open: focus + close as paired buttons -->
                <template v-else>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.1)] hover:bg-[hsl(var(--tac-amber)/0.18)] transition-colors"
                    @click="focusPopout(stream.match_id)"
                  >
                    <PictureInPicture2 class="size-3.5" />
                    In window
                  </button>
                  <div class="w-px bg-border/70" />
                  <button
                    type="button"
                    :aria-label="'Close popout'"
                    title="Close popout"
                    class="inline-flex items-center justify-center px-2.5 py-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                    @click="closePopout(stream.match_id)"
                  >
                    <X class="size-3.5" />
                  </button>
                </template>

                <div class="w-px bg-border/70" />

                <!-- Stop — armed state turns the whole button red. The
                   icon flips from outlined Square to filled-glow when
                   armed so the eye registers the change before the
                   label does. -->
                <button
                  type="button"
                  :disabled="ensureState(stream.match_id).busy"
                  :class="[
                    'inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    confirmStop[stream.match_id]
                      ? 'bg-destructive text-destructive-foreground shadow-[inset_0_0_0_1px_hsl(var(--destructive)),0_0_18px_hsl(var(--destructive)/0.5)]'
                      : 'text-destructive hover:bg-destructive/15',
                  ]"
                  @click="stopLive(stream.match_id)"
                >
                  <Square
                    :class="[
                      'size-3.5',
                      confirmStop[stream.match_id] ? 'fill-current' : '',
                    ]"
                  />
                  {{ confirmStop[stream.match_id] ? "Confirm" : "Stop" }}
                </button>
              </div>
            </div>
          </header>

          <!-- Preview + controls — same layout in every state so the
             card doesn't grow when the stream transitions
             booting → live. The video container always reserves an
             aspect-video slot; only the contents inside it swap.
             items-start (not items-stretch) so the controls column
             never forces the aspect-video container taller — when
             that happens, aspect-ratio recomputes width from the
             forced height and the video bleeds into the right column.
             Controls use self-stretch + h-full to match video height
             instead. -->
          <div
            class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start"
          >
            <div
              class="relative aspect-video w-full overflow-hidden rounded-md border border-border/60 bg-black"
            >
              <!-- Live + popout closed: actual WHEP playback -->
              <WhepPlayer
                v-if="
                  stream.is_live &&
                  whepUrlFor(stream) &&
                  !isPopoutOpen(stream.match_id)
                "
                :whep-url="whepUrlFor(stream)!"
              />

              <!-- Live + popout open: paused so the focus window owns
                 the WebRTC connection -->
              <div
                v-else-if="stream.is_live && isPopoutOpen(stream.match_id)"
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4"
              >
                <PictureInPicture2
                  class="size-7 text-[hsl(var(--tac-amber))]"
                />
                <p
                  class="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
                >
                  Playing in pop-out
                </p>
                <p class="text-xs text-muted-foreground/70 max-w-[24ch]">
                  Preview is paused here so the focus window owns the stream.
                </p>
                <button
                  type="button"
                  class="mt-1 inline-flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
                  @click="focusPopout(stream.match_id)"
                >
                  <PictureInPicture2 class="size-3" />
                  Bring window to front
                </button>
              </div>

              <!-- Booting / errored: status overlay sized to the same
                 aspect-video frame so the layout doesn't jump when
                 the stream finally goes live -->
              <div
                v-else
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4"
              >
                <p
                  :class="[
                    'inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.2em]',
                    stream.status === 'errored'
                      ? 'text-destructive'
                      : 'text-[hsl(var(--tac-amber))]',
                  ]"
                >
                  <span
                    v-if="stream.status !== 'errored'"
                    class="size-2 rounded-full bg-[hsl(var(--tac-amber))] animate-pulse"
                  />
                  {{ statusBadgeLabel(stream) }}
                </p>
                <p class="text-xs text-muted-foreground/70 max-w-[36ch]">
                  {{
                    stream.error_message ||
                    "Waiting for the game-streamer pod to come online…"
                  }}
                </p>
              </div>

              <div class="pointer-events-none absolute inset-0">
                <div
                  class="absolute top-1.5 left-1.5 size-3 border-t border-l border-[hsl(var(--tac-amber)/0.55)]"
                />
                <div
                  class="absolute top-1.5 right-1.5 size-3 border-t border-r border-[hsl(var(--tac-amber)/0.55)]"
                />
                <div
                  class="absolute bottom-1.5 left-1.5 size-3 border-b border-l border-[hsl(var(--tac-amber)/0.55)]"
                />
                <div
                  class="absolute bottom-1.5 right-1.5 size-3 border-b border-r border-[hsl(var(--tac-amber)/0.55)]"
                />
              </div>
            </div>

            <!-- self-stretch + h-full so the controls column expands to
               the video's aspect-video height (set by its left peer),
               keeping the slot-grid bottom aligned with the bottom of
               the video without forcing the video to grow. -->
            <div
              :class="[
                'flex flex-col gap-3 min-h-0 lg:h-full lg:self-stretch transition-opacity',
                !stream.is_live || isAutodirector(stream) ? 'opacity-50' : '',
              ]"
            >
              <!-- Cycle row -->
              <div>
                <span
                  class="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
                >
                  Cycle &amp; lock
                </span>
                <div class="grid grid-cols-3 gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="
                      !stream.is_live ||
                      ensureState(stream.match_id).busy ||
                      isAutodirector(stream)
                    "
                    @click="specClick(stream.match_id, 'right')"
                  >
                    <ChevronLeft class="size-4" />
                    Prev
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="
                      !stream.is_live ||
                      ensureState(stream.match_id).busy ||
                      isAutodirector(stream)
                    "
                    @click="specJump(stream.match_id)"
                  >
                    <ArrowUp class="size-4" />
                    Lock
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="
                      !stream.is_live ||
                      ensureState(stream.match_id).busy ||
                      isAutodirector(stream)
                    "
                    @click="specClick(stream.match_id, 'left')"
                  >
                    Next
                    <ChevronRight class="size-4" />
                  </Button>
                </div>
              </div>

              <!-- Slot grid — fills the remaining height of the controls
                 column so the bottom of the grid lines up with the
                 bottom of the video preview on the left. `min-h-0` on
                 the parent flex column lets this child actually shrink
                 instead of overflowing. -->
              <div class="flex flex-1 flex-col min-h-0">
                <div class="mb-1.5 flex items-center justify-between">
                  <span
                    class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    Observer target
                  </span>
                  <button
                    type="button"
                    class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] hover:underline"
                    @click="openPopout(stream.match_id)"
                  >
                    Use keyboard →
                  </button>
                </div>
                <!-- grid-cols matches per-team count so wingman shows
                   2 across, duel 1, competitive 5. The 5v5 grid
                   stretches (`flex-1` + grid-rows-2) to line its
                   bottom up with the video preview. With fewer slots
                   we cap the grid width and switch to fixed-aspect
                   tiles so a single Duel button doesn't blow up to
                   the full column width / height. -->
                <div
                  :class="[
                    'grid grid-rows-2 gap-1.5 min-h-0',
                    streamTeamSize(stream) === 5 && 'flex-1 grid-cols-5',
                    streamTeamSize(stream) === 2 && 'grid-cols-2 max-w-[40%]',
                    streamTeamSize(stream) === 1 && 'grid-cols-1 max-w-[20%]',
                  ]"
                >
                  <button
                    v-for="entry in streamSpecSlots(stream)"
                    :key="entry.slot"
                    type="button"
                    :disabled="
                      !stream.is_live ||
                      ensureState(stream.match_id).busy ||
                      isAutodirector(stream)
                    "
                    :class="[
                      'group relative rounded-md border font-mono text-base font-bold transition-all duration-100 select-none',
                      'border-border/70 bg-card/40 text-foreground/80 active:scale-95',
                      streamTeamSize(stream) !== 5 && 'aspect-[5/4]',
                      entry.team === 1
                        ? 'hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-foreground'
                        : 'hover:border-destructive/50 hover:bg-destructive/10 hover:text-foreground',
                      stream.is_live && !isAutodirector(stream)
                        ? 'cursor-pointer'
                        : 'opacity-40 cursor-not-allowed',
                    ]"
                    @click="specSlot(stream.match_id, entry.slot)"
                  >
                    <span>{{ entry.slot }}</span>
                    <span
                      class="absolute bottom-0.5 right-1 font-sans text-[0.5rem] uppercase tracking-[0.1em] text-muted-foreground/60"
                    >
                      {{ entry.key }}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  </PageTransition>
</template>
