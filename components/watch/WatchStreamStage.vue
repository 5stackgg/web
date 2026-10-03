<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import {
  Maximize2,
  PictureInPicture,
  Volume2,
  VolumeX,
} from "lucide-vue-next";
import { $, order_by } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";
import { watchTickerMatchFields } from "~/graphql/watchTickerFields";
import LiveStreamPlayer from "~/components/match/LiveStreamPlayer.vue";
import StreamEmbed from "~/components/StreamEmbed.vue";
import StreamMatchCard from "~/components/match/StreamMatchCard.vue";
import StreamStatusPanel from "~/components/match/StreamStatusPanel.vue";
import StreamViewerBadge from "~/components/match/StreamViewerBadge.vue";
import StreamThumbnail from "~/components/watch/StreamThumbnail.vue";
import { Button } from "~/components/ui/button";
import { useWatchStage } from "~/composables/useWatchStage";
import { useStreamViewers } from "~/composables/useStreamViewers";
import {
  useWhepStatusCopy,
  type WhepPhase,
} from "~/composables/useWhepStatusCopy";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import { loginLinks } from "~/utilities/loginLinks";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  orderedStreams,
  streamPlatformMeta,
} from "~/components/watch/streamPlatform";
import {
  currentMatchMap,
  tickerCell,
} from "~/components/watch/watchTicker";
import {
  stageNeedsLogin,
  stageScoreBug,
  streamableMatches,
} from "~/components/watch/watchStage";

const emit = defineEmits<{
  (e: "update:streamable-ids", ids: string[]): void;
}>();

const { t, locale } = useI18n();
const { client } = useApolloClient();
const { stageMatchId, setStage } = useWatchStage();
const { viewers } = useStreamViewers();
const { copyFor } = useWhepStatusCopy();
const settings = useApplicationSettingsStore();
const auth = useAuthStore();

// Live with a stream, or anything the game streamer is still on: its row
// outlives the match by the TV delay and is removed when the stream stops,
// so a just-finished match keeps playing out here.
const stageQuery = generateSubscription({
  matches: [
    {
      where: {
        _or: [
          {
            status: { _eq: $("status", "e_match_status_enum!") },
            streams: {},
          },
          { streams: { is_game_streamer: { _eq: true } } },
        ],
      },
      order_by: [{ started_at: order_by.desc_nulls_last }],
      limit: 6,
    },
    watchTickerMatchFields,
  ],
} as any);

const matches = ref<any[]>([]);
let subscription: { unsubscribe: () => void } | undefined;
if (typeof window !== "undefined") {
  subscription = client
    .subscribe({ query: stageQuery, variables: { status: "Live" } })
    .subscribe({
      next: ({ data }: any) => {
        matches.value = streamableMatches(data?.matches ?? []);
      },
      error: (err: any) => {
        console.error("[watch-stage] subscription error", err);
      },
    });
}

const ids = computed(() => matches.value.map((m) => m.id));
watch(ids, (next) => emit("update:streamable-ids", next), { immediate: true });
onBeforeUnmount(() => {
  subscription?.unsubscribe();
  emit("update:streamable-ids", []);
});

// The shared stage id drives the ticker's "On stage" mark, so a missing or
// stale one is replaced with the first streamable match.
watch(
  [ids, stageMatchId],
  ([list, id]) => {
    if (list.length && (!id || !list.includes(id))) setStage(list[0]);
  },
  { immediate: true },
);

const current = computed(
  () =>
    matches.value.find((m) => m.id === stageMatchId.value) ??
    matches.value[0] ??
    null,
);
// Two others fill the column beside the stage; the rest are in the ticker.
const others = computed(() =>
  matches.value.filter((m) => m.id !== current.value?.id).slice(0, 2),
);
const hiddenCount = computed(
  () => Math.max(0, matches.value.length - 1 - others.value.length),
);

const streams = computed(() => orderedStreams(current.value?.streams));
const streamIndex = ref(0);
const stream = computed(
  () => streams.value[streamIndex.value % (streams.value.length || 1)] ?? null,
);
const platform = computed(() => streamPlatformMeta(stream.value));

const muted = ref(true);
const phase = ref<WhepPhase | null>(null);
watch(
  () => current.value?.id,
  () => {
    streamIndex.value = 0;
  },
);
watch(
  () => stream.value?.id,
  () => {
    muted.value = true;
    phase.value = null;
  },
);

