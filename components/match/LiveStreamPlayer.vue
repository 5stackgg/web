<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";

const { t } = useI18n();
import { ExternalLink, PictureInPicture } from "lucide-vue-next";
import { generateSubscription } from "~/graphql/graphqlGen";
import StreamCanvas from "~/components/match/StreamCanvas.vue";
import MatchScoreboardOverlay from "~/components/match/MatchScoreboardOverlay.vue";
import StreamViewerBadge from "~/components/match/StreamViewerBadge.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import { useStreamerStore } from "~/stores/StreamerStore";
import { e_player_roles_enum } from "~/generated/zeus";

const props = defineProps<{
  matchId: string;
  inGlobal?: boolean;
  inPopout?: boolean;
}>();

const { client: apolloClient } = useApolloClient();
const authStore = useAuthStore();

// Reuse the global StreamerStore feed when it's already running
// (streamer-role sessions: AuthStore auto-subscribes; stream-deck
// pages prime it). Avoids running a second match_streams subscription
// per matchId when the same data is already streaming into the store.
const streamerStore = useStreamerStore();
const sharedStream = computed<any | null>(() => {
  if (!streamerStore.hasLoaded) return null;
  const list: any[] = streamerStore.liveStreams ?? [];
  return list.find((s) => s?.match_id === props.matchId) ?? null;
});

const localStream = ref<any | null>(null);
const stream = computed(() => sharedStream.value ?? localStream.value);
const lastGoodStream = ref<any | null>(null);
const hasEverBeenLive = ref(false);
const scoreboardOpen = ref(false);
let streamSubscription: { unsubscribe: () => void } | undefined;
// Only run our own subscription when the shared store isn't going to
// deliver this match — e.g. non-streamer viewers, or before the
// store has loaded its first snapshot.
function shouldRunLocalSubscription(): boolean {
  if (sharedStream.value) return false;
  if (streamerStore.hasLoaded) {
    // Store loaded and this match isn't in the list — either it has
    // no game streamer at all (parent already gates on hasGameStreamer
    // before mounting us) or the operator hasn't pressed Go Live yet.
    // Falling back to a local sub keeps the boot-state UI live for
    // non-streamer viewers who never see the store populate.
    return !authStore.isRoleAbove(e_player_roles_enum.streamer);
  }
  return true;
}

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

function ensureLocalSubscription() {
  if (streamSubscription) return;
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
            status_history: true as any,
          },
        ],
      } as any),
    })
    .subscribe({
      next: (result: any) => {
        const next = result?.data?.match_streams?.[0] ?? null;
        localStream.value = next;
      },
      error: (err: any) => {
        // eslint-disable-next-line no-console
        console.error("[live-stream-player] subscription error", err);
      },
    });
}

function teardownLocalSubscription() {
  streamSubscription?.unsubscribe();
  streamSubscription = undefined;
  localStream.value = null;
}

const coarsePointer = ref(false);

onMounted(() => {
  if (typeof window !== "undefined" && window.matchMedia) {
    coarsePointer.value = window.matchMedia("(pointer: coarse)").matches;
  }
  if (shouldRunLocalSubscription()) ensureLocalSubscription();
});

// React to store readiness: if the shared feed shows up after we
// already spun up a local sub, tear ours down. If the store loads
// without our match (non-streamer viewer), start the local sub.
watch(
  () => [streamerStore.hasLoaded, sharedStream.value] as const,
  () => {
    if (sharedStream.value) {
      teardownLocalSubscription();
    } else if (shouldRunLocalSubscription()) {
      ensureLocalSubscription();
    }
  },
);

// Latch last-good + ever-live on whichever feed we're using.
watch(
  stream,
  (next) => {
    if (next) lastGoodStream.value = next;
    if (next?.is_live) hasEverBeenLive.value = true;
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  teardownLocalSubscription();
});

const displayStream = computed(() => stream.value ?? lastGoodStream.value);
const hasStream = computed(() => !!displayStream.value);
// Once the stream has been live, treat it as live for display gating so a
// mid-match pause (which flips is_live false server-side) doesn't tear
// down the WhepPlayer and snap viewers back to the boot screen.
const isLive = computed(() => !!stream.value?.is_live || hasEverBeenLive.value);

// Boot pipeline (Allocating GPU / Launching Steam / …) is operator
// info — regulars get nothing to look at until the pod is actually
// publishing. Streamer+ (streamer, match_organizer, tournament_organizer,
// administrator — see AuthStore.roleOrder) keep the stepper.
const canSeeBoot = computed(() =>
  authStore.isRoleAbove(e_player_roles_enum.streamer),
);

const applicationSettings = useApplicationSettingsStore();
const isPoppedOut = computed(() => {
  if (props.inGlobal) return false;
  const gs: any = applicationSettings.globalStream;
  return !!gs && gs.is_game_streamer === true && gs.match_id === props.matchId;
});

const compact = computed(() => props.inGlobal || props.inPopout);

function promoteToPip() {
  if (!stream.value) return;
  applicationSettings.setGlobalStream({
    ...stream.value,
    match_id: props.matchId,
    is_game_streamer: true,
    preview: true,
  } as any);
}

function openPopoutWindow() {
  if (typeof window === "undefined") return;
  const url = `/match-popout/${props.matchId}`;
  window.open(
    url,
    `match-popout-${props.matchId}`,
    "popup=yes,width=960,height=640,resizable=yes,scrollbars=no",
  );
}
</script>

<template>
  <div
    v-if="hasStream && !isPoppedOut && (isLive || canSeeBoot)"
    class="overflow-hidden rounded-lg border border-border/70 bg-black shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.05),0_30px_60px_-30px_rgba(0,0,0,0.7)]"
    :class="compact ? 'flex h-full w-full flex-col' : ''"
  >
    <StreamCanvas
      :stream="displayStream"
      :is-live="isLive"
      :stages="LIVE_STAGES"
      :header-label="$t('live_stages.stream_boot')"
      :show-boot="true"
      :enable-pip="true"
      class="group"
      :class="compact ? 'min-h-0 flex-1' : 'aspect-video'"
    >
      <MatchScoreboardOverlay
        v-model:open="scoreboardOpen"
        :match-id="matchId"
        :compact="compact"
        :require-fullscreen="!compact"
      />

      <div
        v-if="isLive && !inPopout"
        class="absolute bottom-3 left-12 z-10 flex items-center gap-2 transition-opacity duration-150"
        :class="
          coarsePointer
            ? ''
            : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
        "
      >
        <button
          v-if="!inGlobal"
          type="button"
          :title="$t('ui.pin_overlay')"
          :aria-label="$t('ui.pin_overlay')"
          class="inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 backdrop-blur-sm transition-all duration-150 hover:bg-black/80 hover:text-white hover:scale-110 cursor-pointer"
          @click="promoteToPip"
        >
          <PictureInPicture class="size-3.5" />
        </button>
        <button
          v-if="!coarsePointer"
          type="button"
          :title="$t('ui.open_new_window')"
          :aria-label="$t('ui.open_new_window')"
          class="inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 backdrop-blur-sm transition-all duration-150 hover:bg-black/80 hover:text-white hover:scale-110 cursor-pointer"
          @click="openPopoutWindow"
        >
          <ExternalLink class="size-3.5" />
        </button>
        <StreamViewerBadge :match-id="matchId" size="md" />
      </div>
    </StreamCanvas>
  </div>
</template>
