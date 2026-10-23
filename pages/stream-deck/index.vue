<script setup lang="ts">
import {
  reactive,
  computed,
  ref,
  shallowRef,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Square,
  ExternalLink,
  PictureInPicture2,
  X,
  Cpu,
  Play,
  Radio,
  Tv,
  RefreshCw,
  Bot,
} from "lucide-vue-next";
import { useStreamerStore } from "~/stores/StreamerStore";
import { useGpuAvailability } from "~/composables/useGpuAvailability";
import { useStreamerPopout } from "~/composables/useStreamerPopout";
import {
  useWhepStatusCopy,
  type WhepPhase,
} from "~/composables/useWhepStatusCopy";
import { useToast } from "~/components/ui/toast/use-toast";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import StreamCanvas from "~/components/match/StreamCanvas.vue";
import StreamMatchCard from "~/components/match/StreamMatchCard.vue";
import StreamStatusPanel from "~/components/match/StreamStatusPanel.vue";
import StreamBootStatus from "~/components/match/StreamBootStatus.vue";
import StreamLiveTag from "~/components/match/StreamLiveTag.vue";
import SpectatorGrid from "~/components/stream-deck/SpectatorGrid.vue";
import ControlRoomPreview from "~/components/stream-deck/ControlRoomPreview.vue";
import StopBroadcastDialog from "~/components/stream-deck/StopBroadcastDialog.vue";
import OnAirClock from "~/components/stream-deck/OnAirClock.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import { TONE_BORDER, TONE_TEXT, type Tone } from "~/components/admin/tone";
import { useRememberedView } from "~/composables/useRememberedView";
import { useListKeyboard } from "~/composables/useListKeyboard";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { e_match_status_enum } from "~/generated/zeus";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import {
  createButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  defaultPreview,
  sortPreviews,
  takeBlock,
  takeMode,
  wentLiveAt,
  type TakeBlock,
} from "~/utilities/controlRoom";

definePageMeta({
  middleware: "streamer",
});

const { t, te } = useI18n();
const { toast } = useToast();
const { client: apolloClient } = useApolloClient();
const { copyFor } = useWhepStatusCopy();

const {
  status: gpuPoolStatus,
  hasFreeGpu,
  busyReason,
} = useGpuAvailability("streaming");
const gpuTotal = computed(() => gpuPoolStatus.value?.total_gpu_nodes ?? 0);
const gpuFree = computed(() => gpuPoolStatus.value?.free_gpu_nodes ?? 0);
const gpuPoolReady = computed(() => gpuPoolStatus.value !== null);

const {
  isOpen: isPopoutOpen,
  openPopout,
  focusPopout,
  closePopout,
} = useStreamerPopout();

// `busy` is the only control state kept locally -- autodirector lives on the
// match_streams row and rides the subscription, so every caster on the match
// sees the same toggle.
type MatchControlState = {
  busy: boolean;
  action?: string;
};
const controlState = reactive<Record<string, MatchControlState>>({});

function ensureState(matchId: string): MatchControlState {
  if (!controlState[matchId]) {
    controlState[matchId] = { busy: false };
  }
  return controlState[matchId];
}

// Read-only for templates: ensureState() writes, which is illegal during
// render. Reading controlState[id] still tracks the key.
function cs(matchId: string): MatchControlState {
  return controlState[matchId] ?? { busy: false };
}

// Defaults to on, like the cs2 autoexec the pod launches with.
function isAutodirector(stream: any): boolean {
  return stream?.autodirector !== false;
}

// One socket shared with the nav badge (StreamerStore).
const streamerStore = useStreamerStore();
streamerStore.subscribeToLiveStreams();
const {
  liveStreams,
  hasLoaded,
  activeStreamingMatchesCount,
  maxStreams,
  isAtCapacity,
} = storeToRefs(streamerStore);

type LiveMatch = {
  id: string;
  status: string;
  current_match_map_id: string | null;
  server_id: string | null;
  is_server_online: boolean | null;
  server_region: string | null;
  is_in_lineup?: boolean | null;
  is_coach?: boolean | null;
  match_maps: any[];
  lineup_1: { id: string; name: string | null } | null;
  lineup_2: { id: string; name: string | null } | null;
  [key: string]: any;
};

