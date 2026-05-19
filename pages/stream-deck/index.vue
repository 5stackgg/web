<script setup lang="ts">
import { reactive, computed, ref, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useApolloClient } from "@vue/apollo-composable";

const { t } = useI18n();
import { useStreamerStore } from "~/stores/StreamerStore";
import { useGpuAvailability } from "~/composables/useGpuAvailability";
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
  ArrowRightLeft,
  Play,
  Server,
  ServerOff,
  Tv,
  Dot,
  RefreshCw,
} from "lucide-vue-next";
import gql from "graphql-tag";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { e_match_status_enum } from "~/generated/zeus";
import StreamCanvas from "~/components/match/StreamCanvas.vue";
import SpectatorGrid from "~/components/stream-deck/SpectatorGrid.vue";
import { useStreamerPopout } from "~/composables/useStreamerPopout";

const { status: gpuPoolStatus, hasFreeGpu, busyReason } = useGpuAvailability();
const gpuTotal = computed(() => gpuPoolStatus.value?.total_gpu_nodes ?? 0);
const gpuFree = computed(() => gpuPoolStatus.value?.free_gpu_nodes ?? 0);
const gpuPoolReady = computed(() => gpuPoolStatus.value !== null);

const {
  isOpen: isPopoutOpen,
  openPopout,
  focusPopout,
  closePopout,
} = useStreamerPopout();

definePageMeta({
  middleware: "streamer",
});

const { toast } = useToast();
const { client: apolloClient } = useApolloClient();

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

// Subscription lives on the global StreamerStore so the sidebar badge
// and this page share one socket. The store's subscription is normally
// kicked off in AuthStore on login (gated to streamer role), but call
// it here too as a safety net for cold-start navigations.
const streamerStore = useStreamerStore();
streamerStore.subscribeToLiveStreams();
const {
  liveStreams,
  hasLoaded,
  activeStreamingMatchesCount,
  maxStreams,
  isAtCapacity,
} = storeToRefs(streamerStore);

// Live matches board — every match the deck can target. Kept on the
// page (not in the store) because nothing else needs it; one socket,
// one consumer. The `streams` aggregate lets each tile know whether
// it's the one the active pod is bound to without a second join.
type LiveMatchMap = {
  id: string;
  lineup_1_score: number;
  lineup_2_score: number;
  is_current_map?: boolean | null;
  map: { name: string | null } | null;
};

type LiveMatch = {
  id: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  current_match_map_id: string | null;
  server_id: string | null;
  is_server_online: boolean | null;
  server_region: string | null;
  options: { type: string | null } | null;
  lineup_1: { id: string; name: string | null } | null;
  lineup_2: { id: string; name: string | null } | null;
  match_maps: LiveMatchMap[];
};

const liveMatches = ref<LiveMatch[]>([]);
const liveMatchesLoaded = ref(false);
let liveMatchesSub: { unsubscribe: () => void } | undefined;

onMounted(() => {
  liveMatchesSub = apolloClient
    .subscribe({
      query: generateSubscription({
        matches: [
          {
            where: {
              status: {
                _in: [
                  e_match_status_enum.Live,
                  e_match_status_enum.Veto,
                  e_match_status_enum.WaitingForServer,
                  e_match_status_enum.WaitingForCheckIn,
                ],
              },
            } as any,
          },
          {
            id: true,
            status: true,
            scheduled_at: true,
            started_at: true,
            current_match_map_id: true,
            // Computed fields, not the `server` join — guest's filter
            // on `servers` requires connection_string IS NOT NULL,
            // which hides assigned-but-not-yet-connected servers.
            server_id: true,
            is_server_online: true,
            server_region: true,
            options: { type: true },
            lineup_1: { id: true, name: true },
            lineup_2: { id: true, name: true },
            // Pull match_maps (small list — usually 1–5 rows per Bo)
            // and pick the live one client-side via
            // current_match_map_id. Cheaper than re-deriving
            // is_current_map on the server, which is a computed
            // function call per row.
            match_maps: [
              {},
              {
                id: true,
                lineup_1_score: true,
                lineup_2_score: true,
                map: { name: true },
              },
            ],
          },
        ],
      }),
    })
    .subscribe({
      next: ({ data }: any) => {
        liveMatches.value = (data?.matches ?? []) as LiveMatch[];
        liveMatchesLoaded.value = true;
      },
      error: (err: any) => {
        // eslint-disable-next-line no-console
        console.error("[stream-deck] live matches subscription error", err);
      },
    });
});

