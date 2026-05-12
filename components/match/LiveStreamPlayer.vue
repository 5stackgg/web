<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { ExternalLink, Radio } from "lucide-vue-next";
import { generateSubscription } from "~/graphql/graphqlGen";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import StreamSessionProgress from "~/components/match/StreamSessionProgress.vue";

// Viewer-facing live-stream surface embedded in match pages. Read
// only — every spectator-control affordance (autodirector toggle,
// slot picker, x-ray, HUD swap, scoreboard) lives on the dedicated
// /stream-deck/[matchId] page that organizers/streamers open.

const props = defineProps<{
  matchId: string;
}>();

const { client: apolloClient } = useApolloClient();

const stream = ref<any | null>(null);
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
        stream.value = result?.data?.match_streams?.[0] ?? null;
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

function whepUrlFor(s: any): string | null {
  if (!s?.link) return null;
  return s.link.replace(/\/?$/, "/whep");
}

const hasStream = computed(() => !!stream.value);
const isLive = computed(() => !!stream.value?.is_live);
const isErrored = computed(() => stream.value?.status === "errored");

const statusBadgeLabel = computed(() => {
  const s = stream.value;
  if (!s) return "—";
  if (s.is_live) return "LIVE";
  const v = s.status as string | undefined;
  if (!v) return "BOOTING";
  return (STATUS_LABELS[v] ?? v.replace(/_/g, " ")).toUpperCase();
});

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

      <span class="ml-auto">
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
      </span>
    </div>

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
  </div>
</template>

<style scoped>
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
</style>