// shallowRef: the subscription replaces the whole list every push.
const liveMatches = shallowRef<LiveMatch[]>([]);
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
            ...simpleMatchFields,
            current_match_map_id: true,
            // Computed fields, not the `server` join: guest's filter on
            // `servers` hides assigned-but-not-yet-connected servers.
            server_id: true,
            is_server_online: true,
            server_region: true,
            // Anti-cheat: a rostered player/coach must never see the feed of
            // a match they're in.
            is_in_lineup: true,
            is_coach: true,
          },
        ],
      }),
    })
    .subscribe({
      next: ({ data }: any) => {
        // Hasura pushes the whole list on any change. Keep the old object for
        // rows that didn't change so their tiles skip re-rendering.
        const incoming = (data?.matches ?? []) as LiveMatch[];
        const prevById = new Map(liveMatches.value.map((m) => [m.id, m]));
        liveMatches.value = incoming.map((m) => {
          const prev = prevById.get(m.id);
          return prev && JSON.stringify(prev) === JSON.stringify(m) ? prev : m;
        });
        liveMatchesLoaded.value = true;
      },
      error: (err: any) => {
        console.error("[control-room] live matches subscription error", err);
      },
    });
});

onBeforeUnmount(() => {
  liveMatchesSub?.unsubscribe();
});

const activeStream = computed(() => liveStreams.value[0] ?? null);
const activeMatchId = computed<string | null>(
  () => activeStream.value?.match_id ?? null,
);
const onAirIds = computed(
  () =>
    new Set<string>(
      liveStreams.value.map((s: any) => s.match_id).filter(Boolean),
    ),
);
const isLive = computed(() => !!activeStream.value?.is_live);
const isErrored = computed(() => activeStream.value?.status === "errored");

const blockedMatchIds = computed(() => {
  const out = new Set<string>();
  for (const m of liveMatches.value) {
    if (m.is_in_lineup || m.is_coach) out.add(m.id);
  }
  return out;
});
const canViewProgram = computed(
  () => !activeMatchId.value || !blockedMatchIds.value.has(activeMatchId.value),
);

function nameOf(
  m: {
    lineup_1?: { name?: string | null } | null;
    lineup_2?: { name?: string | null } | null;
  } | null,
): string {
  return `${m?.lineup_1?.name ?? t("common.team_a")} ${t("common.vs")} ${m?.lineup_2?.name ?? t("common.team_b")}`;
}

const programName = computed(() =>
  activeStream.value ? nameOf(activeStream.value.match) : "",
);

const stageLabel = computed(() => {
  const s = activeStream.value?.status as string | undefined;
  if (!s) return t("live_stages.booting");
  return te(`live_stages.${s}`) ? t(`live_stages.${s}`) : s;
});

const liveSince = computed(() => wentLiveAt(activeStream.value));

function onAirStateFor(
  matchId: string,
): "live" | "starting" | "stopped" | null {
  const s = liveStreams.value.find((x: any) => x.match_id === matchId);
  if (!s) return null;
  if (s.is_live) return "live";
  return s.status === "errored" ? "stopped" : "starting";
}

const previews = computed(() =>
  sortPreviews(liveMatches.value, onAirIds.value),
);

// ---- Preview selection + take ----
// The picked preview survives a refresh while that match is still live.
const view = useRememberedView(
  "control-room",
  { selected: null as string | null },
  { validate: { selected: (v) => v === null || typeof v === "string" } },
);
const selectedId = ref<string | null>(view.selected);
watch(selectedId, (id) => (view.selected = id));
watch(
  [liveMatches, onAirIds],
  () => {
    // Before the first push the remembered pick has nothing to match.
    if (!liveMatchesLoaded.value) return;
    if (
      selectedId.value &&
      !onAirIds.value.has(selectedId.value) &&
      liveMatches.value.some((m) => m.id === selectedId.value)
    ) {
      return;
    }
    selectedId.value = defaultPreview(liveMatches.value, onAirIds.value);
  },
  { immediate: true },
);
const selectedMatch = computed(
  () => liveMatches.value.find((m) => m.id === selectedId.value) ?? null,
);
const canTake = computed(() =>
  liveMatches.value.some((m) => !onAirIds.value.has(m.id)),
);
const mode = computed(() => takeMode(!!activeStream.value, isAtCapacity.value));
const block = computed<TakeBlock | null>(() =>
  selectedMatch.value
    ? takeBlock({
        match: selectedMatch.value,
        mode: mode.value,
        gpuTotal: gpuTotal.value,
        gpuPoolReady: gpuPoolReady.value,
        hasFreeGpu: hasFreeGpu.value,
        atCapacity: isAtCapacity.value,
      })
    : null,
);

