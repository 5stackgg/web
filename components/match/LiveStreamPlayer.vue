<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { ExternalLink, PictureInPicture } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { loginLinks } from "~/utilities/loginLinks";
import { generateSubscription } from "~/graphql/graphqlGen";
import StreamCanvas from "~/components/match/StreamCanvas.vue";
import MatchScoreboardOverlay from "~/components/match/MatchScoreboardOverlay.vue";
import StreamViewerBadge from "~/components/match/StreamViewerBadge.vue";
import StreamMatchCard from "~/components/match/StreamMatchCard.vue";
import StreamStatusPanel from "~/components/match/StreamStatusPanel.vue";
import StreamBootStatus from "~/components/match/StreamBootStatus.vue";
import {
  useWhepStatusCopy,
  type WhepPhase,
} from "~/composables/useWhepStatusCopy";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import { useStreamerStore } from "~/stores/StreamerStore";
import { useMatchPopout } from "~/composables/useMatchPopout";
import { e_player_roles_enum } from "~/generated/zeus";

const FRAME_SHADOW =
  "shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.05),0_30px_60px_-30px_rgba(0,0,0,0.7)]";

const props = withDefaults(
  defineProps<{
    matchId: string;
    inGlobal?: boolean;
    inPopout?: boolean;
    // Hosted inside a frame that draws its own chrome (the /watch stage): fill
    // the host and skip the border, LIVE tag, hover buttons and scoreboard.
    bare?: boolean;
    muted?: boolean;
    audio?: boolean;
    disableShortcuts?: boolean;
  }>(),
  { audio: true },
);

