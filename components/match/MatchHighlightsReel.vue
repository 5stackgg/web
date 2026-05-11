<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type Ref,
} from "vue";
import {
  ArrowUpRight,
  Clock,
  Crosshair,
  Film,
  ListVideo,
  MapPin,
  Maximize,
  Minimize,
  Play,
  Shield,
  Volume2,
  VolumeX,
} from "lucide-vue-next";
import type { Clip } from "~/types/clip";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { useClipModal } from "~/composables/useClipModal";

const props = defineProps<{
  match: any;
}>();

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain as string);
const { openClip, activeClipId } = useClipModal();

// Provided by pages/matches/[id].vue (single shared subscription).
const injectedClips = inject<Ref<Clip[]>>("matchClips");
const clips = computed<Clip[]>(() => injectedClips?.value ?? []);

const playerFilter = ref<string | null>(null);

type PlayerOption = {
  steamId: string;
  name: string;
  avatarSrc: string | null;
  side: "1" | "2" | null;
  teamName: string | null;
  count: number;
};
function lineupForSteamId(steamId: string | null | undefined) {
  if (!steamId || !props.match) return null;
  const lineups = [
    { side: "1" as const, lineup: props.match.lineup_1 },
    { side: "2" as const, lineup: props.match.lineup_2 },
  ];
  return (
    lineups.find(({ lineup }) =>
      lineup?.lineup_players?.some(
        (member: any) =>
          String(member.steam_id ?? member.player?.steam_id) ===
          String(steamId),
      ),
    ) ?? null
  );
}
const playerOptions = computed<PlayerOption[]>(() => {
  const map = new Map<string, PlayerOption>();
  for (const c of clips.value) {
    const sid = c.target_steam_id;
    if (!sid) continue;
    const existing = map.get(sid);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const lineup = lineupForSteamId(sid);
    map.set(sid, {
      steamId: sid,
      name: c.target?.name ?? `#${sid.slice(-4)}`,
      avatarSrc: resolveAvatarUrl(
        c.target?.avatar_url ?? null,
        apiDomain.value,
      ),
      side: lineup?.side ?? null,
      teamName: lineup?.lineup?.name ?? null,
      count: 1,
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.side !== b.side) return (a.side ?? "9").localeCompare(b.side ?? "9");
    if (a.count !== b.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });
});

const filteredClips = computed(() => {
  if (!playerFilter.value) return clips.value;
  return clips.value.filter((c) => c.target_steam_id === playerFilter.value);
});

const inlineVideoRef = ref<HTMLVideoElement | null>(null);
const inlineStageRef = ref<HTMLElement | null>(null);
const isFullscreen = ref(false);
const activeInlineClipId = ref<string | null>(null);
const inlineProgress = ref(0);
const inlinePlaying = ref(false);
const inlineAutoAdvanced = ref(false);
const showIntroOverlay = ref(false);
let introOverlayTimer: ReturnType<typeof setTimeout> | null = null;
// Try to autoplay with audio; browsers may force-mute on autoplay until the
// user interacts. We track that state so the mute toggle reflects reality.
const inlineMuted = ref(false);
const inlineVolume = ref(1);
function toggleMute() {
  const video = inlineVideoRef.value;
  inlineMuted.value = !inlineMuted.value;
  if (video) {
    video.muted = inlineMuted.value;
    // Restore audible volume on unmute — if the slider was dragged to
    // zero before muting, leaving it there means the user clicks
    // unmute and still hears nothing. Default back to full volume so
    // the slider can immediately fine-tune from there.
    if (!inlineMuted.value) {
      if (inlineVolume.value <= 0.01) inlineVolume.value = 1;
      video.volume = inlineVolume.value;
    }
  }
}
// Mirrors WhepPlayer.setVolume: sliding to ~0 implicitly mutes, sliding
// up from a muted state implicitly unmutes, so the mute icon and the
// slider position never disagree.
function setInlineVolume(v: number) {
  inlineVolume.value = Math.max(0, Math.min(1, v));
  const el = inlineVideoRef.value;
  if (!el) return;
  el.volume = inlineVolume.value;
  if (inlineVolume.value <= 0.01) {
    el.muted = true;
    inlineMuted.value = true;
  } else if (el.muted) {
    el.muted = false;
    inlineMuted.value = false;
  }
}

async function toggleFullscreen() {
  const stage = inlineStageRef.value;
  if (!stage) return;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
  };
  const el = stage as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  const fsElement = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  try {
    if (fsElement) {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } else {
      await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    }
  } catch {
    // ignore — browser may reject without a user gesture
  }
}

