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
import { ArrowUpRight, Check, Film, Eye, Share2 } from "lucide-vue-next";
import type { Clip } from "~/types/clip";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { useClipModal } from "~/composables/useClipModal";
import { useClipShare } from "~/composables/useClipShare";
import { NuxtLink } from "#components";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";
import ClipKillBadge from "~/components/clips/ClipKillBadge.vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";

const { t } = useI18n();

const props = defineProps<{
  match: any;
}>();

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain as string);
const { playClips, activeClipId } = useClipModal();
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

function openFeaturedInModal() {
  if (!featuredClip.value) return;
  playClips(
    filteredClips.value.length ? filteredClips.value : clips.value,
    featuredClip.value.id,
    `match-highlights:${props.match?.id}`,
  );
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
    // Right margin too: on phones the queue is a horizontal strip.
    { root: queueScrollEl.value, rootMargin: "0px 240px 240px 0px" },
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

const previousInlineClip = computed<Clip | null>(() => {
  if (!featuredClip.value) return null;
  const list = filteredClips.value.length ? filteredClips.value : clips.value;
  const index = list.findIndex((c) => c.id === featuredClip.value?.id);
  if (index <= 0) return null;
  return list[index - 1] ?? null;
});

// Arrow keys on the player (the only handler that survives fullscreen).
function playPreviousInlineClip() {
  if (previousInlineClip.value)
    void playInlineClip(previousInlineClip.value.id);
}
function playNextInlineClip() {
  if (nextInlineClip.value) void playInlineClip(nextInlineClip.value.id);
}

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

function clipThumb(c: Clip): string | null {
  return c.thumbnail_download_url ?? c.match_map?.map?.poster ?? null;
}

function clipTeamName(c: Clip): string | null {
  return lineupForSteamId(c.target_steam_id)?.lineup?.name ?? null;
}
</script>

<template>
  <!-- The media half of the match stage: the stage is rounded-2xl with 8px
       padding here, so the player and queue take rounded-lg (16 − 8). -->
  <section
    v-if="featuredClip"
    class="grid gap-2 px-1.5 pb-1.5 sm:px-2 sm:pb-2 lg:grid-cols-[minmax(0,1fr)_20rem]"
  >
    <div
      class="min-w-0 overflow-hidden rounded-lg bg-white/[0.03] ring-1 ring-inset ring-white/[0.07]"
    >
      <ClipPlayer
        ref="inlinePlayerRef"
        class="!rounded-none !border-0"
        :src="featuredClip.download_url"
        :poster="featuredClipImage"
        :clip-key="featuredClip.id"
        @play="onInlinePlay"
        @pause="onInlinePause"
        @ended="onInlineEnded"
        @progress="onInlineProgress"
        @prev="playPreviousInlineClip"
        @next="playNextInlineClip"
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
      </ClipPlayer>

      <!-- Clip details sit under the video, never on it: every clip burns its
           own player card into the bottom-left of the frame. -->
      <div
        class="flex min-h-[52px] min-w-0 items-center gap-2.5 py-2 pl-3 pr-2"
      >
        <ClipKillBadge
          :kills="featuredClip.kills_count"
          :round="featuredClip.round"
          :title="featuredClip.title"
          class="!bg-white/[0.06] !backdrop-blur-none"
        />
        <component
          :is="featuredClip.target_steam_id ? NuxtLink : 'span'"
          :to="
            featuredClip.target_steam_id
              ? `/players/${featuredClip.target_steam_id}`
              : undefined
          "
          class="flex min-w-0 shrink-0 items-center gap-2 rounded-md text-sm font-bold transition-colors hover:text-[hsl(var(--tac-amber))]"
          :title="
            featuredClip.target_steam_id
              ? t('clips.open_player_profile', {
                  name: featuredClip.target?.name ?? t('clips.default_player'),
                })
              : undefined
          "
        >
          <Avatar class="size-5 text-[9px] ring-1 ring-white/20">
            <AvatarImage
              v-if="featuredPlayer?.avatarSrc"
              :src="featuredPlayer.avatarSrc"
              alt=""
            />
            <AvatarFallback>{{
              featuredClip.target?.name?.charAt(0) ?? "?"
            }}</AvatarFallback>
          </Avatar>
          <span class="truncate">{{
            featuredClip.target?.name ?? t("clips.match_highlight")
          }}</span>
        </component>
        <span
          class="hidden min-w-0 truncate text-sm text-muted-foreground sm:block"
        >
          <template v-if="featuredPlayer?.teamName"
            >{{ featuredPlayer.teamName }} ·
          </template>
          <template v-if="featuredClip.round != null"
            >{{ $t("common.round", { number: featuredClip.round }) }} ·
          </template>
          <span class="tabular-nums">{{
            formatDuration(featuredClip.duration_ms)
          }}</span>
        </span>

        <div class="ml-auto flex shrink-0 items-center gap-1">
          <span
            class="hidden items-center gap-1.5 px-2 text-[13px] tabular-nums text-muted-foreground sm:inline-flex"
            :title="
              t(
                'clips.plays_count',
                { count: featuredClip.views_count ?? 0 },
                featuredClip.views_count ?? 0,
              )
            "
          >
            <Eye class="h-3.5 w-3.5" />
            {{ featuredClip.views_count ?? 0 }}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            :class="
              copiedClipId === featuredClip.id &&
              'share-flash text-[hsl(var(--tac-amber))]'
            "
            :title="
              copiedClipId === featuredClip.id
                ? t('clips.link_copied')
                : t('clips.share_clip')
            "
            :aria-label="t('clips.share_clip')"
            @click="
              () => {
                // Not returned: the Button would swap the icon for its
                // spinner while the share sheet is open.
                shareClip(featuredClip!.id);
              }
            "
          >
            <Check
              v-if="copiedClipId === featuredClip.id"
              class="h-3.5 w-3.5"
            />
            <Share2 v-else class="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5"
            :title="
              t('clips.open_details', {
                title: featuredClip.title ?? t('clips.default_clip'),
              })
            "
            @click="openFeaturedInModal"
          >
            {{ t("clips.details") }}
            <ArrowUpRight class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <aside
      class="reel-queue relative min-h-0 min-w-0 lg:rounded-lg lg:bg-white/[0.03] lg:ring-1 lg:ring-inset lg:ring-white/[0.07]"
    >
      <div class="flex min-h-0 flex-col lg:absolute lg:inset-0">
        <div
          class="flex items-center justify-between gap-3 px-1 pb-1.5 pt-1 text-[13px] font-bold lg:px-3.5 lg:pb-2 lg:pt-3"
        >
          {{ $t("match.up_next") }}
          <span class="font-medium tabular-nums text-muted-foreground">
            {{
              $t("match.highlights.clip_count", { count: filteredClips.length })
            }}
          </span>
        </div>
        <ol
          ref="queueScrollEl"
          class="grid min-h-0 flex-1 auto-cols-[9.25rem] grid-flow-col gap-2 overflow-x-auto overscroll-x-contain pb-1 lg:auto-cols-auto lg:grid-flow-row lg:content-start lg:gap-0.5 lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-y-contain lg:px-1.5 lg:pb-1.5"
        >
          <li v-for="c in reelQueue" :key="c.id" class="min-w-0">
            <button
              type="button"
              class="group/queue grid w-full grid-cols-1 items-center gap-1.5 rounded-md p-1 text-left transition-colors hover:bg-white/5 lg:grid-cols-[7rem_minmax(0,1fr)] lg:gap-2.5 lg:p-1.5"
              :class="
                c.id === featuredClip.id &&
                'bg-white/[0.07] hover:bg-white/[0.07]'
              "
              :aria-current="c.id === featuredClip.id ? 'true' : undefined"
              @click="playInlineClip(c.id)"
            >
              <span
                class="relative block aspect-video overflow-hidden rounded-[4px] bg-card"
              >
                <NuxtImg
                  v-if="clipThumb(c)"
                  :src="clipThumb(c)!"
                  alt=""
                  loading="lazy"
                  class="h-full w-full object-cover"
                />
                <ClipKillBadge
                  :kills="c.kills_count"
                  :round="c.round"
                  :title="c.title"
                  size="xs"
                  class="absolute left-1 top-1"
                />
                <span
                  class="absolute bottom-1 right-1 rounded-[4px] bg-black/70 px-1 py-px text-[11px] font-semibold tabular-nums text-white"
                >
                  {{ formatDuration(c.duration_ms) }}
                </span>
                <span
                  aria-hidden="true"
                  class="absolute inset-0 rounded-[inherit] ring-inset"
                  :class="
                    c.id === featuredClip.id
                      ? 'ring-2 ring-[hsl(var(--tac-amber))]'
                      : 'ring-1 ring-white/10'
                  "
                ></span>
              </span>
              <span class="grid min-w-0 gap-0.5">
                <span class="truncate text-[13px] font-bold">
                  {{ c.target?.name ?? t("clips.default_player") }}
                </span>
                <span
                  v-if="c.id === featuredClip.id"
                  class="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--tac-amber))]"
                >
                  <span v-if="inlinePlaying" class="relative flex size-1.5">
                    <span
                      class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75 motion-reduce:animate-none"
                    ></span>
                    <span
                      class="relative inline-flex size-1.5 rounded-full bg-current"
                    ></span>
                  </span>
                  {{
                    inlinePlaying ? t("clips.now_playing") : t("clips.selected")
                  }}
                </span>
                <span v-else class="truncate text-xs text-muted-foreground">
                  <template v-if="clipTeamName(c)"
                    >{{ clipTeamName(c) }} ·
                  </template>
                  <template v-if="c.round != null">{{
                    $t("common.round", { number: c.round })
                  }}</template>
                </span>
              </span>
            </button>
          </li>
          <li
            v-if="hasMoreQueue"
            ref="queueSentinelEl"
            class="h-1 w-1"
            aria-hidden="true"
          />
        </ol>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.reel-queue ::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.reel-queue ::-webkit-scrollbar-track {
  background: transparent;
}

.reel-queue ::-webkit-scrollbar-thumb {
  background: rgb(255 255 255 / 0.15);
  border-radius: 999px;
}

/* `.share-flash` keyframe lives in assets/css/tailwind.css so the
   feedback is identical across the reel, ClipTile, and the
   ClipDetailModal. */
</style>
