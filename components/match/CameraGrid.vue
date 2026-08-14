<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from "vue";
import gql from "graphql-tag";
import { useQuery } from "@vue/apollo-composable";
import CameraFeed from "~/components/match/CameraFeed.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Button } from "~/components/ui/button";
import {
  LucideLoader2,
  LucideRefreshCw,
  LucideTriangleAlert,
  LucideVideo,
  LucideVideoOff,
} from "lucide-vue-next";
import {
  cameraAdminTalkUrl,
  hangupAdminTalk,
  negotiateWebRtc,
  type CameraPlayerStatus,
} from "~/composables/useCameraApi";
import { useMatchCameraStatus } from "~/composables/useMatchCameraStatus";

const props = defineProps<{
  matchId: string;
}>();

const { lineups, players, error, loaded, refresh } = useMatchCameraStatus(
  () => props.matchId,
);

type CallState = {
  talking: boolean;
  connecting: boolean;
  pc: RTCPeerConnection | null;
  stream: MediaStream | null;
};

const calls = reactive<Record<string, CallState>>({});
const unmuted = reactive<Record<string, boolean>>({});
// Deliberately not reactive: a template ref callback writes to this on every
// render, and doing that to a ref is a reactive write during render.
const selfPreviews: Record<string, HTMLVideoElement | null> = {};
const callError = ref<string | null>(null);
let unmounted = false;

function callState(steamId: string): CallState {
  if (!calls[steamId]) {
    calls[steamId] = {
      talking: false,
      connecting: false,
      pc: null,
      stream: null,
    };
  }

  return calls[steamId];
}

// Read-only lookups for the template: callState() writes, and writing to a
// reactive during render re-triggers it.
function isTalking(steamId: string) {
  return calls[steamId]?.talking === true;
}

function isConnecting(steamId: string) {
  return calls[steamId]?.connecting === true;
}

function isListening(steamId: string) {
  return unmuted[steamId] === true;
}

function toggleListen(steamId: string) {
  unmuted[steamId] = !isListening(steamId);
}

type TileState = "talking" | "stalled" | "offline" | "live";

function tileState(player: CameraPlayerStatus): TileState {
  if (isTalking(player.steamId)) {
    return "talking";
  }

  if (!player.ready || player.health === "down") {
    return "offline";
  }

  if (player.health === "stalled") {
    return "stalled";
  }

  return "live";
}

// The camera API only knows a steam id and a name; the rest of the app renders
// players with their avatar, so pull the same profile rows it uses.
const PROFILES = gql`
  query CameraGridProfiles($steamIds: [bigint!]!) {
    players(where: { steam_id: { _in: $steamIds } }) {
      steam_id
      name
      avatar_url
      custom_avatar_url
      country
      role
    }
  }
`;

const steamIds = computed(() => players.value.map((player) => player.steamId));

const { result: profileResult } = useQuery<{ players: Array<any> }>(
  PROFILES,
  () => ({ steamIds: steamIds.value }),
  () => ({
    enabled: steamIds.value.length > 0,
    fetchPolicy: "cache-first",
  }),
);

const profiles = computed(() => {
  const map: Record<string, any> = {};

  for (const profile of profileResult.value?.players ?? []) {
    map[String(profile.steam_id)] = profile;
  }

  return map;
});

function playerFor(player: CameraPlayerStatus) {
  const profile = profiles.value[player.steamId];

  if (profile) {
    return profile;
  }

  return {
    steam_id: player.steamId,
    name: player.name?.trim() || player.steamId,
  };
}

const TALK_FPS = 20;
const TALK_BITRATE = 300_000;

// A ceiling on the encoder, not just on the capture: an organizer with several
// calls open is encoding one stream per call.
async function capTalkEncoder(pc: RTCPeerConnection) {
  const sender = pc
    .getSenders()
    .find((candidate) => candidate.track?.kind === "video");

  if (!sender) {
    return;
  }

  try {
    const parameters = sender.getParameters();

    parameters.encodings = parameters.encodings?.length
      ? parameters.encodings
      : [{}];

    for (const encoding of parameters.encodings) {
      encoding.maxBitrate = TALK_BITRATE;
      encoding.maxFramerate = TALK_FPS;
    }

    await sender.setParameters(parameters);
  } catch {
    // Older engines reject parts of setParameters; the call is fine without it.
  }
}