function onFullscreenChange() {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  const fsElement = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  isFullscreen.value = fsElement === inlineStageRef.value;
}

if (typeof document !== "undefined") {
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "--";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return null;
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  return `${Math.floor(diff / (30 * day))}mo ago`;
}

const featuredClip = computed<Clip | null>(() => {
  const list = filteredClips.value.length ? filteredClips.value : clips.value;
  if (!list.length) return null;
  if (activeInlineClipId.value) {
    const active = list.find((c) => c.id === activeInlineClipId.value);
    if (active) return active;
  }
  return list[0] ?? null;
});
const featuredClipImage = computed(() => {
  const c = featuredClip.value;
  return c?.thumbnail_download_url ?? c?.match_map?.map?.poster ?? null;
});
const reelQueue = computed(() => filteredClips.value);
const featuredPlayer = computed(() =>
  featuredClip.value?.target_steam_id
    ? playerOptions.value.find(
        (p) => p.steamId === featuredClip.value?.target_steam_id,
      )
    : null,
);
const nextInlineClip = computed<Clip | null>(() => {
  if (!featuredClip.value) return null;
  const list = filteredClips.value.length ? filteredClips.value : clips.value;
  const index = list.findIndex((c) => c.id === featuredClip.value?.id);
  if (index < 0) return null;
  return list[index + 1] ?? null;
});

// Try to play with the user's current mute preference; on a browser
// autoplay-policy rejection (sound not allowed yet), fall back to muted.
async function tryPlay(video: HTMLVideoElement) {
  video.muted = inlineMuted.value;
  try {
    await video.play();
    inlinePlaying.value = true;
  } catch {
    if (!video.muted) {
      video.muted = true;
      inlineMuted.value = true;
      try {
        await video.play();
        inlinePlaying.value = true;
        return;
      } catch {
        // fall through
      }
    }
    inlinePlaying.value = false;
  }
}

async function playInlineClip(id: string) {
  activeInlineClipId.value = id;
  inlineProgress.value = 0;
  inlineAutoAdvanced.value = false;
  await nextTick();
  const video = inlineVideoRef.value;
  if (!video) return;
  await tryPlay(video);
}

async function toggleInlinePlayback() {
  const video = inlineVideoRef.value;
  if (!video || !featuredClip.value?.download_url) {
    if (featuredClip.value) openClip(featuredClip.value.id);
    return;
  }
  if (video.paused) {
    await tryPlay(video);
  } else {
    video.pause();
    inlinePlaying.value = false;
  }
}

// `timeupdate` fires roughly every 250ms which makes the progress bar
// look jumpy. We instead poll `currentTime` each animation frame while
// playing, which gives a smooth fill at 60fps.
let progressRafId: number | null = null;
function stopProgressLoop() {
  if (progressRafId !== null) {
    cancelAnimationFrame(progressRafId);
    progressRafId = null;
  }
}
function syncProgress() {
  const video = inlineVideoRef.value;
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
    inlineProgress.value = 0;
    return;
  }
  inlineProgress.value = Math.min(1, video.currentTime / video.duration);
  const remaining = video.duration - video.currentTime;
  if (nextInlineClip.value && remaining <= 0.35 && !inlineAutoAdvanced.value) {
    inlineAutoAdvanced.value = true;
    void playInlineClip(nextInlineClip.value.id);
  }
}
function tickProgress() {
  syncProgress();
  if (inlinePlaying.value) {
    progressRafId = requestAnimationFrame(tickProgress);
  } else {
    progressRafId = null;
  }
}
function startProgressLoop() {
  if (progressRafId !== null) return;
  progressRafId = requestAnimationFrame(tickProgress);
}

function onInlineEnded() {
  inlinePlaying.value = false;
  stopProgressLoop();
  inlineProgress.value = 1;
  if (nextInlineClip.value && !inlineAutoAdvanced.value) {
    inlineAutoAdvanced.value = true;
    void playInlineClip(nextInlineClip.value.id);
  }
}

