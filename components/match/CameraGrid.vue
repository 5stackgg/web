<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from "vue";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import { Button } from "~/components/ui/button";
import {
  LucideLoader2,
  LucideRefreshCw,
  LucideTriangleAlert,
  LucideVideo,
  LucideVideoOff,
  LucideVolume2,
  LucideVolumeX,
} from "lucide-vue-next";
import {
  cameraAdminTalkUrl,
  cameraAdminWatchUrl,
  hangupAdminTalk,
  negotiateWebRtc,
  type CameraPlayerStatus,
} from "~/composables/useCameraApi";
import { useMatchCameraStatus } from "~/composables/useMatchCameraStatus";

const props = withDefaults(
  defineProps<{
    matchId: string;
    dense?: boolean;
  }>(),
  { dense: false },
);

const { lineups, error, loaded, refresh } = useMatchCameraStatus(
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
const selfPreviews = ref<Record<string, HTMLVideoElement | null>>({});
const callError = ref<string | null>(null);

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

const tileWidth = computed(() =>
  props.dense
    ? "w-[calc(50%-0.25rem)] lg:w-[calc(25%-0.375rem)] 2xl:w-[calc(16.666%-0.42rem)]"
    : "w-full sm:w-[calc(50%-0.375rem)] xl:w-[calc(33.333%-0.5rem)] 2xl:w-[calc(20%-0.6rem)]",
);

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

function playerName(player: CameraPlayerStatus) {
  return player.name?.trim() || player.steamId;
}

function initials(player: CameraPlayerStatus) {
  const name = player.name?.trim();

  if (!name) {
    return "??";
  }

  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
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
      cameraAdminTalkUrl(props.matchId, steamId),
      "include",
    );

    state.talking = true;
    unmuted[steamId] = true;

    const preview = selfPreviews.value[steamId];
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
  for (const steamId of Object.keys(calls)) {
    if (calls[steamId].talking) {
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
        class="overflow-hidden rounded-xl border"
        :class="tileWidth"
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
            class="group overflow-hidden rounded-xl border bg-card/40 transition-colors"
            :class="[
              tileWidth,
              {
                'border-[hsl(var(--tac-amber)/0.6)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.25)]':
                  tileState(player) === 'talking',
                'border-destructive/60': tileState(player) === 'stalled',
                'border-destructive/30': tileState(player) === 'offline',
              },
            ]"
          >
            <div class="relative aspect-video bg-black">
              <WhepPlayer
                v-if="player.ready"
                :whep-url="cameraAdminWatchUrl(matchId, player.steamId)"
                :muted="!isListening(player.steamId)"
                disable-shortcuts
              />

              <div
                v-else
                class="flex h-full flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(45deg,hsl(var(--muted)/0.25)_0,hsl(var(--muted)/0.25)_1px,transparent_1px,transparent_7px)]"
              >
                <LucideVideoOff class="h-5 w-5 text-muted-foreground/50" />
                <span
                  class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground/60"
                >
                  {{ $t("camera.offline") }}
                </span>
              </div>

              <span
                v-if="tileState(player) !== 'offline'"
                class="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full border bg-black/70 px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.2em] backdrop-blur-sm"
                :class="
                  tileState(player) === 'talking'
                    ? 'border-[hsl(var(--tac-amber)/0.6)] text-[hsl(var(--tac-amber))]'
                    : tileState(player) === 'stalled'
                      ? 'border-destructive/60 text-destructive'
                      : 'border-emerald-500/50 text-emerald-400'
                "
              >
                <span
                  class="inline-flex h-1 w-1 rounded-full bg-current"
                  :class="tileState(player) !== 'live' ? 'animate-pulse' : ''"
                ></span>
                {{ $t(`camera.tile.${tileState(player)}`) }}
              </span>

              <span
                v-if="isListening(player.steamId)"
                class="pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--tac-amber)/0.6)] bg-black/70 px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))] backdrop-blur-sm"
              >
                <LucideVolume2 class="h-2.5 w-2.5" />
                {{ $t("camera.audio_on") }}
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
              class="flex items-center gap-2 border-t border-border/60 bg-background/40 px-2.5 py-2"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-[0.6rem] tracking-[0.06em]"
                :class="
                  tileState(player) === 'offline'
                    ? 'border-border bg-muted/30 text-muted-foreground/70'
                    : 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]'
                "
              >
                {{ initials(player) }}
              </span>

              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-xs font-medium leading-tight">
                  {{ playerName(player) }}
                </span>
                <span
                  v-if="!dense"
                  class="truncate font-mono text-[0.55rem] tracking-[0.12em] text-muted-foreground/60"
                >
                  {{ player.steamId }}
                </span>
              </span>

              <Button
                size="xs"
                variant="outline"
                class="h-7 w-7 shrink-0 p-0"
                :class="
                  isListening(player.steamId)
                    ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] hover:text-[hsl(var(--tac-amber))]'
                    : ''
                "
                :disabled="!player.ready"
                :aria-label="
                  isListening(player.steamId)
                    ? $t('camera.mute')
                    : $t('camera.listen')
                "
                :title="
                  isListening(player.steamId)
                    ? $t('camera.mute')
                    : $t('camera.listen')
                "
                @click="toggleListen(player.steamId)"
              >
                <component
                  :is="
                    isListening(player.steamId) ? LucideVolume2 : LucideVolumeX
                  "
                  class="h-3 w-3"
                />
              </Button>

              <!-- Fixed width: the label swaps between call and hang up, and a
                   tile that resizes under the cursor gets misclicked. -->
              <Button
                size="xs"
                class="h-7 w-[5.75rem] shrink-0 justify-center gap-1.5 px-0 font-mono text-[0.55rem] uppercase tracking-[0.12em]"
                :variant="isTalking(player.steamId) ? 'destructive' : 'outline'"
                :disabled="!player.ready || isConnecting(player.steamId)"
                @click="toggleCall(player.steamId)"
              >
                <LucideLoader2
                  v-if="isConnecting(player.steamId)"
                  class="h-3 w-3 animate-spin"
                />
                <component
                  :is="isTalking(player.steamId) ? LucideVideoOff : LucideVideo"
                  v-else
                  class="h-3 w-3"
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
