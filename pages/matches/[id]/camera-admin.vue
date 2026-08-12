<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from "vue";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import { Button } from "~/components/ui/button";
import { LucideLoader2, LucideVideo, LucideVideoOff } from "lucide-vue-next";
import {
  cameraAdminTalkUrl,
  cameraAdminWatchUrl,
  fetchCameraPlayers,
  hangupAdminTalk,
  negotiateWebRtc,
  type CameraLineup,
} from "~/composables/useCameraApi";

// Opened in a popup from MatchActions so an organizer can keep the whole
// roster on screen alongside the match page.
definePageMeta({
  layout: false,
});

const route = useRoute();
const matchId = computed(() => String(route.params.id));

const loading = ref(true);
const error = ref<string | null>(null);
const lineups = ref<Array<CameraLineup>>([]);

type CallState = {
  talking: boolean;
  connecting: boolean;
  pc: RTCPeerConnection | null;
  stream: MediaStream | null;
};

const calls = reactive<Record<string, CallState>>({});
const selfPreviews = ref<Record<string, HTMLVideoElement | null>>({});

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

async function refresh() {
  try {
    lineups.value = (await fetchCameraPlayers(matchId.value)).lineups;
    error.value = null;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    loading.value = false;
  }
}

async function startCall(steamId: string) {
  const state = callState(steamId);

  if (state.talking || state.connecting) {
    return;
  }

  state.connecting = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
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
      cameraAdminTalkUrl(matchId.value, steamId),
      "include",
    );

    state.talking = true;

    const preview = selfPreviews.value[steamId];
    if (preview) {
      preview.srcObject = stream;
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
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
}

async function endCall(steamId: string) {
  teardownCall(steamId);
  await hangupAdminTalk(matchId.value, steamId);
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await refresh();
  refreshTimer = setInterval(refresh, 5000);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  for (const steamId of Object.keys(calls)) {
    if (calls[steamId].talking) {
      void endCall(steamId);
    }
  }
});
</script>

<template>
  <div class="min-h-screen bg-background p-4">
    <h1 class="mb-4 text-center text-sm font-semibold uppercase tracking-widest">
      {{ $t("camera.admin_title") }}
    </h1>

    <div v-if="loading" class="flex justify-center py-12">
      <LucideLoader2 class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <p v-else-if="error" class="break-words text-center text-xs text-destructive">
      {{ error }}
    </p>

    <div v-else class="flex flex-col gap-6">
      <section v-for="lineup in lineups" :key="lineup.id">
        <h2 class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {{ lineup.name }}
        </h2>

        <p
          v-if="!lineup.players.length"
          class="text-xs text-muted-foreground"
        >
          {{ $t("camera.admin_empty") }}
        </p>

        <!-- flex-wrap with half-width tiles rather than an auto-fit grid, so a
             lone fifth player centres under the row above instead of hugging
             the left edge. -->
        <div v-else class="flex flex-wrap justify-center gap-3">
          <div
            v-for="player in lineup.players"
            :key="player.steamId"
            class="w-[calc(50%-0.375rem)] overflow-hidden rounded-lg border"
            :class="
              callState(player.steamId).talking
                ? 'border-emerald-500'
                : player.health !== 'live'
                  ? 'border-destructive'
                  : ''
            "
          >
            <div class="relative aspect-video bg-black">
              <WhepPlayer
                v-if="player.ready"
                :whep-url="cameraAdminWatchUrl(matchId, player.steamId)"
                :muted="!callState(player.steamId).talking"
              />
              <div
                v-else
                class="flex h-full items-center justify-center text-[0.65rem] uppercase tracking-widest text-muted-foreground"
              >
                {{ $t("camera.offline") }}
              </div>

              <span
                v-if="player.health === 'stalled'"
                class="absolute left-2 top-2 rounded bg-destructive px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-destructive-foreground"
              >
                {{ $t("camera.stalled") }}
              </span>

              <video
                v-show="callState(player.steamId).talking"
                :ref="
                  (el) => (selfPreviews[player.steamId] = el as HTMLVideoElement)
                "
                class="absolute bottom-2 right-2 w-1/4 rounded border border-white/20 bg-black"
                autoplay
                playsinline
                muted
              ></video>
            </div>

            <div class="flex items-center justify-between gap-2 p-2">
              <span class="truncate text-xs">{{ player.name }}</span>
              <Button
                size="sm"
                :variant="
                  callState(player.steamId).talking ? 'destructive' : 'default'
                "
                :disabled="!player.ready || callState(player.steamId).connecting"
                @click="
                  callState(player.steamId).talking
                    ? endCall(player.steamId)
                    : startCall(player.steamId)
                "
              >
                <component
                  :is="
                    callState(player.steamId).talking
                      ? LucideVideoOff
                      : LucideVideo
                  "
                  class="mr-1 h-3.5 w-3.5"
                />
                {{
                  callState(player.steamId).talking
                    ? $t("camera.end_call")
                    : $t("camera.call")
                }}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