// ↑/↓ walk the previews, Enter picks one (the same as a click).
const activePreviewId = ref<string | null>(null);
const { rowProps } = useListKeyboard({
  items: previews,
  getId: (m: LiveMatch) => m.id,
  activeId: activePreviewId,
  onOpen: (id) => {
    if (onAirIds.value.has(id)) {
      void navigateTo(`/matches/${id}`);
      return;
    }
    selectedId.value = id;
  },
});
// A preview is a toggle button: aria-pressed says it's picked, so the
// listbox-style aria-selected stays off it.
function previewRowProps(id: string) {
  const props: Record<string, unknown> = { ...rowProps(id) };
  delete props["aria-selected"];
  return props;
}

function blockText(reason: TakeBlock): string {
  if (reason === "no_free_gpu") {
    return busyReason.value || t("pages.control_room.reasons.no_free_gpu");
  }
  return t(`pages.control_room.reasons.${reason}`);
}

// `action` is a stable id, not copy: it picks the toast title.
async function runMutation(
  matchId: string,
  action: string,
  build: () => Record<string, unknown>,
  params?: Record<string, unknown>,
): Promise<boolean> {
  const state = ensureState(matchId);
  if (state.busy) return false;
  state.busy = true;
  state.action = action;
  try {
    await apolloClient.mutate({ mutation: generateMutation(build()) });
    return true;
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t(`stream_deck.actions.${action}`, params ?? {}),
      description: error?.message ?? t("toasts.request_failed"),
    });
    return false;
  } finally {
    state.busy = false;
    state.action = undefined;
  }
}

function specClick(matchId: string, button: "left" | "right") {
  return runMutation(
    matchId,
    "spec_click",
    () => ({
      specClick: [{ match_id: matchId, button }, { success: true }],
    }),
    { button },
  );
}

async function setAutodirector(matchId: string, enabled: boolean) {
  await runMutation(matchId, "spec_autodirector", () => ({
    specAutodirector: [{ match_id: matchId, enabled }, { success: true }],
  }));
}

async function specSlot(matchId: string, slot: number) {
  const stream = liveStreams.value.find((s: any) => s.match_id === matchId);
  if (stream && isAutodirector(stream)) {
    await setAutodirector(matchId, false);
  }
  return runMutation(
    matchId,
    "spec_slot",
    () => ({
      specSlot: [{ match_id: matchId, slot }, { success: true }],
    }),
    { slot },
  );
}

