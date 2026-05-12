<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { ExternalLink, PictureInPicture } from "lucide-vue-next";
import { generateSubscription } from "~/graphql/graphqlGen";
import StreamCanvas from "~/components/match/StreamCanvas.vue";
import MatchScoreboardOverlay from "~/components/match/MatchScoreboardOverlay.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const props = defineProps<{
  matchId: string;
  inGlobal?: boolean;
  inPopout?: boolean;
}>();

const { client: apolloClient } = useApolloClient();

const stream = ref<any | null>(null);
const lastGoodStream = ref<any | null>(null);
const scoreboardOpen = ref(false);
let streamSubscription: { unsubscribe: () => void } | undefined;

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
            status_history: true as any,
          },
        ],
      } as any),
    })
    .subscribe({
      next: (result: any) => {
        const next = result?.data?.match_streams?.[0] ?? null;
        stream.value = next;
        if (next) lastGoodStream.value = next;
      },
      error: (err: any) => {
        // eslint-disable-next-line no-console
        console.error("[live-stream-player] subscription error", err);
      },
    });
});

onBeforeUnmount(() => {
  streamSubscription?.unsubscribe();
});

const displayStream = computed(() => stream.value ?? lastGoodStream.value);
const hasStream = computed(() => !!displayStream.value);
const isLive = computed(() => !!stream.value?.is_live);

// Boot pipeline (Allocating GPU / Launching Steam / …) is operator
// info — regulars get nothing to look at until the pod is actually
// publishing. Streamer+ (streamer, match_organizer, tournament_organizer,
// administrator — see AuthStore.roleOrder) keep the stepper.
const authStore = useAuthStore();
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
      header-label="Stream boot"
      :show-boot="true"
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
        v-if="isLive && !inGlobal && !inPopout"
        class="absolute bottom-3 left-3 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150"
      >
        <button
          type="button"
          title="Pin as floating overlay"
          aria-label="Pin as floating overlay"
          class="inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 backdrop-blur-sm transition-all duration-150 hover:bg-black/80 hover:text-white hover:scale-110 cursor-pointer"
          @click="promoteToPip"
        >
          <PictureInPicture class="size-3.5" />
        </button>
        <button
          type="button"
          title="Open in new window"
          aria-label="Open in new window"
          class="inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 backdrop-blur-sm transition-all duration-150 hover:bg-black/80 hover:text-white hover:scale-110 cursor-pointer"
          @click="openPopoutWindow"
        >
          <ExternalLink class="size-3.5" />
        </button>
      </div>
    </StreamCanvas>
  </div>
</template>