onBeforeUnmount(() => {
  liveMatchesSub?.unsubscribe();
});

// Map match_id → active stream row for quick tile lookup. Multiple
// rows on a single match are not currently produced by the api, but
// .find() vs .reduce() costs nothing here and is robust to drift.
const streamByMatchId = computed(() => {
  const out: Record<string, any> = {};
  for (const s of liveStreams.value) {
    if (s?.match_id) out[s.match_id] = s;
  }
  return out;
});

const activeStream = computed(() => liveStreams.value[0] ?? null);
const activeMatchId = computed(() => activeStream.value?.match_id ?? null);

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

async function startLive(matchId: string, mode: "live" | "tv") {
  await runMutation(matchId, "start live", () => ({
    startLive: [{ match_id: matchId, mode }, { success: true }],
  }));
}

async function reconnectLive(matchId: string) {
  await runMutation(matchId, "reconnect", () => ({
    reconnectLive: [{ match_id: matchId }, { success: true }],
  }));
  toast({
    title: t("toasts.reconnecting"),
    description: t("toasts.reconnecting_description"),
  });
}

type DeckReady = {
  ready: boolean;
  reason: string | null;
};
function deckReadiness(m: LiveMatch): DeckReady {
  if (m.status !== "Live") {
    return {
      ready: false,
      reason: t("stream_deck.match_status_wait", {
        status: m.status.toLowerCase(),
      }),
    };
  }
  if (!m.server_id) {
    return { ready: false, reason: t("stream_deck.no_server_assigned") };
  }
  if (m.is_server_online !== true) {
    return {
      ready: false,
      reason: t("stream_deck.server_offline_waiting"),
    };
  }
  return { ready: true, reason: null };
}

function serverLabel(m: LiveMatch): string {
  if (!m.server_id) return t("stream_deck.no_server");
  return m.server_region || t("stream_deck.server_assigned");
}

// Hot-swap: keep the running pod, point it at a different match.
// Hand-written gql tag because the mutation isn't in the generated
// zeus types yet (regen Hasura metadata to pick it up). Done this way
// so the page compiles without forcing a codegen step first.
const SWITCH_LIVE_MATCH_MUTATION = gql`
  mutation SwitchLiveMatch(
    $from_match_id: uuid!
    $to_match_id: uuid!
    $mode: String!
  ) {
    switchLiveMatch(
      from_match_id: $from_match_id
      to_match_id: $to_match_id
      mode: $mode
    ) {
      success
    }
  }
`;

const switching = ref<string | null>(null);
async function switchTo(toMatchId: string, mode: "live" | "tv" = "live") {
  const target = liveMatches.value.find((m) => m.id === toMatchId);
  if (target) {
    const { ready, reason } = deckReadiness(target);
    if (!ready) {
      toast({
        variant: "destructive",
        title: t("toasts.cant_switch"),
        description: reason ?? t("toasts.destination_not_ready"),
      });
      return;
    }
  }
  const fromMatchId = activeMatchId.value;
  if (!fromMatchId) {
    await startLive(toMatchId, mode);
    return;
  }
  if (fromMatchId === toMatchId) return;
  if (switching.value) return;
  switching.value = toMatchId;
  try {
    await apolloClient.mutate({
      mutation: SWITCH_LIVE_MATCH_MUTATION,
      variables: {
        from_match_id: fromMatchId,
        to_match_id: toMatchId,
        mode,
      },
    });
    toast({
      title: t("toasts.stream_switched"),
      description: t("toasts.stream_switched_description"),
    });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("toasts.switch_failed"),
      description: error?.message ?? t("toasts.request_failed"),
    });
  } finally {
    switching.value = null;
  }
}

const STATUS_LABELS = computed<Record<string, string>>(() => ({
  launching_steam: t("live_stages.launching_steam"),
  logging_in: t("live_stages.logging_in"),
  downloading_cs2: t("live_stages.downloading_cs2"),
  launching_cs2: t("live_stages.launching_cs2"),
  connecting_to_game: t("stream_deck_status.connecting_to_game_short"),
  starting_capture: t("stream_deck_status.starting_capture"),
  errored: t("stream_deck_status.errored"),
  live: t("stream_deck_status.live_short"),
}));