onBeforeUnmount(() => {
  stopProgressLoop();
  if (introOverlayTimer) clearTimeout(introOverlayTimer);
  if (typeof document !== "undefined") {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  }
});

watch(
  [filteredClips, clips],
  () => {
    const list = filteredClips.value.length ? filteredClips.value : clips.value;
    if (!list.some((c) => c.id === activeInlineClipId.value)) {
      activeInlineClipId.value = list[0]?.id ?? null;
    }
  },
  { immediate: true },
);

watch(activeClipId, (id) => {
  if (!id) return;
  const video = inlineVideoRef.value;
  if (video && !video.paused) {
    video.pause();
    inlinePlaying.value = false;
    stopProgressLoop();
  }
});

watch(
  () => featuredClip.value?.id,
  (id) => {
    inlineProgress.value = 0;
    inlinePlaying.value = false;
    inlineAutoAdvanced.value = false;
    stopProgressLoop();
    if (introOverlayTimer) clearTimeout(introOverlayTimer);
    if (id) {
      // Briefly reveal the player/title overlay so viewers see what's
      // starting next, then fade out so the clip is unobstructed.
      showIntroOverlay.value = true;
      introOverlayTimer = setTimeout(() => {
        showIntroOverlay.value = false;
      }, 1500);
    } else {
      showIntroOverlay.value = false;
    }
  },
);

function clipTeamName(c: Clip): string | null {
  return lineupForSteamId(c.target_steam_id)?.lineup?.name ?? null;
}
</script>