async function startCall(steamId: string) {
  const state = callState(steamId);

  if (state.talking || state.connecting) {
    return;
  }

  state.connecting = true;

  try {
    // The player sees this in a thumbnail in the corner of their phone, and the
    // organizer may have several calls open at once, so it is capped the same
    // way the players' own cameras are rather than taking whatever the webcam
    // offers -- which is 720p30 on most of them.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        height: { ideal: 360 },
        frameRate: { ideal: TALK_FPS, max: 30 },
      },
      audio: true,
    });
    state.stream = stream;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    state.pc = pc;

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    await negotiateWebRtc(
      pc,
      cameraAdminTalkUrl(props.matchId, steamId),
      "include",
    );

    await capTalkEncoder(pc);

    // Negotiation outlives the component often enough to matter: the teardown
    // on unmount already ran and would otherwise be undone right here.
    if (unmounted) {
      void endCall(steamId);
      return;
    }

    state.talking = true;
    unmuted[steamId] = true;

    const preview = selfPreviews[steamId];
    if (preview) {
      preview.srcObject = stream;
    }

    callError.value = null;
  } catch (caught) {
    callError.value =
      caught instanceof Error ? caught.message : String(caught);
    teardownCall(steamId);
  } finally {
    state.connecting = false;
  }
}

function teardownCall(steamId: string) {
  const state = callState(steamId);

  state.pc?.close();
  state.pc = null;

  for (const track of state.stream?.getTracks() ?? []) {
    track.stop();
  }

  state.stream = null;
  state.talking = false;
  unmuted[steamId] = false;
}

async function endCall(steamId: string) {
  teardownCall(steamId);
  await hangupAdminTalk(props.matchId, steamId);
}

function toggleCall(steamId: string) {
  if (isTalking(steamId)) {
    void endCall(steamId);
    return;
  }

  void startCall(steamId);
}

onBeforeUnmount(() => {
  unmounted = true;

  for (const steamId of Object.keys(calls)) {
    const state = calls[steamId];

    // Not gated on `talking`: a call still connecting already holds a live
    // getUserMedia stream and an open peer connection, and skipping it leaves
    // the webcam publishing with the recording indicator lit.
    if (state.talking || state.stream || state.pc) {
      void endCall(steamId);
    }
  }
});
</script>