// Stage list mirrors run-live.sh + setup-steam.sh report_status emits.
// `meta` controls non-emission rendering (see StreamSessionProgress).
const LIVE_STAGES = computed(() => [
  {
    key: "booting",
    label: t("live_stages.booting"),
    meta: "required" as const,
  },
  {
    key: "downloading_cs2",
    label: t("live_stages.downloading_cs2"),
    meta: "conditional" as const,
  },
  {
    key: "launching_steam",
    label: t("live_stages.launching_steam"),
    meta: "required" as const,
  },
  {
    key: "logging_in",
    label: t("live_stages.logging_in"),
    meta: "implicit" as const,
  },
  {
    key: "launching_cs2",
    label: t("live_stages.launching_cs2"),
    meta: "required" as const,
  },
  {
    key: "connecting_to_game",
    label: t("live_stages.connecting_to_game"),
    meta: "required" as const,
  },
  { key: "live", label: t("live_stages.live"), meta: "required" as const },
]);

function statusBadgeLabel(stream: any) {
  if (stream.is_live) return t("stream_deck_status.live");
  const s = stream?.status as string | undefined;
  if (!s) return t("stream_deck_status.booting");
  return (STATUS_LABELS.value[s] ?? s.replace(/_/g, " ")).toUpperCase();
}

// Tile helpers — keep template terse.
function matchStatusLabel(m: LiveMatch): string {
  if (m.status === "Live") return t("stream_deck_status.live");
  if (m.status === "Veto") return t("stream_deck_status.veto");
  if (m.status === "WaitingForServer")
    return t("stream_deck_status.spinning_up");
  if (m.status === "WaitingForCheckIn") return t("stream_deck_status.check_in");
  return m.status.toUpperCase();
}

// Resolve the live map for a tile. Prefers current_match_map_id (set
// by the server while a map is actively running); falls back to the
// last map with any non-zero score so a paused/just-finished match
// still shows the latest scoreline instead of "vs".
function currentMapFor(m: LiveMatch): LiveMatchMap | null {
  if (!m.match_maps?.length) return null;
  if (m.current_match_map_id) {
    const found = m.match_maps.find((mm) => mm.id === m.current_match_map_id);
    if (found) return found;
  }
  const scored = [...m.match_maps]
    .reverse()
    .find((mm) => (mm.lineup_1_score ?? 0) + (mm.lineup_2_score ?? 0) > 0);
  return scored ?? null;
}

function scoreFor(m: LiveMatch): { l: number; r: number } | null {
  const cm = currentMapFor(m);
  if (!cm) return null;
  return { l: cm.lineup_1_score ?? 0, r: cm.lineup_2_score ?? 0 };
}

function currentMapName(m: LiveMatch): string | null {
  return currentMapFor(m)?.map?.name ?? null;
}
</script>