<template>
  <section
    v-if="featuredClip"
    class="match-reel-stage relative overflow-hidden"
  >
    <NuxtImg
      v-if="featuredClipImage"
      :src="featuredClipImage"
      :alt="featuredClip.title ?? 'Featured highlight'"
      class="absolute inset-0 h-full w-full object-cover opacity-[0.18]"
    />
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,hsl(var(--tac-amber)/0.18),transparent_36%),linear-gradient(135deg,hsl(var(--background)/0.92)_0%,hsl(var(--card)/0.86)_56%,hsl(var(--background)/0.96)_100%)]"
    ></div>

    <div class="relative grid gap-4 p-3 sm:p-4 lg:grid-cols-2">
      <div
        ref="inlineStageRef"
        class="group/feature relative aspect-video w-full overflow-hidden rounded-md border border-border/60 bg-black text-left"
        :class="
          isFullscreen
            ? 'flex items-center justify-center !aspect-auto !rounded-none !border-0'
            : ''
        "
      >
        <video
          v-if="featuredClip.download_url"
          :key="featuredClip.id"
          ref="inlineVideoRef"
          :src="featuredClip.download_url"
          :poster="featuredClipImage ?? undefined"
          class="absolute inset-0 h-full w-full cursor-pointer object-contain transition-transform duration-500 group-hover/feature:scale-[1.025]"
          :muted="inlineMuted"
          playsinline
          preload="auto"
          @ended="onInlineEnded"
          @loadedmetadata="syncProgress"
          @pause="
            inlinePlaying = false;
            stopProgressLoop();
          "
          @play="
            inlinePlaying = true;
            startProgressLoop();
          "
          @volumechange="
            inlineMuted = ($event.target as HTMLVideoElement).muted;
            inlineVolume = ($event.target as HTMLVideoElement).volume;
          "
          @click="toggleInlinePlayback"
        />
        <NuxtImg
          v-else-if="featuredClipImage"
          :src="featuredClipImage"
          :alt="featuredClip.title ?? 'Featured highlight'"
          class="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover/feature:scale-[1.025]"
        />
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center text-muted-foreground"
        >
          <Film class="h-10 w-10 opacity-50" />
        </div>
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(180deg,transparent_0%,hsl(0_0%_0%/0.7)_100%)] transition-opacity duration-300"
          :class="
            inlinePlaying && !showIntroOverlay
              ? 'opacity-0 group-hover/feature:opacity-100'
              : 'opacity-100'
          "
        ></div>
        <div
          class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 transition-opacity duration-300"
          :class="
            inlinePlaying && !showIntroOverlay
              ? 'opacity-0 group-hover/feature:opacity-100'
              : 'opacity-100'
          "
        >
          <div
            class="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--tac-amber)/0.55)] bg-black/65 px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))] backdrop-blur-md"
          >
            <Play class="h-3 w-3 fill-current" />
            Inline Reel
          </div>
          <div class="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              class="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-2.5 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-white/80 backdrop-blur-md transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
              :title="`Open ${featuredClip.title ?? 'clip'} details`"
              @click.stop="openClip(featuredClip.id)"
            >
              Details
              <ArrowUpRight class="h-3 w-3" />
            </button>
            <span
              v-if="(featuredClip.kills_count ?? 0) > 0"
              class="inline-flex items-center gap-1 rounded border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.85)] px-2 py-1 font-mono text-[0.65rem] font-bold text-white tabular-nums shadow-[0_0_10px_hsl(var(--destructive)/0.4)]"
              :title="`${featuredClip.kills_count} kill${featuredClip.kills_count === 1 ? '' : 's'} in clip`"
            >
              <Crosshair class="h-3 w-3" />
              {{ featuredClip.kills_count }}K
            </span>
            <span
              class="rounded bg-black/75 px-2 py-1 font-mono text-[0.65rem] text-white"
            >
              {{ formatDuration(featuredClip.duration_ms) }}
            </span>
          </div>
        </div>
        <button
          v-if="!inlinePlaying"
          type="button"
          class="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-white/16 text-white shadow-[0_0_30px_hsl(var(--tac-amber)/0.35)] backdrop-blur-sm transition-transform duration-200 hover:scale-110"
          :title="`Play ${featuredClip.title ?? 'clip'} inline`"
          @click.stop="toggleInlinePlayback"
        >
          <Play class="h-7 w-7 translate-x-0.5 fill-current" />
        </button>
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-300"
          :class="
            inlinePlaying && !showIntroOverlay
              ? 'opacity-0 group-hover/feature:opacity-100'
              : 'opacity-100'
          "
        >
          <div class="p-4 sm:p-5">
            <div
              v-if="nextInlineClip"
              class="mb-2 flex flex-wrap items-center gap-2 font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/55"
            >
              <span>Next: {{ nextInlineClip.target?.name ?? "clip" }}</span>
              <span
                v-if="(nextInlineClip.kills_count ?? 0) > 0"
                class="inline-flex items-center gap-1 rounded border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.85)] px-1.5 py-0.5 text-white tabular-nums"
              >
                <Crosshair class="h-2.5 w-2.5" />
                {{ nextInlineClip.kills_count }}K
              </span>
              <span v-if="nextInlineClip.match_map?.map?.name">
                · {{ nextInlineClip.match_map.map.name }}
              </span>
            </div>
            <div class="mb-2 flex min-w-0 items-center gap-2.5">
              <span
                class="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.14)]"
              >
                <NuxtImg
                  v-if="featuredPlayer?.avatarSrc"
                  :src="featuredPlayer.avatarSrc"
                  :alt="featuredPlayer.name"
                  class="h-full w-full object-cover"
                />
                <span
                  v-else
                  class="font-mono text-xs font-bold uppercase text-[hsl(var(--tac-amber))]"
                >
                  {{
                    featuredClip.target?.name?.charAt(0) ??
                    featuredClip.title?.charAt(0) ??
                    "H"
                  }}
                </span>
              </span>
              <span class="min-w-0 truncate text-xs font-semibold text-white">
                {{ featuredClip.target?.name ?? "Match highlight" }}
                <span
                  v-if="featuredPlayer?.teamName"
                  class="font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/55"
                >
                  · {{ featuredPlayer.teamName }}
                </span>
              </span>
            </div>
            <h2
              class="max-w-3xl truncate text-base font-bold uppercase leading-tight text-white sm:text-xl"
            >
              {{ featuredClip.title ?? "Untitled highlight" }}
            </h2>
          </div>
        </div>
        <div class="absolute bottom-3 right-3 z-[3] flex items-center gap-2">
          <!-- Audio tray — same hover-expand slider pattern as WhepPlayer
               so once the viewer unmutes they can immediately dial the
               volume in without leaving the player surface. Slider is
               kept out of the DOM while muted so the rail doesn't sit
               next to a "tap to unmute" affordance suggesting it's
               already producing sound. -->
          <div class="flex items-center group/vol">
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/85 backdrop-blur-md transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
              :title="inlineMuted ? 'Unmute' : 'Mute'"
              @click.stop="toggleMute"
            >
              <VolumeX v-if="inlineMuted" class="h-4 w-4" />
              <Volume2 v-else class="h-4 w-4" />
            </button>
            <input
              v-if="!inlineMuted"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="inlineVolume"
              aria-label="Volume"
              class="vol-slider ml-0 w-0 group-hover/vol:w-20 group-hover/vol:ml-2 focus-visible:w-20 focus-visible:ml-2 transition-all duration-200 cursor-pointer"
              @click.stop
              @mousedown.stop
              @input="
                setInlineVolume(
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/85 backdrop-blur-md transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
            :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
            @click.stop="toggleFullscreen"
          >
            <Minimize v-if="isFullscreen" class="h-4 w-4" />
            <Maximize v-else class="h-4 w-4" />
          </button>
        </div>
        <span
          class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/10"
        >
          <span
            class="absolute inset-y-0 left-0 bg-[hsl(var(--tac-amber))] shadow-[0_0_12px_hsl(var(--tac-amber)/0.45)]"
            :style="{ width: `${(inlineProgress * 100).toFixed(2)}%` }"
          ></span>
        </span>
      </div>

      <aside
        class="reel-queue relative flex max-h-80 min-h-0 flex-col overflow-hidden rounded-md border border-border/60 bg-card/35 [backdrop-filter:blur(8px)] lg:aspect-video lg:max-h-none"
      >
        <div
          class="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5"
        >
          <span
            class="inline-flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <ListVideo class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
            Up Next
          </span>
          <span
            class="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground tabular-nums"
          >
            {{ filteredClips.length }} clips
          </span>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <button
            v-for="(c, index) in reelQueue"
            :key="c.id"
            type="button"
            class="group/queue queue-row relative flex w-full min-w-0 items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left hover:border-[hsl(var(--tac-amber)/0.45)] hover:bg-[hsl(var(--tac-amber)/0.08)]"
            :class="
              c.id === featuredClip.id
                ? 'queue-row--active border-[hsl(var(--tac-amber)/0.65)] bg-[hsl(var(--tac-amber)/0.16)]'
                : ''
            "
            @click="playInlineClip(c.id)"
          >
            <span
              class="queue-row__rail pointer-events-none absolute inset-y-1 left-0 w-[3px] rounded-full bg-[hsl(var(--tac-amber))]"
            ></span>
            <span
              class="relative flex w-6 shrink-0 items-center justify-center"
              :title="
                c.id === featuredClip.id
                  ? inlinePlaying
                    ? 'Now playing'
                    : 'Selected'
                  : ''
              "
            >
              <span
                class="queue-row__index absolute inset-0 flex items-center justify-center font-mono text-[0.62rem] text-muted-foreground tabular-nums"
              >
                {{ String(index + 1).padStart(2, "0") }}
              </span>
              <span class="queue-row__dot relative flex h-2 w-2">
                <span
                  v-if="c.id === featuredClip.id && inlinePlaying"
                  class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
                ></span>
                <span
                  class="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tac-amber))]"
                ></span>
              </span>
            </span>
            <span
              class="relative h-12 w-20 shrink-0 overflow-hidden rounded border border-border/50 bg-black"
            >
              <video
                v-if="c.download_url"
                :src="c.download_url"
                :poster="
                  c.thumbnail_download_url ??
                  c.match_map?.map?.poster ??
                  undefined
                "
                class="h-full w-full object-cover opacity-80"
                muted
                playsinline
                preload="metadata"
              />
              <NuxtImg
                v-else-if="c.thumbnail_download_url ?? c.match_map?.map?.poster"
                :src="
                  c.thumbnail_download_url ?? c.match_map?.map?.poster ?? ''
                "
                :alt="c.title ?? 'Highlight'"
                class="h-full w-full object-cover opacity-80"
              />
              <span
                class="absolute inset-0 flex items-center justify-center bg-black/25 text-white/85"
              >
                <Play class="h-3.5 w-3.5 fill-current" />
              </span>
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-sm font-semibold group-hover/queue:text-[hsl(var(--tac-amber))]"
                :class="
                  c.id === featuredClip.id
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-foreground'
                "
              >
                {{ c.title ?? "Untitled highlight" }}
              </span>
              <span class="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                <span class="truncate text-xs text-muted-foreground">
                  {{ c.target?.name ?? "Player" }}
                </span>
                <span
                  v-if="clipTeamName(c)"
                  class="inline-flex max-w-[7rem] shrink-0 items-center gap-1 rounded border border-[hsl(var(--tac-amber)/0.3)] bg-[hsl(var(--tac-amber)/0.08)] px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
                >
                  <Shield class="h-2.5 w-2.5 shrink-0" />
                  <span class="truncate">{{ clipTeamName(c) }}</span>
                </span>
                <span
                  v-if="c.match_map?.map?.name"
                  class="inline-flex shrink-0 items-center gap-1 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground/80"
                >
                  <MapPin class="h-2.5 w-2.5" />
                  <span class="truncate">{{ c.match_map.map.name }}</span>
                </span>
                <span
                  v-if="formatRelativeTime(c.created_at)"
                  class="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground/60"
                >
                  · {{ formatRelativeTime(c.created_at) }}
                </span>
              </span>
            </span>
            <span class="flex shrink-0 flex-col items-end gap-1">
              <span
                v-if="(c.kills_count ?? 0) > 0"
                class="inline-flex items-center gap-1 rounded border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.85)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white tabular-nums"
                :title="`${c.kills_count} kill${c.kills_count === 1 ? '' : 's'}`"
              >
                <Crosshair class="h-3 w-3" />
                {{ c.kills_count }}K
              </span>
              <span
                class="inline-flex items-center gap-1 font-mono text-[0.58rem] text-muted-foreground tabular-nums"
              >
                <Clock class="h-3 w-3" />
                {{ formatDuration(c.duration_ms) }}
              </span>
            </span>
          </button>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.match-reel-stage {
  border: 1px solid hsl(var(--border) / 0.68);
  border-radius: 0.5rem;
  background: hsl(var(--card) / 0.32);
  box-shadow:
    inset 0 1px 0 hsl(var(--foreground) / 0.07),
    0 24px 70px -36px hsl(0 0% 0% / 0.86);
  backdrop-filter: blur(8px);
}

.match-reel-stage::before {
  content: "";
  pointer-events: none;
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      transparent 0%,
      hsl(var(--tac-amber) / 0.08) 50%,
      transparent 100%
    ),
    repeating-linear-gradient(
      90deg,
      hsl(var(--foreground) / 0.035) 0,
      hsl(var(--foreground) / 0.035) 1px,
      transparent 1px,
      transparent 42px
    );
  opacity: 0.5;
}

