<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowUpRight,
  Check,
  Crosshair,
  Film,
  ListVideo,
  Share2,
} from "lucide-vue-next";
import type { Clip } from "~/types/clip";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { useClipModal } from "~/composables/useClipModal";
import { useClipShare } from "~/composables/useClipShare";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";

const { t } = useI18n();

const props = defineProps<{
  match: any;
}>();

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain as string);
const { openClip, activeClipId } = useClipModal();
const { copiedClipId, shareClip } = useClipShare();

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

// Video chrome (play/pause overlay, mute, volume, fullscreen, progress
// bar) lives inside ClipPlayer now. We just track which clip is
// featured and what state the player exposes via events.
const inlinePlayerRef = ref<InstanceType<typeof ClipPlayer> | null>(null);
const activeInlineClipId = ref<string | null>(null);
const inlinePlaying = ref(false);
const inlineAutoAdvanced = ref(false);

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
  if (diff < 0) return t("time_ago.just_now");
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return t("time_ago.just_now");
  if (diff < hour)
    return t("time_ago.minutes", { n: Math.floor(diff / minute) });
  if (diff < day) return t("time_ago.hours", { n: Math.floor(diff / hour) });
  if (diff < 7 * day) return t("time_ago.days", { n: Math.floor(diff / day) });
  if (diff < 30 * day)
    return t("time_ago.weeks", { n: Math.floor(diff / (7 * day)) });
  return t("time_ago.months", { n: Math.floor(diff / (30 * day)) });
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
const fullQueue = computed(() => filteredClips.value);

// Infinite-scroll the queue so a match with hundreds of clips doesn't
// hand the browser hundreds of DOM rows up-front. We keep the full set
// in memory (so featured/next/queue counts stay accurate) and only
// render a sliding window that grows when the sentinel scrolls into view.
const QUEUE_PAGE_SIZE = 30;
const queueVisibleCount = ref(QUEUE_PAGE_SIZE);
const reelQueue = computed(() =>
  fullQueue.value.slice(0, queueVisibleCount.value),
);
const hasMoreQueue = computed(
  () => queueVisibleCount.value < fullQueue.value.length,
);
const queueScrollEl = ref<HTMLElement | null>(null);
const queueSentinelEl = ref<HTMLElement | null>(null);
let queueObserver: IntersectionObserver | null = null;
function ensureQueueObserver() {
  queueObserver?.disconnect();
  queueObserver = null;
  if (!queueSentinelEl.value || !queueScrollEl.value) return;
  queueObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && hasMoreQueue.value) {
          queueVisibleCount.value = Math.min(
            queueVisibleCount.value + QUEUE_PAGE_SIZE,
            fullQueue.value.length,
          );
        }
      }
    },
    { root: queueScrollEl.value, rootMargin: "0px 0px 240px 0px" },
  );
  queueObserver.observe(queueSentinelEl.value);
}
onMounted(ensureQueueObserver);
watch([queueSentinelEl, queueScrollEl, hasMoreQueue], () =>
  ensureQueueObserver(),
);
// Reset the window when the visible set changes shape so the user
// doesn't have to scroll past stale rows after picking a player filter.
watch(playerFilter, () => {
  queueVisibleCount.value = QUEUE_PAGE_SIZE;
  queueScrollEl.value?.scrollTo({ top: 0 });
});
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

// Switch the featured clip and ask the shared player to start playing.
// ClipPlayer's `tryPlay` handles the audio-fallback dance internally.
async function playInlineClip(id: string) {
  activeInlineClipId.value = id;
  inlineAutoAdvanced.value = false;
  await nextTick();
  await inlinePlayerRef.value?.play();
}

function onInlinePlay() {
  inlinePlaying.value = true;
}
function onInlinePause() {
  inlinePlaying.value = false;
}

// ClipPlayer emits raw timing info each frame while playing; we use it
// to auto-advance to the next clip just before the current one ends
// (so there's no awkward black frame between clips). The `ended` event
// is the fallback path in case the timeupdate threshold is missed.
function onInlineProgress({
  currentTime,
  duration,
}: {
  progress: number;
  currentTime: number;
  duration: number;
}) {
  if (!Number.isFinite(duration) || duration <= 0) return;
  const remaining = duration - currentTime;
  if (nextInlineClip.value && remaining <= 0.35 && !inlineAutoAdvanced.value) {
    inlineAutoAdvanced.value = true;
    void playInlineClip(nextInlineClip.value.id);
  }
}

function onInlineEnded() {
  inlinePlaying.value = false;
  if (nextInlineClip.value && !inlineAutoAdvanced.value) {
    inlineAutoAdvanced.value = true;
    void playInlineClip(nextInlineClip.value.id);
  }
}