<template>
  <div>
    <div v-if="!loaded" class="flex flex-wrap justify-center gap-3">
      <div
        v-for="index in 6"
        :key="index"
        class="w-full overflow-hidden rounded-xl border sm:w-[calc(50%-0.375rem)] xl:w-[calc(33.333%-0.5rem)] 2xl:w-[calc(20%-0.6rem)]"
      >
        <div class="aspect-video animate-pulse bg-muted/40"></div>
        <div class="flex items-center gap-2 border-t border-border/60 p-2.5">
          <div class="h-7 w-7 animate-pulse rounded-md bg-muted/50"></div>
          <div class="h-3 w-24 animate-pulse rounded bg-muted/50"></div>
        </div>
      </div>
    </div>

    <div
      v-else-if="error"
      class="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center"
    >
      <span
        class="flex h-11 w-11 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive"
      >
        <LucideTriangleAlert class="h-5 w-5" />
      </span>
      <p
        class="break-words font-mono text-[11px] leading-relaxed text-destructive"
      >
        {{ error }}
      </p>
      <Button variant="secondary" size="sm" @click="refresh">
        <LucideRefreshCw class="h-3.5 w-3.5" />
        {{ $t("camera.retry") }}
      </Button>
    </div>

    <div v-else class="flex flex-col gap-7">
      <p
        v-if="callError"
        class="break-words rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-[11px] text-destructive"
      >
        {{ callError }}
      </p>

      <section v-for="lineup in lineups" :key="lineup.id">
        <div class="mb-3 flex items-center gap-3">
          <div class="flex min-w-0 items-center gap-[0.6rem]">
            <span
              class="h-[2px] w-[10px] shrink-0 bg-[hsl(var(--tac-amber))]"
            ></span>
            <span
              class="truncate font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ lineup.name }}
            </span>
          </div>
          <span
            class="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.55rem] tabular-nums tracking-[0.16em] text-muted-foreground/70"
          >
            {{ lineup.players.filter((player) => player.ready).length }}/{{
              lineup.players.length
            }}
          </span>
          <span class="h-px flex-1 bg-border/60"></span>
        </div>

        <p
          v-if="!lineup.players.length"
          class="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground/70"
        >
          {{ $t("camera.admin_empty") }}
        </p>

        <!-- flex-wrap with fractional tiles rather than an auto-fit grid, so a
             lone fifth player centres under the row above instead of hugging
             the left edge. -->
        <div v-else class="flex flex-wrap justify-center gap-3">
          <article
            v-for="player in lineup.players"
            :key="player.steamId"
            class="group w-full overflow-hidden rounded-xl border bg-card/40 transition-colors sm:w-[calc(50%-0.375rem)] xl:w-[calc(33.333%-0.5rem)] 2xl:w-[calc(20%-0.6rem)]"
            :class="{
              'border-[hsl(var(--tac-amber)/0.6)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.25)]':
                tileState(player) === 'talking',
              'border-destructive/60': tileState(player) === 'stalled',
              'border-destructive/30': tileState(player) === 'offline',
            }"
          >
            <div class="relative aspect-video bg-black">
              <CameraFeed
                :match-id="matchId"
                :steam-id="player.steamId"
                :state="tileState(player)"
                :unmuted="isListening(player.steamId)"
                @update:unmuted="toggleListen(player.steamId)"
              />

              <!-- Working is the expected state and needs no badge: a quiet
                   grid is what lets a bad tile catch the eye. -->
              <span
                v-if="tileState(player) === 'stalled'"
                class="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-destructive/60 bg-black/70 px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.2em] text-destructive backdrop-blur-sm"
              >
                <span
                  class="inline-flex h-1 w-1 animate-pulse rounded-full bg-current"
                ></span>
                {{ $t("camera.tile.stalled") }}
              </span>

              <div
                v-show="isTalking(player.steamId)"
                class="absolute bottom-2 right-2 z-10 w-1/4 overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-black"
              >
                <video
                  :ref="
                    (el) =>
                      (selfPreviews[player.steamId] = el as HTMLVideoElement)
                  "
                  class="block w-full"
                  autoplay
                  playsinline
                  muted
                ></video>
                <span
                  class="pointer-events-none absolute bottom-0 left-0 right-0 bg-black/60 text-center font-mono text-[0.45rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
                >
                  {{ $t("camera.you") }}
                </span>
              </div>
            </div>

            <div
              class="flex items-center gap-2 border-t border-border/60 bg-background/40 px-2.5 py-1.5"
            >
              <PlayerDisplay
                class="min-w-0 flex-1"
                size="xs"
                :player="playerFor(player)"
                :show-flag="false"
                :show-role="false"
                :show-elo="false"
                :show-online="false"
                :truncate-name="true"
              />

              <!-- Reserved width: the label swaps between call and hang up, and
                   a tile that resizes under the cursor gets misclicked. -->
              <Button
                size="sm"
                class="min-w-[6.25rem] shrink-0"
                :variant="isTalking(player.steamId) ? 'destructive' : 'outline'"
                :disabled="!player.ready || isConnecting(player.steamId)"
                @click="toggleCall(player.steamId)"
              >
                <LucideLoader2
                  v-if="isConnecting(player.steamId)"
                  class="h-3.5 w-3.5 animate-spin"
                />
                <component
                  :is="isTalking(player.steamId) ? LucideVideoOff : LucideVideo"
                  v-else
                  class="h-3.5 w-3.5"
                />
                {{
                  isTalking(player.steamId)
                    ? $t("camera.end_call")
                    : $t("camera.call")
                }}
              </Button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