.reel-queue ::-webkit-scrollbar {
  width: 7px;
}

.reel-queue ::-webkit-scrollbar-track {
  background: hsl(var(--muted) / 0.25);
}

.reel-queue ::-webkit-scrollbar-thumb {
  background: hsl(var(--tac-amber) / 0.35);
  border-radius: 999px;
}

/* Smooth chrome shifts when a row becomes active, plus crossfade
   between the index number and the now-playing dot. */
.queue-row {
  transition:
    background-color 280ms ease-out,
    border-color 280ms ease-out;
}

.queue-row__rail {
  transform: scaleY(0.4);
  transform-origin: center;
  opacity: 0;
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 280ms ease-out;
}
.queue-row--active .queue-row__rail {
  transform: scaleY(1);
  opacity: 1;
}

.queue-row__index,
.queue-row__dot {
  transition:
    opacity 220ms ease-out,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.queue-row__dot {
  opacity: 0;
  transform: scale(0.4);
}
.queue-row--active .queue-row__dot {
  opacity: 1;
  transform: scale(1);
}
.queue-row--active .queue-row__index {
  opacity: 0;
  transform: scale(0.85);
}

/* Volume slider — minimal styling, sized small so it tucks beside
   the mute pill. Mirrors WhepPlayer.vue so both player surfaces
   share the same audio chrome. */
.vol-slider {
  appearance: none;
  height: 0.25rem;
  background: transparent;
}
.vol-slider:focus {
  outline: none;
}
.vol-slider::-webkit-slider-runnable-track {
  height: 0.25rem;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 9999px;
}
.vol-slider::-moz-range-track {
  height: 0.25rem;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 9999px;
}
.vol-slider::-webkit-slider-thumb {
  appearance: none;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.6);
  margin-top: -0.25rem;
}
.vol-slider::-moz-range-thumb {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.6);
}
</style>