async function startLive(matchId: string, streamMode: "live" | "tv") {
  const match = liveMatches.value.find((m) => m.id === matchId);
  const started = await runMutation(matchId, "start_live", () => ({
    startLive: [{ match_id: matchId, mode: streamMode }, { success: true }],
  }));
  if (started) {
    toast({
      title: t(
        streamMode === "tv"
          ? "pages.control_room.started_tv"
          : "pages.control_room.started_live",
        { match: nameOf(match ?? null) },
      ),
    });
  }
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

const skippingShaders = ref<Record<string, boolean>>({});
async function onSkipShaders(matchId: string) {
  if (skippingShaders.value[matchId]) return;
  skippingShaders.value = { ...skippingShaders.value, [matchId]: true };
  try {
    await runMutation(matchId, "skip_shaders", () => ({
      skipShaders: [{ match_id: matchId }, { success: true }],
    }));
  } finally {
    skippingShaders.value = { ...skippingShaders.value, [matchId]: false };
  }
}

const stopOpen = ref(false);
async function stopProgram() {
  const id = activeMatchId.value;
  if (!id) return;
  const stopped = await runMutation(id, "stop_live", () => ({
    stopLive: [{ match_id: id }, { success: true }],
  }));
  if (stopped) {
    toast({ title: t("pages.control_room.stopped") });
  }
}

// Hot swap: keep the running pod, point it at another match. Hand-written
// gql because the mutation isn't in the generated zeus types yet.
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
async function switchTo(toMatchId: string) {
  const fromMatchId = activeMatchId.value;
  if (!fromMatchId) {
    await startLive(toMatchId, "live");
    return;
  }
  if (fromMatchId === toMatchId || switching.value) return;
  switching.value = toMatchId;
  try {
    await apolloClient.mutate({
      mutation: SWITCH_LIVE_MATCH_MUTATION,
      variables: {
        from_match_id: fromMatchId,
        to_match_id: toMatchId,
        mode: activeStream.value?.mode === "tv" ? "tv" : "live",
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

function take() {
  const match = selectedMatch.value;
  if (!match || block.value) return;
  return mode.value === "switch"
    ? switchTo(match.id)
    : startLive(match.id, "live");
}

// The program pauses its own player while the focus window shows the same
// stream: two WebRTC players double upstream bandwidth.
const popoutOpen = computed(
  () => !!activeMatchId.value && isPopoutOpen(activeMatchId.value),
);
const programPaused = computed(() => isLive.value && popoutOpen.value);

const whepPhase = ref<WhepPhase | null>(null);
// The player unmounts while paused; its last phase must not outlive it.
watch(programPaused, () => {
  whepPhase.value = null;
});

const gpuTone = computed<Tone>(() =>
  gpuTotal.value === 0 ? "bad" : !hasFreeGpu.value ? "warn" : "ok",
);
const capacityTone = computed<Tone>(() =>
  isAtCapacity.value ? "warn" : "off",
);

const chipClasses =
  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold tabular-nums transition-colors duration-150";
const toolButton =
  "h-8 gap-1.5 rounded-md border-border bg-transparent px-2.5 text-xs font-medium";
</script>

<template>
  <h1 class="sr-only">
    {{ $t("layouts.app_nav.administration.control_room") }}
  </h1>

  <PageTransition>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p class="min-w-0 text-sm text-muted-foreground" aria-live="polite">
        <template v-if="!hasLoaded">&nbsp;</template>
        <template v-else-if="!activeStream">{{
          $t("stream_deck.off_air")
        }}</template>
        <span v-else-if="isLive" class="inline-flex min-w-0 items-center gap-2">
          <StatusDot tone="bad" live />
          <span class="font-semibold text-foreground">{{
            $t("pages.control_room.on_air")
          }}</span>
          <span class="truncate">· {{ programName }}</span>
          <span v-if="liveSince">· <OnAirClock :since="liveSince" /></span>
        </span>
        <span v-else-if="isErrored" class="truncate">
          <span class="text-destructive">{{ $t("match.stream.stopped") }}</span>
          · {{ programName }}
        </span>
        <span v-else class="truncate">
          {{ $t("pages.control_room.starting") }} · {{ programName }} ·
          {{ stageLabel }}
        </span>
      </p>

      <span class="grow" />

      <div class="flex flex-wrap items-center gap-2">
        <FiveStackToolTip
          v-if="gpuPoolReady"
          as-child
          :delay-duration="200"
          :tap-toggle="false"
        >
          <template #trigger>
            <NuxtLink
              to="/gpu-nodes"
              :class="[
                chipClasses,
                TONE_BORDER[gpuTone],
                TONE_TEXT[gpuTone],
                'hover:bg-muted/40',
              ]"
            >
              <Cpu class="size-3.5" />
              <template v-if="gpuTotal === 0">{{
                $t("pages.control_room.gpu.none")
              }}</template>
              <template v-else-if="!hasFreeGpu">{{
                $t("pages.control_room.gpu.busy", {
                  busy: gpuTotal - gpuFree,
                  total: gpuTotal,
                })
              }}</template>
              <template v-else>{{
                $t(
                  "pages.control_room.gpu.free",
                  { free: gpuFree, total: gpuTotal },
                  gpuTotal,
                )
              }}</template>
            </NuxtLink>
          </template>
          {{ busyReason || $t("pages.control_room.gpu.hint") }}
        </FiveStackToolTip>

        <span
          :class="[
            chipClasses,
            TONE_BORDER[capacityTone],
            TONE_TEXT[capacityTone],
          ]"
        >
          <Radio class="size-3.5" />
          {{
            $t(
              "pages.control_room.capacity",
              { n: activeStreamingMatchesCount, max: maxStreams },
              maxStreams,
            )
          }}
          <template v-if="isAtCapacity"
            >· {{ $t("stream_deck.full") }}</template
          >
        </span>
      </div>
    </div>
  </PageTransition>

  <PageTransition :step="1">
    <div
      class="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]"
    >
      <!-- ============ PROGRAM ============ -->
      <section class="grid min-w-0 gap-3">
        <div class="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1">
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses" />
            {{ $t("pages.control_room.program") }}
          </div>
          <template v-if="activeStream">
            <NuxtLink
              :to="`/matches/${activeMatchId}`"
              class="min-w-0 truncate text-[0.95rem] font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
            >
              {{ programName }}
            </NuxtLink>
            <span class="text-xs text-muted-foreground">{{
              activeStream.mode === "tv"
                ? $t("pages.control_room.tv_delayed")
                : $t("common.live")
            }}</span>
          </template>
        </div>

        <FadeSwap>
          <Skeleton
            v-if="!hasLoaded"
            key="loading"
            class="aspect-video w-full rounded-lg"
          />
          <div
            v-else-if="!activeStream"
            key="off"
            class="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-6 text-center"
          >
            <p class="text-[0.95rem] font-semibold text-foreground">
              {{ $t("stream_deck.off_air") }}
            </p>
            <p class="max-w-sm text-sm text-muted-foreground">
              {{ $t("pages.control_room.off_air_hint") }}
            </p>
          </div>
          <div
            v-else-if="!canViewProgram"
            key="denied"
            class="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-black px-6 text-center"
          >
            <p class="text-[0.95rem] font-semibold text-foreground">
              {{ $t("match.stream.access_denied") }}
            </p>
            <p class="max-w-xs text-sm text-muted-foreground">
              {{ $t("match.stream.access_denied_hint") }}
            </p>
          </div>
          <StreamCanvas
            v-else
            :key="`program-${activeStream.id}`"
            :stream="activeStream"
            :is-live="isLive"
            mode="live"
            :show-boot="true"
            class="group aspect-video w-full overflow-hidden rounded-lg border transition-[border-color] duration-200"
            :class="isLive ? 'border-destructive/55' : 'border-border'"
            @phase="whepPhase = $event"
          >
            <template v-if="programPaused" #video>
              <div
                class="flex h-full flex-col items-center justify-center gap-1.5 bg-background px-6 text-center"
              >
                <p class="text-[0.95rem] font-semibold text-foreground">
                  {{ $t("stream_deck.playing_in_popout") }}
                </p>
                <p class="max-w-sm text-sm text-muted-foreground">
                  {{ $t("stream_deck.preview_paused") }}
                </p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    :class="toolButton"
                    @click="focusPopout(activeMatchId!)"
                  >
                    <PictureInPicture2 class="size-3.5" />
                    {{ $t("stream_deck.bring_window_to_front") }}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2.5 text-xs"
                    @click="closePopout(activeMatchId!)"
                  >
                    {{ $t("ui.close_popout") }}
                  </Button>
                </div>
              </div>
            </template>

            <template #status="{ phase, message, retry }">
              <StreamMatchCard :match-id="activeMatchId">
                <StreamStatusPanel
                  :title="copyFor(phase).title"
                  :hint="phase === 'failed' ? message : copyFor(phase).hint"
                  :tone="copyFor(phase).tone"
                  :progress="copyFor(phase).progress"
                >
                  <template v-if="phase === 'failed'" #actions>
                    <Button size="sm" @click="retry">
                      {{ $t("match.stream.try_again") }}
                    </Button>
                  </template>
                </StreamStatusPanel>
              </StreamMatchCard>
            </template>

            <template
              #boot="{ status, errorMessage, lastStatusAt, statusHistory }"
            >
              <StreamMatchCard :match-id="activeMatchId">
                <StreamBootStatus
                  mode="live"
                  :status="status"
                  :error-message="errorMessage"
                  :last-status-at="lastStatusAt"
                  :histories="[statusHistory]"
                  :title="$t('match.stream.starting')"
                  :failed-title="$t('match.stream.stopped')"
                  show-stage
                  can-skip
                  :skipping="!!skippingShaders[activeMatchId!]"
                  @skip="onSkipShaders(activeMatchId!)"
                >
                  <template v-if="isErrored" #actions>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="reconnectLive(activeMatchId!)"
                    >
                      <RefreshCw class="size-3.5" />
                      {{ $t("stream_deck.reconnect") }}
                    </Button>
                    <Button size="sm" variant="ghost" @click="stopOpen = true">
                      {{ $t("stream_deck.stop") }}
                    </Button>
                  </template>
                </StreamBootStatus>
              </StreamMatchCard>
            </template>

            <StreamLiveTag
              v-if="isLive"
              :match-id="activeMatchId!"
              :dim="!!whepPhase || programPaused"
              class="absolute left-3 top-3 z-10"
            />
            <span
              v-if="isLive && activeStream.mode === 'tv'"
              class="pointer-events-none absolute right-3 top-3 z-10 rounded-[3px] bg-background/85 px-2 py-1 text-[0.7rem] text-foreground"
            >
              {{ $t("pages.control_room.tv_delay") }}
            </span>
            <!-- While live the lower third stays out of the picture until the
                 pointer is on the monitor: the program shows what's on air,
                 and the broadcast HUD sits under it. -->
            <div
              v-if="isLive && !programPaused && !whepPhase"
              class="pointer-events-none absolute inset-0 z-[5] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              <StreamMatchCard :match-id="activeMatchId" :backdrop="false" />
            </div>
          </StreamCanvas>
        </FadeSwap>

        <template v-if="activeStream">
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex h-8 items-center gap-2 pr-1">
              <Label
                :for="`autodirector-${activeStream.id}`"
                class="text-sm font-normal text-muted-foreground"
              >
                {{ $t("stream_deck.auto_director") }}
              </Label>
              <Switch
                :id="`autodirector-${activeStream.id}`"
                :model-value="isAutodirector(activeStream)"
                :disabled="!isLive || cs(activeMatchId!).busy"
                @update:model-value="
                  (v: boolean) => setAutodirector(activeMatchId!, v)
                "
              />
            </div>
            <div class="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                :class="toolButton"
                :disabled="
                  !isLive ||
                  cs(activeMatchId!).busy ||
                  isAutodirector(activeStream)
                "
                @click="void specClick(activeMatchId!, 'right')"
              >
                <ChevronLeft class="size-3.5" />
                {{ $t("stream_deck.prev") }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                :class="toolButton"
                :disabled="
                  !isLive ||
                  cs(activeMatchId!).busy ||
                  isAutodirector(activeStream)
                "
                @click="void specClick(activeMatchId!, 'left')"
              >
                {{ $t("stream_deck.next") }}
                <ChevronRight class="size-3.5" />
              </Button>
            </div>

            <span class="grow" />

            <template v-if="popoutOpen">
              <Button
                variant="outline"
                size="sm"
                :class="[
                  toolButton,
                  'border-[hsl(var(--tac-amber)/0.45)] text-[hsl(var(--tac-amber))] hover:text-[hsl(var(--tac-amber))]',
                ]"
                @click="focusPopout(activeMatchId!)"
              >
                <PictureInPicture2 class="size-3.5" />
                {{ $t("stream_deck.in_window") }}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground"
                :title="$t('ui.close_popout')"
                :aria-label="$t('ui.close_popout')"
                @click="closePopout(activeMatchId!)"
              >
                <X class="size-3.5" />
              </Button>
            </template>
            <Button
              v-else
              variant="outline"
              size="sm"
              :class="toolButton"
              :title="$t('pages.control_room.open_focus_window')"
              @click="openPopout(activeMatchId!)"
            >
              <ExternalLink class="size-3.5" />
              {{ $t("stream_deck.control") }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              :class="toolButton"
              :disabled="(!isLive && !isErrored) || cs(activeMatchId!).busy"
              :title="$t('replay_extras.reissue_connect')"
              @click="reconnectLive(activeMatchId!)"
            >
              <RefreshCw class="size-3.5" />
              {{ $t("stream_deck.reconnect") }}
            </Button>
            <span class="w-1.5" aria-hidden="true" />
            <Button
              variant="outline"
              size="sm"
              :class="[
                toolButton,
                'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive',
              ]"
              :disabled="cs(activeMatchId!).busy"
              @click="stopOpen = true"
            >
              <Square class="size-3.5" />
              {{ $t("stream_deck.stop") }}
            </Button>
          </div>

          <div
            v-if="isLive && isAutodirector(activeStream)"
            class="flex items-start gap-2 rounded-lg border border-[hsl(var(--tac-amber)/0.3)] bg-[hsl(var(--tac-amber)/0.06)] px-3 py-2 text-[0.8rem] text-foreground"
          >
            <Bot class="mt-0.5 size-4 shrink-0 text-[hsl(var(--tac-amber))]" />
            <p>
              <span class="font-semibold">{{
                $t("stream_deck.autodirector_on")
              }}</span>
              {{ $t("stream_deck.autodirector_hint") }}
            </p>
          </div>

          <SpectatorGrid
            :match-id="activeMatchId!"
            :is-live="isLive"
            :match-type="activeStream.match?.options?.type"
            :controls-active="isLive && !cs(activeMatchId!).busy"
            :autodirector-on="isAutodirector(activeStream)"
            compact
            @press-slot="(slot: number) => specSlot(activeMatchId!, slot)"
          />
        </template>
      </section>

      <!-- ============ PREVIEW ============ -->
      <aside class="grid min-w-0 gap-3">
        <div class="flex min-h-6 items-center justify-between gap-3">
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses" />
            {{ $t("pages.control_room.preview") }}
          </div>
          <span
            v-if="liveMatches.length"
            class="text-xs tabular-nums text-muted-foreground"
          >
            {{
              $t(
                "stream_deck.match_count",
                { count: liveMatches.length },
                liveMatches.length,
              )
            }}
          </span>
        </div>

        <Fold :open="canTake">
          <div
            class="grid gap-2 rounded-lg border border-border bg-card/40 p-3"
          >
            <div :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("pages.control_room.take") }}
            </div>
            <p v-if="!selectedMatch" class="text-xs text-muted-foreground">
              {{ $t("pages.control_room.take_pick") }}
            </p>
            <template v-else>
              <div class="flex">
                <Button
                  size="sm"
                  :class="[
                    createButtonClasses,
                    'min-w-0 flex-1 justify-center',
                    mode === 'start' ? 'rounded-r-none' : '',
                  ]"
                  :disabled="!!block || !!switching"
                  @click="take"
                >
                  <span class="truncate">{{
                    mode === "switch"
                      ? $t("pages.control_room.take_switch", {
                          match: nameOf(selectedMatch),
                        })
                      : $t("pages.control_room.take_go_live", {
                          match: nameOf(selectedMatch),
                        })
                  }}</span>
                </Button>
                <DropdownMenu v-if="mode === 'start'">
                  <DropdownMenuTrigger as-child>
                    <Button
                      size="sm"
                      :class="[
                        createButtonClasses,
                        'w-8 rounded-l-none border-l border-black/20 px-0',
                      ]"
                      :disabled="!!block"
                      :aria-label="$t('pages.control_room.take_more')"
                    >
                      <ChevronDown class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-56">
                    <DropdownMenuItem
                      @select="startLive(selectedMatch.id, 'live')"
                    >
                      <Play class="size-4" />
                      {{ $t("pages.control_room.go_live") }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      @select="startLive(selectedMatch.id, 'tv')"
                    >
                      <Tv class="size-4" />
                      {{ $t("pages.control_room.start_tv") }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p
                class="text-xs leading-snug"
                :class="block ? TONE_TEXT.warn : TONE_TEXT.off"
              >
                {{
                  block
                    ? blockText(block)
                    : mode === "switch"
                      ? $t("pages.control_room.take_switch_hint")
                      : $t("pages.control_room.take_start_hint")
                }}
              </p>
            </template>
          </div>
        </Fold>

        <FadeSwap>
          <div v-if="!liveMatchesLoaded" key="loading" class="grid gap-4">
            <Skeleton
              v-for="n in 3"
              :key="n"
              class="aspect-video w-full rounded-lg"
            />
          </div>
          <SectionEmpty
            v-else-if="!liveMatches.length"
            key="empty"
            :title="$t('stream_deck.no_live_matches')"
            :description="$t('pages.control_room.no_live_matches_hint')"
          />
          <TransitionGroup
            v-else
            key="list"
            tag="div"
            name="cr-tile"
            class="grid gap-4 max-lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
          >
            <ControlRoomPreview
              v-for="m in previews"
              :key="m.id"
              :match="m"
              :selected="selectedId === m.id"
              :on-air="onAirStateFor(m.id)"
              v-bind="previewRowProps(m.id)"
              @select="selectedId = m.id"
            />
          </TransitionGroup>
        </FadeSwap>
      </aside>
    </div>
  </PageTransition>

  <StopBroadcastDialog
    v-model:open="stopOpen"
    :match-name="programName"
    :stop="stopProgram"
  />
</template>

<style scoped>
/* A tile entering or leaving the preview column: 4px rise and fade on the
   one clock; the others glide into place. */
.cr-tile-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.cr-tile-leave-active {
  transition:
    opacity 110ms ease-in,
    transform 110ms ease-in;
}
.cr-tile-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.cr-tile-leave-to {
  opacity: 0;
}
.cr-tile-move {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .cr-tile-enter-active,
  .cr-tile-leave-active,
  .cr-tile-move {
    transition: none;
  }
}
</style>