function nextStream() {
  if (streams.value.length > 1) {
    streamIndex.value = (streamIndex.value + 1) % streams.value.length;
  }
}

const needsLogin = computed(() =>
  stageNeedsLogin(settings.requireLoginForLiveStreams, !!auth.me?.steam_id),
);

// is_live flips false while a match is paused; once a game stream has played
// it stays mounted instead of dropping back to the waiting card.
const everLive = ref<string[]>([]);
watch(
  stream,
  (s) => {
    if (s?.is_game_streamer && s.is_live && !everLive.value.includes(s.id)) {
      everLive.value = [...everLive.value, s.id];
    }
  },
  { immediate: true },
);

const playingElsewhere = computed(() => {
  const gs: any = settings.globalStream;
  if (!gs || !stream.value || !current.value) return false;
  if (gs.id === stream.value.id) return true;
  return (
    !!gs.is_game_streamer &&
    gs.match_id === current.value.id &&
    !!stream.value.is_game_streamer
  );
});

const mode = computed<"login" | "elsewhere" | "game" | "waiting" | "embed">(
  () => {
    if (needsLogin.value) return "login";
    if (playingElsewhere.value) return "elsewhere";
    if (stream.value?.is_game_streamer) {
      return stream.value.is_live || everLive.value.includes(stream.value.id)
        ? "game"
        : "waiting";
    }
    return "embed";
  },
);

// The lower third rides over the picture. While the WHEP player has none,
// its own caption (match card + status) is already on screen.
const showLowerThird = computed(
  () =>
    mode.value !== "waiting" && !(mode.value === "game" && phase.value !== null),
);

const embedRef = ref<any>(null);
function toggleMute() {
  muted.value = !muted.value;
  if (mode.value === "embed") embedRef.value?.toggleMute?.();
}

const stageRef = ref<HTMLElement | null>(null);
const canFullscreen =
  typeof document !== "undefined" && !!document.fullscreenEnabled;
function fullscreen() {
  if (document.fullscreenElement) {
    void document.exitFullscreen?.();
    return;
  }
  void stageRef.value?.requestFullscreen?.()?.catch(() => {});
}

function login() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

function watchInPlayer() {
  if (!stream.value || !current.value) return;
  if (needsLogin.value) {
    login();
    return;
  }
  settings.setGlobalStream({
    ...stream.value,
    match_id: current.value.id,
  } as any);
}

function returnHere() {
  settings.setGlobalStream();
}

const now = ref(new Date());
const cellCtx = computed(() => ({ t, locale: locale.value, now: now.value }));
const currentCell = computed(() =>
  current.value ? tickerCell(current.value, cellCtx.value) : null,
);
const otherCells = computed(() =>
  others.value.map((m) => ({
    match: m,
    cell: tickerCell(m, cellCtx.value),
    stream: orderedStreams(m.streams)[0] ?? null,
  })),
);

const scoreBug = computed(() =>
  current.value ? stageScoreBug(current.value) : "",
);
const phoneMeta = computed(() => {
  const mm = currentMatchMap(current.value);
  return [
    currentCell.value?.tag,
    mm?.map?.label || mm?.map?.name,
    currentCell.value?.status.text,
  ]
    .filter(Boolean)
    .join(" · ");
});

const totalWatching = computed(() =>
  ids.value.reduce((sum, id) => sum + (viewers.value[id] ?? 0), 0),
);

const waitingCopy = computed(() => copyFor("waiting"));