const emit = defineEmits<{
  (e: "phase", phase: WhepPhase | null): void;
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

// Anti-cheat: players (and coaches) in this match's lineup must never
// see the live feed — not even admins. `is_in_lineup` / `is_coach` are
// backend computed fields evaluated for the authenticated session, so
// they're false for anonymous viewers and correctly true for staff who
// are also rostered. Gated here (not just on the match page) so the
// popout window and floating PiP honor it too.
const isInLineup = ref(false);
let lineupSubscription: { unsubscribe: () => void } | undefined;

function ensureLineupSubscription() {
  if (lineupSubscription) return;
  if (!authStore.me?.steam_id) {
    isInLineup.value = false;
    return;
  }
  lineupSubscription = apolloClient
    .subscribe({
      query: generateSubscription({
        matches_by_pk: [
          { id: props.matchId },
          { is_in_lineup: true, is_coach: true },
        ],
      } as any),
    })
    .subscribe({
      next: (result: any) => {
        const m = result?.data?.matches_by_pk;
        isInLineup.value = !!(m?.is_in_lineup || m?.is_coach);
      },
      error: (err: any) => {
        // eslint-disable-next-line no-console
        console.error("[live-stream-player] lineup subscription error", err);
      },
    });
}

function teardownLineupSubscription() {
  lineupSubscription?.unsubscribe();
  lineupSubscription = undefined;
}

const coarsePointer = ref(false);

onMounted(() => {
  if (typeof window !== "undefined" && window.matchMedia) {
    coarsePointer.value = window.matchMedia("(pointer: coarse)").matches;
  }
  if (shouldRunLocalSubscription()) ensureLocalSubscription();
  ensureLineupSubscription();
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
  teardownLineupSubscription();
});

const displayStream = computed(() => stream.value ?? lastGoodStream.value);
const hasStream = computed(() => !!displayStream.value);
// The row is removed when the stream is stopped, so having had one and no
// longer having it means it ended. The popout and floating PiP stay mounted
// past that point; without this they retry a publisher that is gone.
const streamEnded = computed(() => !stream.value && !!lastGoodStream.value);
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
const matchPopout = useMatchPopout();

// (Re)evaluate lineup membership when the viewer signs in/out.
watch(
  () => authStore.me?.steam_id,
  () => {
    teardownLineupSubscription();
    isInLineup.value = false;
    ensureLineupSubscription();
  },
);

// Anti-cheat gates. A rostered player/coach is blocked everywhere; when
// the server requires sign-in, anonymous viewers are blocked too.
const isSignedIn = computed(() => !!authStore.me?.steam_id);
// Blocked purely because the viewer is signed out — we surface a
// "log in to watch" prompt for this case (vs. a rostered player, who
// just gets nothing).
const needsLogin = computed(
  () => applicationSettings.requireLoginForLiveStreams && !isSignedIn.value,
);
const canViewStream = computed(() => {
  if (isInLineup.value) return false;
  if (needsLogin.value) return false;
  return true;
});

function loginToView() {
  if (typeof window === "undefined") return;
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

// True when this stream is already playing in a separate popped-out
// window — used to collapse the inline slot to a placeholder.
const poppedToWindow = computed(() => {
  if (props.inGlobal || props.inPopout) return false;
  return matchPopout.isOpen(props.matchId);
});

// True when this stream is currently pinned to the floating PiP overlay.
const inGlobalPip = computed(() => {
  if (props.inGlobal || props.inPopout) return false;
  const gs: any = applicationSettings.globalStream;
  return !!gs && gs.is_game_streamer === true && gs.match_id === props.matchId;
});

const isPoppedOut = computed(
  () => inGlobalPip.value || poppedToWindow.value,
);

function returnFromPip() {
  applicationSettings.setGlobalStream();
}

const compact = computed(() => props.inGlobal || props.inPopout);
const fills = computed(() => compact.value || props.bare);
const frameClass = computed(() =>
  props.bare ? "" : "rounded-lg border border-border/70 " + FRAME_SHADOW,
);

const { copyFor } = useWhepStatusCopy();
// Non-null while the player has no picture (the caption covers the frame).
const whepPhase = ref<WhepPhase | null>(null);
watch(whepPhase, (next) => emit("phase", next));

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
  matchPopout.openPopout(props.matchId);
}

function focusPopoutWindow() {
  matchPopout.focusPopout(props.matchId);
}
</script>

<template>
  <div
    v-if="streamEnded && canViewStream && !isPoppedOut"
    class="relative overflow-hidden bg-black"
    :class="[frameClass, fills ? 'h-full w-full' : 'aspect-video']"
  >
    <StreamMatchCard :match-id="matchId" :compact="compact">
      <StreamStatusPanel :title="$t('match.stream.ended')" />
    </StreamMatchCard>
  </div>

  <div
    v-else-if="
      hasStream && canViewStream && !isPoppedOut && (isLive || canSeeBoot)
    "
    class="overflow-hidden bg-black"
    :class="[frameClass, fills ? 'flex h-full w-full flex-col' : '']"
  >
    <StreamCanvas
      :stream="displayStream"
      :is-live="isLive"
      mode="live"
      :show-boot="true"
      :enable-pip="true"
      class="group"
      :class="fills ? 'min-h-0 flex-1' : 'aspect-video'"
      :muted="muted"
      :audio="audio"
      :disable-shortcuts="disableShortcuts"
      @phase="whepPhase = $event"
    >
      <template #status="{ phase, message, retry }">
        <StreamMatchCard :match-id="matchId" :compact="compact">
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

      <!-- Only streamer+ get here before the pod is publishing (see
           canSeeBoot), so the caption names the boot stage. -->
      <template #boot="{ status, errorMessage, lastStatusAt, statusHistory }">
        <StreamMatchCard :match-id="matchId" :compact="compact">
          <template #corner>
            <span
              class="absolute right-3 top-3 rounded-[3px] bg-background/80 px-1.5 py-1 text-[0.625rem] uppercase tracking-[0.08em] text-muted-foreground"
            >
              {{ $t("match.stream.staff_only") }}
            </span>
          </template>
          <StreamBootStatus
            mode="live"
            :status="status"
            :error-message="errorMessage"
            :last-status-at="lastStatusAt"
            :histories="[statusHistory]"
            :title="$t('match.stream.starting')"
            :failed-title="$t('match.stream.start_failed')"
            show-stage
          />
        </StreamMatchCard>
      </template>

      <div
        v-if="isLive && !fills"
        class="pointer-events-none absolute left-3 top-3 z-10 flex overflow-hidden rounded-[2px] text-[0.7rem] leading-none shadow-[0_6px_18px_-8px_rgba(0,0,0,0.7)]"
      >
        <span
          class="px-2 py-1.5 font-bold uppercase tracking-[0.12em] transition-colors"
          :class="
            whepPhase
              ? 'bg-muted text-muted-foreground'
              : 'bg-destructive text-destructive-foreground'
          "
        >
          {{ $t("common.live") }}
        </span>
        <span class="bg-background/85 px-2 py-1.5 text-foreground">
          <StreamViewerBadge :match-id="matchId" bare />
        </span>
      </div>

      <MatchScoreboardOverlay
        v-if="!bare"
        v-model:open="scoreboardOpen"
        :match-id="matchId"
        :compact="compact"
        :require-fullscreen="!compact"
      />

      <div
        v-if="isLive && !inPopout && !bare && !whepPhase"
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
        <StreamViewerBadge v-if="compact" :match-id="matchId" size="md" />
      </div>
    </StreamCanvas>
  </div>

  <div
    v-else-if="hasStream && canViewStream && poppedToWindow"
    class="flex items-center justify-center gap-3 bg-black/40 px-4 text-center text-sm text-white/80"
    :class="[frameClass, fills ? 'h-full w-full' : 'aspect-video']"
  >
    <div class="flex flex-col items-center gap-2">
      <ExternalLink class="size-5 text-white/50" />
      <span>{{ $t("ui.playing_in_popout") }}</span>
      <Button size="sm" variant="outline" @click="focusPopoutWindow">
        {{ $t("ui.focus_window") }}
      </Button>
    </div>
  </div>

  <div
    v-else-if="hasStream && canViewStream && inGlobalPip"
    class="flex items-center justify-center gap-3 bg-black/40 px-4 text-center text-sm text-white/80"
    :class="[frameClass, fills ? 'h-full w-full' : 'aspect-video']"
  >
    <div class="flex flex-col items-center gap-2">
      <PictureInPicture class="size-5 text-white/50" />
      <span>{{ $t("ui.playing_in_pip") }}</span>
      <Button size="sm" variant="outline" @click="returnFromPip">
        {{ $t("ui.return_here") }}
      </Button>
    </div>
  </div>

  <div
    v-else-if="hasStream && needsLogin && isLive"
    role="button"
    tabindex="0"
    class="flex cursor-pointer items-center justify-center gap-3 bg-black px-4 text-center text-sm text-white/80"
    :class="[frameClass, fills ? 'h-full w-full' : 'aspect-video']"
    @click="loginToView"
    @keydown.enter="loginToView"
    @keydown.space.prevent="loginToView"
  >
    <div class="flex flex-col items-center gap-2">
      <span>{{ $t("ui.login_to_watch") }}</span>
      <Button size="sm" variant="outline" @click.stop="loginToView">
        {{ $t("ui.login_to_watch_action") }}
      </Button>
    </div>
  </div>
</template>