onBeforeUnmount(() => {
  queueObserver?.disconnect();
  queueObserver = null;
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

// When the detail modal opens, pause inline playback so the same clip
// isn't fighting itself across two surfaces.
watch(activeClipId, (id) => {
  if (id) inlinePlayerRef.value?.pause();
});

// Reset the auto-advance latch whenever the featured clip changes.
// ClipPlayer handles its own progress/intro reset internally via the
// clip-key prop watcher.
watch(
  () => featuredClip.value?.id,
  () => {
    inlineAutoAdvanced.value = false;
  },
);

function clipTeamName(c: Clip): string | null {
  return lineupForSteamId(c.target_steam_id)?.lineup?.name ?? null;
}
</script>

<template>
  <section v-if="featuredClip" class="relative">
    <div class="relative grid lg:grid-cols-2">
      <ClipPlayer
        ref="inlinePlayerRef"
        :src="featuredClip.download_url"
        :poster="featuredClipImage"
        :clip-key="featuredClip.id"
        @play="onInlinePlay"
        @pause="onInlinePause"
        @ended="onInlineEnded"
        @progress="onInlineProgress"
      >
        <template #empty>
          <NuxtImg
            v-if="featuredClipImage"
            :src="featuredClipImage"
            :alt="featuredClip.title ?? t('clips.featured_highlight')"
            class="absolute inset-0 h-full w-full object-contain"
          />
          <div
            v-else
            class="absolute inset-0 flex items-center justify-center text-muted-foreground"
          >
            <Film class="h-10 w-10 opacity-50" />
          </div>
        </template>
        <template #top-right>
          <button
            type="button"
            class="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-2.5 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-white/80 backdrop-blur-md transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
            :title="
              t('clips.open_details', {
                title: featuredClip.title ?? t('clips.default_clip'),
              })
            "
            @click.stop="openClip(featuredClip.id)"
          >
            {{ t("clips.details") }}
            <ArrowUpRight class="h-3 w-3" />
          </button>
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-black/70 backdrop-blur-md transition-all duration-200 hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
            :class="
              copiedClipId === featuredClip.id
                ? 'share-flash border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber))] scale-110'
                : 'border-white/20 text-white/80'
            "
            :title="
              copiedClipId === featuredClip.id
                ? t('clips.link_copied')
                : t('clips.share_clip')
            "
            :aria-label="t('clips.share_clip')"
            @click.stop="shareClip(featuredClip.id)"
          >
            <Check
              v-if="copiedClipId === featuredClip.id"
              class="h-3.5 w-3.5"
            />
            <Share2 v-else class="h-3.5 w-3.5" />
          </button>
        </template>
        <template #bottom>
          <div class="flex min-w-0 items-center gap-2.5">
            <span
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.14)]"
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
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-2">
                <span
                  class="min-w-0 truncate text-sm font-semibold text-white sm:text-base"
                  ><!--
                --><NuxtLink
                    v-if="featuredClip.target_steam_id"
                    :to="`/players/${featuredClip.target_steam_id}`"
                    class="pointer-events-auto text-white transition-colors hover:text-[hsl(var(--tac-amber))]"
                    :title="
                      t('clips.open_player_profile', {
                        name:
                          featuredClip.target?.name ??
                          t('clips.default_player'),
                      })
                    "
                    @click.stop
                    >{{
                      featuredClip.target?.name ?? t("clips.match_highlight")
                    }}</NuxtLink
                  ><template v-else>{{
                    featuredClip.target?.name ?? t("clips.match_highlight")
                  }}</template
                  ><span
                    v-if="featuredPlayer?.teamName"
                    class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white/55"
                  >
                    · {{ featuredPlayer.teamName }}</span
                  ></span
                >
                <span
                  class="inline-flex shrink-0 items-center gap-1 rounded border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.85)] px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-white tabular-nums shadow-[0_0_10px_hsl(var(--destructive)/0.4)]"
                  :title="
                    t(
                      'clips.kills_in_clip',
                      { count: featuredClip.kills_count ?? 1 },
                      featuredClip.kills_count ?? 1,
                    )
                  "
                >
                  <Crosshair class="h-3 w-3" />
                  {{ featuredClip.kills_count ?? 1 }}K
                </span>
              </div>
              <div class="mt-0.5 flex min-w-0 items-center gap-1.5">
                <span
                  v-if="featuredClip.match_map?.map?.name"
                  class="min-w-0 truncate font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/55"
                  ><!--
                -->{{ featuredClip.match_map.map.name }}</span
                >
                <span
                  v-if="featuredClip.round != null"
                  class="shrink-0 font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/55"
                  :title="$t('common.round', { number: featuredClip.round })"
                >
                  · R{{ featuredClip.round }}
                </span>
                <span
                  v-if="formatRelativeTime(featuredClip.created_at)"
                  class="shrink-0 font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/40"
                >
                  · {{ formatRelativeTime(featuredClip.created_at) }}
                </span>
                <span
                  class="shrink-0 font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/40 tabular-nums"
                >
                  · {{ formatDuration(featuredClip.duration_ms) }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </ClipPlayer>

      <aside
        class="reel-queue relative flex min-h-0 max-h-80 flex-col overflow-hidden rounded-md border border-border/60 bg-card/20 lg:aspect-video lg:max-h-none"
      >
        <div
          class="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5"
        >
          <span
            class="inline-flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <ListVideo class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
            {{ $t("match.up_next") }}
          </span>
          <span
            class="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground tabular-nums"
          >
            {{ filteredClips.length }} clips
          </span>
        </div>
        <div ref="queueScrollEl" class="min-h-0 flex-1 overflow-y-auto p-2">
          <div
            v-for="(c, index) in reelQueue"
            :key="c.id"
            class="group/queue-wrap flex items-center gap-1"
          >
            <button
              type="button"
              class="group/queue queue-row relative flex min-w-0 flex-1 items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-left hover:border-[hsl(var(--tac-amber)/0.45)] hover:bg-[hsl(var(--tac-amber)/0.08)]"
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
                class="relative flex w-5 shrink-0 items-center justify-center self-center"
                :title="
                  c.id === featuredClip.id
                    ? inlinePlaying
                      ? t('clips.now_playing')
                      : t('clips.selected')
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
                class="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)]"
              >
                <NuxtImg
                  v-if="
                    resolveAvatarUrl(c.target?.avatar_url ?? null, apiDomain)
                  "
                  :src="
                    resolveAvatarUrl(c.target?.avatar_url ?? null, apiDomain) ??
                    ''
                  "
                  :alt="c.target?.name ?? t('clips.default_player')"
                  loading="lazy"
                  class="h-full w-full object-cover"
                />
                <span
                  v-else
                  class="font-mono text-[0.65rem] font-bold uppercase text-[hsl(var(--tac-amber))]"
                >
                  {{ c.target?.name?.charAt(0) ?? "?" }}
                </span>
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-2">
                  <span
                    class="min-w-0 truncate text-sm font-semibold group-hover/queue:text-[hsl(var(--tac-amber))]"
                    :class="
                      c.id === featuredClip.id
                        ? 'text-[hsl(var(--tac-amber))]'
                        : 'text-foreground'
                    "
                    ><!--
                  -->{{ c.target?.name ?? t("clips.default_player")
                    }}<span
                      v-if="clipTeamName(c)"
                      class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/80"
                    >
                      · {{ clipTeamName(c) }}</span
                    ></span
                  >
                </div>
                <div class="mt-0.5 flex min-w-0 items-center gap-1.5">
                  <span
                    v-if="c.match_map?.map?.name"
                    class="min-w-0 truncate font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/80"
                    ><!--
                  -->{{ c.match_map.map.name }}</span
                  >
                  <span
                    v-if="c.round != null"
                    class="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/80"
                    :title="$t('common.round', { number: c.round })"
                  >
                    · R{{ c.round }}
                  </span>
                  <span
                    v-if="formatRelativeTime(c.created_at)"
                    class="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/60"
                  >
                    · {{ formatRelativeTime(c.created_at) }}
                  </span>
                  <span
                    class="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/60 tabular-nums"
                  >
                    · {{ formatDuration(c.duration_ms) }}
                  </span>
                </div>
              </div>
              <span
                class="inline-flex shrink-0 items-center gap-1 self-stretch rounded-md border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.85)] px-2 font-mono text-[0.65rem] font-bold text-white tabular-nums"
                :title="
                  t(
                    'clips.kills_in_clip',
                    { count: c.kills_count ?? 1 },
                    c.kills_count ?? 1,
                  )
                "
              >
                <Crosshair class="h-3 w-3" />
                {{ c.kills_count ?? 1 }}K
              </span>
            </button>
            <button
              type="button"
              class="inline-flex w-8 shrink-0 items-center justify-center self-stretch rounded-md transition-all duration-200 hover:bg-[hsl(var(--tac-amber)/0.18)] hover:text-[hsl(var(--tac-amber))]"
              :class="
                copiedClipId === c.id
                  ? 'share-flash bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))]'
                  : 'text-muted-foreground'
              "
              :title="
                copiedClipId === c.id
                  ? t('clips.link_copied')
                  : t('clips.share_clip')
              "
              :aria-label="t('clips.share_clip')"
              @click.stop="shareClip(c.id)"
            >
              <Check v-if="copiedClipId === c.id" class="h-3.5 w-3.5" />
              <Share2 v-else class="h-3.5 w-3.5" />
            </button>
          </div>
          <div
            v-if="hasMoreQueue"
            ref="queueSentinelEl"
            class="h-1 w-full"
            aria-hidden="true"
          />
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
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

/* `.share-flash` keyframe lives in assets/css/tailwind.css so the
   feedback is identical across the reel, HighlightCard, and the
   ClipDetailModal. */
</style>