const roundButton =
  "relative inline-grid size-8 place-items-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm transition-colors duration-150 hover:bg-black/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] after:absolute after:-inset-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <section
    v-if="current"
    id="watch-stage"
    class="scroll-mt-20"
    aria-labelledby="watch-stage-label"
  >
    <div
      :class="[
        tacticalSectionLabelClasses,
        '!flex w-full items-center justify-between',
      ]"
    >
      <span id="watch-stage-label" class="inline-flex items-center gap-2">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.watch.stage.title") }}
      </span>
      <span
        class="text-xs normal-case tracking-normal text-muted-foreground tabular-nums"
      >
        <b class="font-semibold text-foreground">{{ ids.length }}</b>
        {{ $t("pages.watch.stage.streams", ids.length) }}
        <template v-if="totalWatching > 0">
          ·
          <b class="font-semibold text-foreground">{{ totalWatching }}</b>
          {{ $t("pages.watch.stage.watching", totalWatching) }}
        </template>
      </span>
    </div>

    <div class="watch-stage-grid" :class="{ solo: others.length === 0 }">
      <div
        ref="stageRef"
        class="watch-stage-screen relative aspect-video w-full max-w-full overflow-hidden rounded-lg border border-border bg-black"
      >
        <div
          v-if="mode === 'login'"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-4 pb-[18%] text-center text-sm text-white/70"
        >
          <span>{{ $t("pages.watch.stage.login") }}</span>
          <Button size="sm" variant="outline" @click="login">
            {{ $t("pages.watch.stage.login_action") }}
          </Button>
        </div>
        <div
          v-else-if="mode === 'elsewhere'"
          class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black px-4 pb-[18%] text-center text-sm text-white/80"
        >
          <PictureInPicture class="size-5 text-white/50" />
          <span>{{ $t("pages.watch.stage.playing_elsewhere") }}</span>
          <Button size="sm" variant="outline" @click="returnHere">
            {{ $t("ui.return_here") }}
          </Button>
        </div>
        <StreamMatchCard
          v-else-if="mode === 'waiting'"
          :match-id="current.id"
        >
          <StreamStatusPanel
            :title="waitingCopy.title"
            :hint="waitingCopy.hint"
            :progress="waitingCopy.progress"
          />
        </StreamMatchCard>
        <LiveStreamPlayer
          v-else-if="mode === 'game'"
          :key="current.id"
          :match-id="current.id"
          bare
          :muted="muted"
          disable-shortcuts
          class="absolute inset-0"
          @phase="phase = $event"
        />
        <StreamEmbed
          v-else-if="stream"
          :key="stream.id"
          ref="embedRef"
          inline
          :streams="[stream as any]"
          :match-id="current.id"
          class="absolute inset-0"
        />

        <template v-if="showLowerThird">
          <StreamMatchCard
            :match-id="current.id"
            :backdrop="false"
            class="max-sm:hidden"
          />
          <div
            class="absolute bottom-2 left-2 rounded-[3px] bg-background/90 px-2.5 py-1.5 text-[13px] font-semibold tabular-nums sm:hidden"
          >
            {{ scoreBug }}
          </div>
        </template>

        <div
          class="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5"
        >
          <span
            class="rounded-[3px] bg-destructive px-1.5 py-[3px] text-[11px] font-extrabold uppercase leading-tight tracking-[0.08em] text-white"
          >
            {{ $t("common.live") }}
          </span>
          <span
            class="inline-flex h-[22px] items-center rounded-[3px] bg-black/60 px-1.5 text-xs text-white backdrop-blur-sm"
          >
            <StreamViewerBadge :match-id="current.id" bare />
          </span>
        </div>

        <div class="absolute right-2.5 top-2.5 flex gap-1.5">
          <button
            v-if="mode === 'game' || mode === 'embed'"
            type="button"
            :class="roundButton"
            :aria-label="muted ? $t('ui.unmute') : $t('ui.mute')"
            @click="toggleMute"
          >
            <VolumeX v-if="muted" class="size-4" />
            <Volume2 v-else class="size-4" />
          </button>
          <button
            v-if="canFullscreen"
            type="button"
            :class="roundButton"
            :aria-label="$t('pages.watch.stage.fullscreen')"
            @click="fullscreen"
          >
            <Maximize2 class="size-4" />
          </button>
        </div>
      </div>

      <div
        class="watch-stage-bar flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5"
      >
        <p
          v-if="phoneMeta"
          class="m-0 basis-full text-xs text-muted-foreground sm:hidden"
        >
          {{ phoneMeta }}
        </p>
        <div class="flex min-w-0 items-center gap-2 text-[13px]">
          <component
            :is="platform.icon"
            v-if="platform"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          <strong class="truncate font-semibold">{{
            stream?.title || platform?.name || ""
          }}</strong>
          <span
            v-if="platform && stream?.title"
            class="shrink-0 text-muted-foreground"
            >{{ platform.name }}</span
          >
          <Button
            v-if="streams.length > 1"
            size="sm"
            variant="outline"
            class="shrink-0"
            @click="nextStream"
          >
            {{ $t("pages.watch.stage.more_streams", streams.length - 1) }}
          </Button>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            size="sm"
            class="bg-[hsl(var(--tac-amber))] font-semibold text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.88)]"
            @click="watchInPlayer"
          >
            {{ $t("pages.watch.stage.watch") }}
          </Button>
          <Button size="sm" variant="outline" as-child>
            <NuxtLink :to="{ name: 'matches-id', params: { id: current.id } }">
              {{ $t("pages.watch.stage.open_match") }}
            </NuxtLink>
          </Button>
        </div>
      </div>

      <div
        v-if="others.length"
        class="watch-stage-side flex min-h-0 min-w-0 flex-col gap-3"
      >
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t("pages.watch.stage.others") }}
        </p>
        <button
          v-for="other in otherCells"
          :key="other.match.id"
          type="button"
          class="watch-stage-thumb group grid min-h-0 w-full min-w-0 cursor-pointer gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          @click="setStage(other.match.id)"
        >
          <span
            class="relative block h-full min-h-[4.5rem] overflow-hidden rounded-md border border-border"
          >
            <StreamThumbnail
              :match-id="other.match.id"
              :stream="other.stream"
              :locked="needsLogin"
              class="transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
            <span
              class="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5"
            >
              <span
                class="rounded-[3px] bg-destructive px-[5px] py-0.5 text-[11px] font-extrabold uppercase leading-tight tracking-[0.08em] text-white"
              >
                {{ $t("common.live") }}
              </span>
              <span
                class="inline-flex h-5 items-center rounded-[3px] bg-black/60 px-1.5 text-xs text-white backdrop-blur-sm"
              >
                <StreamViewerBadge :match-id="other.match.id" bare />
              </span>
            </span>
          </span>
          <span class="grid min-w-0 gap-0.5">
            <span
              v-for="(team, i) in other.cell.teams"
              :key="i"
              class="flex min-w-0 items-center gap-2 text-[13px] font-semibold"
              :class="
                team.emphasis === 'trail'
                  ? 'text-muted-foreground'
                  : 'text-foreground'
              "
            >
              <span class="min-w-0 flex-1 truncate">{{ team.name }}</span>
              <span v-if="team.score !== null" class="tabular-nums">{{
                team.score
              }}</span>
            </span>
            <span class="truncate text-xs text-muted-foreground">{{
              [other.cell.status.text, other.cell.tag]
                .filter(Boolean)
                .join(" · ")
            }}</span>
          </span>
        </button>
        <p v-if="hiddenCount" class="m-0 text-xs text-muted-foreground">
          {{ $t("pages.watch.stage.more_live", hiddenCount) }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* The stage is capped so the ticker, the stage and its action row fit one
   screen; the column beside it takes whatever width is left. */
.watch-stage-grid {
  --stage-h: calc(100vh - 360px);
  display: grid;
  grid-template-columns:
    minmax(0, max(560px, calc(var(--stage-h) * 16 / 9)))
    minmax(18rem, 1fr);
  grid-template-areas:
    "screen side"
    "bar .";
  gap: 0.625rem 1rem;
}
@supports (height: 100dvh) {
  .watch-stage-grid {
    --stage-h: calc(100dvh - 360px);
  }
}
.watch-stage-grid.solo {
  grid-template-columns: minmax(0, max(560px, calc(var(--stage-h) * 16 / 9)));
  grid-template-areas:
    "screen"
    "bar";
}
.watch-stage-screen {
  grid-area: screen;
  align-self: start;
}
.watch-stage-bar {
  grid-area: bar;
}
.watch-stage-side {
  grid-area: side;
}
.watch-stage-thumb {
  flex: 1 1 0;
  grid-template-rows: minmax(0, 1fr) auto;
}
@media (max-width: 900px) {
  .watch-stage-grid,
  .watch-stage-grid.solo {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "screen"
      "bar"
      "side";
  }
  .watch-stage-thumb {
    flex: none;
    grid-template-columns: 9rem minmax(0, 1fr);
    grid-template-rows: auto;
    align-items: center;
  }
  .watch-stage-thumb > span:first-child {
    aspect-ratio: 16 / 9;
    height: auto;
  }
}
</style>