<template>
  <PageTransition :delay="0">
    <TacticalPageHeader>
      <template #title>Stream Deck</template>
      <template #actions>
        <NuxtLink
          v-if="gpuPoolReady"
          to="/gpu-nodes"
          :class="[
            'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.18em] backdrop-blur-sm transition-colors',
            gpuTotal === 0
              ? 'border-destructive/45 bg-destructive/10 text-destructive hover:bg-destructive/15'
              : !hasFreeGpu
                ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.22)]'
                : 'border-emerald-700/45 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15',
          ]"
          :title="busyReason || 'GPU pool — open the GPU Nodes page'"
        >
          <Cpu class="size-3.5" />
          <span class="font-semibold">GPU</span>
          <span class="opacity-60">·</span>
          <span class="tabular-nums">{{ gpuFree }}/{{ gpuTotal }}</span>
        </NuxtLink>

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
    <div class="mt-6 space-y-8">
      <!-- ============ ON-AIR (active stream) ============ -->
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
          {{ $t("stream_deck.off_air") }}
        </p>
        <p class="mt-1 text-sm text-muted-foreground/80">
          No active game-streamer broadcast. Pick a live match below to take
          over a GPU and start streaming.
        </p>
      </div>

      <!-- Stream cards (existing design — kept intact) -->
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
            <div class="min-w-0 flex items-center gap-3">
              <span
                v-if="stream.is_live"
                class="inline-flex items-center gap-1.5 rounded-sm border border-destructive/60 bg-destructive/15 px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.22em] text-destructive"
              >
                <span
                  class="size-1.5 rounded-full bg-destructive shadow-[0_0_8px_hsl(var(--destructive))] animate-ping-slow"
                />
                {{ $t("stream_deck.on_air") }}
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
              >
                <span
                  class="size-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
                />
                {{ statusBadgeLabel(stream) }}
              </span>
              <h3 class="text-base font-semibold tracking-tight truncate">
                {{ stream.match?.lineup_1?.name ?? $t("common.team_a") }}
                <span class="mx-1 text-muted-foreground/60 font-light">vs</span>
                {{ stream.match?.lineup_2?.name ?? $t("common.team_b") }}
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
                  {{ $t("stream_deck.control") }}
                </button>

                <!-- Popout open: focus + close as paired buttons -->
                <template v-else>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.1)] hover:bg-[hsl(var(--tac-amber)/0.18)] transition-colors"
                    @click="focusPopout(stream.match_id)"
                  >
                    <PictureInPicture2 class="size-3.5" />
                    {{ $t("stream_deck.in_window") }}
                  </button>
                  <div class="w-px bg-border/70" />
                  <button
                    type="button"
                    :aria-label="$t('ui.close_popout')"
                    :title="$t('ui.close_popout')"
                    class="inline-flex items-center justify-center px-2.5 py-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                    @click="closePopout(stream.match_id)"
                  >
                    <X class="size-3.5" />
                  </button>
                </template>

                <div class="w-px bg-border/70" />

                <button
                  type="button"
                  :disabled="
                    ensureState(stream.match_id).busy || !stream.is_live
                  "
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-foreground/80 hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  :title="$t('replay_extras.reissue_connect')"
                  @click="reconnectLive(stream.match_id)"
                >
                  <RefreshCw class="size-3.5" />
                  {{ $t("stream_deck.reconnect") }}
                </button>

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
            class="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start"
          >
            <StreamCanvas
              :stream="stream"
              :is-live="!!stream.is_live"
              :stages="LIVE_STAGES"
              header-label="Stream boot"
              :show-boot="true"
              class="aspect-video w-full overflow-hidden rounded-md border border-border/60"
            >
              <template
                v-if="stream.is_live && isPopoutOpen(stream.match_id)"
                #video
              >
                <div
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
                    {{ $t("stream_deck.bring_window_to_front") }}
                  </button>
                </div>
              </template>
            </StreamCanvas>

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

              <!-- Observer target — same CT/T grid driven by GSI as the
                 focus popout. cs2 itself decides who's on which side at
                 halftime + every OT swap, so labels and click targets
                 stay in lockstep with what the broadcast is actually
                 rendering. `min-h-0` on the parent flex column lets
                 this section shrink instead of overflowing. -->
              <div class="flex flex-1 flex-col min-h-0">
                <div class="mb-1.5 flex items-center justify-between">
                  <span
                    class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    {{ $t("stream_deck.observer_target") }}
                  </span>
                  <button
                    type="button"
                    class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] hover:underline"
                    @click="openPopout(stream.match_id)"
                  >
                    Use keyboard →
                  </button>
                </div>
                <SpectatorGrid
                  :match-id="stream.match_id"
                  :is-live="!!stream.is_live"
                  :match-type="stream.match?.options?.type"
                  :controls-active="
                    !!stream.is_live &&
                    !ensureState(stream.match_id).busy &&
                    !isAutodirector(stream)
                  "
                  compact
                  @press-slot="
                    (slot: number) => specSlot(stream.match_id, slot)
                  "
                />
              </div>
            </div>
          </div>
        </div>
      </article>

      <!-- ============ LIVE MATCHES BOARD ============ -->
      <!-- Multi-tile board of every live match the deck can target. A
           click on a non-active tile either:
             • starts a fresh stream (no pod up), or
             • calls switchLiveMatch (pod up, swap match in place).
           The active tile keeps a glow + "Bound" badge so the operator
           always knows which match is currently consuming the GPU. -->
      <section>
        <div class="flex items-end justify-between gap-3 mb-3 px-px">
          <div class="flex items-baseline gap-3">
            <h2
              class="font-mono text-[0.7rem] font-bold uppercase tracking-[0.28em] text-foreground"
            >
              {{ $t("stream_deck.live_matches") }}
            </h2>
            <span
              class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground tabular-nums"
            >
              {{ liveMatches.length }}
              {{ liveMatches.length === 1 ? "match" : "matches" }}
            </span>
          </div>
          <span
            v-if="activeStream"
            class="hidden sm:inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <ArrowRightLeft class="size-3" />
            {{ $t("stream_deck.click_another_match") }}
          </span>
        </div>

        <!-- Empty list — loaded but nothing live. -->
        <div
          v-if="liveMatchesLoaded && liveMatches.length === 0"
          class="rounded-xl border border-dashed border-border/60 bg-card/20 p-8 text-center"
        >
          <p
            class="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("stream_deck.no_live_matches") }}
          </p>
          <p class="mt-1 text-sm text-muted-foreground/70">
            Tiles will appear here as soon as a match goes Live.
          </p>
        </div>

        <div
          v-else
          class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 [grid-auto-rows:1fr]"
        >
          <article
            v-for="m in liveMatches"
            :key="m.id"
            :class="[
              'group relative overflow-hidden rounded-lg border bg-card/35 backdrop-blur-sm transition-all duration-200 flex flex-col',
              activeMatchId === m.id
                ? 'border-destructive/60 shadow-[0_0_0_1px_hsl(var(--destructive)/0.35),0_0_28px_-4px_hsl(var(--destructive)/0.5)]'
                : switching === m.id
                  ? 'border-[hsl(var(--tac-amber)/0.7)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.35),0_0_24px_-4px_hsl(var(--tac-amber)/0.55)]'
                  : 'border-border/70 hover:border-[hsl(var(--tac-amber)/0.55)] hover:bg-card/50',
            ]"
          >
            <!-- Diagonal hatch background on the active tile — quiet
                 broadcast-cue, only visible at this size. -->
            <div
              v-if="activeMatchId === m.id"
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 opacity-[0.07]"
              :style="{
                backgroundImage:
                  'repeating-linear-gradient(135deg, hsl(var(--destructive)) 0 2px, transparent 2px 10px)',
              }"
            />

            <!-- Top row: status + map -->
            <div
              class="relative flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2"
            >
              <span
                :class="[
                  'inline-flex items-center gap-1.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.22em]',
                  m.status === 'Live'
                    ? 'text-destructive'
                    : 'text-[hsl(var(--tac-amber))]',
                ]"
              >
                <span
                  :class="[
                    'size-1.5 rounded-full',
                    m.status === 'Live'
                      ? 'bg-destructive shadow-[0_0_6px_hsl(var(--destructive))]'
                      : 'bg-[hsl(var(--tac-amber))]',
                  ]"
                />
                {{ matchStatusLabel(m) }}
              </span>

              <span
                v-if="currentMapName(m)"
                class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground truncate"
                :title="currentMapName(m)!"
              >
                {{ currentMapName(m) }}
              </span>
            </div>

            <!-- Middle: lineup names + score. Score is the visual
                 anchor — tabular nums + big type so the eye lands
                 there first when scanning tiles. -->
            <div class="flex flex-1 flex-col justify-center px-4 py-3">
              <div
                class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 min-w-0"
              >
                <div class="min-w-0 text-right">
                  <p class="truncate text-sm font-semibold leading-snug">
                    {{ m.lineup_1?.name ?? $t("common.team_a") }}
                  </p>
                </div>

                <div
                  v-if="scoreFor(m)"
                  class="flex items-baseline gap-2 font-mono tabular-nums"
                >
                  <span
                    :class="[
                      'text-2xl font-bold leading-none',
                      scoreFor(m)!.l > scoreFor(m)!.r
                        ? 'text-foreground'
                        : 'text-muted-foreground/80',
                    ]"
                  >
                    {{ scoreFor(m)!.l }}
                  </span>
                  <span class="text-xs text-muted-foreground/50">·</span>
                  <span
                    :class="[
                      'text-2xl font-bold leading-none',
                      scoreFor(m)!.r > scoreFor(m)!.l
                        ? 'text-foreground'
                        : 'text-muted-foreground/80',
                    ]"
                  >
                    {{ scoreFor(m)!.r }}
                  </span>
                </div>
                <div
                  v-else
                  class="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground/60"
                >
                  vs
                </div>

                <div class="min-w-0 text-left">
                  <p class="truncate text-sm font-semibold leading-snug">
                    {{ m.lineup_2?.name ?? $t("common.team_b") }}
                  </p>
                </div>
              </div>

              <div
                :class="[
                  'mt-2 flex items-center justify-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em]',
                  !m.server_id
                    ? 'text-destructive/80'
                    : m.is_server_online
                      ? 'text-emerald-500/80'
                      : 'text-[hsl(var(--tac-amber))]/80',
                ]"
              >
                <component
                  :is="!m.server_id ? ServerOff : Server"
                  class="size-3 opacity-70"
                />
                <span class="truncate max-w-[20ch]">
                  {{ serverLabel(m) }}
                  <template v-if="m.server_id && !m.is_server_online">
                    · offline
                  </template>
                </span>
              </div>
            </div>

            <!-- CTA row — what action this tile triggers depends on
                 whether it owns the active stream and whether any pod
                 is up at all. Keeps the affordance unambiguous:
                   ON AIR  → "Open controls"
                   ELSE if pod up → "Switch stream here"
                   ELSE          → "Start"  (live + tv split)
            -->
            <div
              class="relative border-t border-border/50 bg-background/30 px-3 py-2"
            >
              <!-- Case 1: this tile IS the active stream -->
              <NuxtLink
                v-if="activeMatchId === m.id"
                :to="`/stream-deck/${m.id}`"
                class="inline-flex w-full items-center justify-center gap-2 rounded-md border border-destructive/55 bg-destructive/12 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-destructive hover:bg-destructive/18 transition-colors"
              >
                <Dot class="size-4" />
                {{ $t("stream_deck.open_broadcast_controls") }}
              </NuxtLink>

              <button
                v-else-if="activeStream"
                type="button"
                :disabled="
                  !!switching ||
                  ensureState(m.id).busy ||
                  !deckReadiness(m).ready
                "
                :class="[
                  'group/cta inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
                  switching === m.id
                    ? 'border-[hsl(var(--tac-amber)/0.7)] bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                    : 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] hover:border-[hsl(var(--tac-amber)/0.75)]',
                ]"
                :title="
                  deckReadiness(m).reason ||
                  `Reuse the running pod and switch the broadcast to ${m.lineup_1?.name ?? 'Team A'} vs ${m.lineup_2?.name ?? 'Team B'}`
                "
                @click="switchTo(m.id, 'live')"
              >
                <ArrowRightLeft
                  :class="[
                    'size-3.5 transition-transform',
                    switching === m.id
                      ? 'animate-pulse'
                      : 'group-hover/cta:translate-x-0.5',
                  ]"
                />
                <template v-if="switching === m.id">{{
                  $t("stream_deck_extras.switching")
                }}</template>
                <template v-else-if="!deckReadiness(m).ready">
                  {{
                    !m.server_id
                      ? $t("stream_deck_extras.no_server")
                      : m.status !== "Live"
                        ? $t("stream_deck_extras.not_live_yet")
                        : $t("stream_deck_extras.server_offline")
                  }}
                </template>
                <template v-else>{{
                  $t("stream_deck_extras.switch_stream_here")
                }}</template>
              </button>

              <div v-else class="flex gap-1.5">
                <button
                  type="button"
                  :disabled="
                    ensureState(m.id).busy ||
                    !hasFreeGpu ||
                    gpuTotal === 0 ||
                    !deckReadiness(m).ready
                  "
                  class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  :title="
                    deckReadiness(m).reason ||
                    (!hasFreeGpu
                      ? busyReason || 'No free GPU'
                      : 'Start a live stream')
                  "
                  @click="startLive(m.id, 'live')"
                >
                  <Play class="size-3.5" />
                  Live
                </button>
                <button
                  type="button"
                  :disabled="
                    ensureState(m.id).busy ||
                    !hasFreeGpu ||
                    gpuTotal === 0 ||
                    !deckReadiness(m).ready
                  "
                  class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  :title="
                    deckReadiness(m).reason ||
                    (!hasFreeGpu
                      ? busyReason || 'No free GPU'
                      : 'Start a delayed TV stream')
                  "
                  @click="startLive(m.id, 'tv')"
                >
                  <Tv class="size-3.5" />
                  TV
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  </PageTransition>
</template>

<style scoped>
/* Slow ping for the ON AIR dot — distinct from animate-ping which
   is too aggressive for an always-on broadcast badge. Mirrors the
   game-server-node indicator cadence. */
@keyframes ping-slow {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.45);
    opacity: 0.55;
  }
}
.animate-ping-slow {
  animation: ping-slow 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
