<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Globe,
  Lock,
  Pencil,
  Trash2,
  X,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { matchClipFieldsWithLineups } from "~/graphql/matchClip";
import type { Clip } from "~/types/clip";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Kbd } from "~/components/ui/kbd";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";
import ClipKillBadge from "~/components/clips/ClipKillBadge.vue";
import ClipShareMenu from "~/components/clips/ClipShareMenu.vue";
import ClipKillfeed from "~/components/clips/ClipKillfeed.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import {
  DialogRoot as Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from "reka-ui";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { Switch } from "~/components/ui/switch";
import {
  clipDownloadName,
  clipDownloadUrl,
} from "~/utilities/clipDownloadName";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import cleanMapName from "~/utilities/cleanMapName";
import { clipDisplayTitle, formatClipDuration } from "~/utilities/clipDisplay";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { teamMonogram } from "~/components/watch/watchTicker";
import { useClipModal } from "~/composables/useClipModal";
import { useClipShare } from "~/composables/useClipShare";
import { useClipFileSize } from "~/composables/useClipFileSize";
import { useClipDelete } from "~/composables/useClipDelete";
import { Spinner } from "~/components/ui/spinner";

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain as string);

const props = defineProps<{
  clipId: string | null;
}>();

const auth = useAuthStore();
const nuxtApp = useNuxtApp();
const {
  activeClipIndex,
  clipQueue,
  closeClip,
  nextClip,
  openClip,
  openNextClip,
  openPreviousClip,
  previousClip,
} = useClipModal();

const clip = ref<Clip | null>(null);
const loading = ref(false);
const notFound = ref(false);
const { copiedClipId, shareClip } = useClipShare();
const linkCopied = computed(() =>
  clip.value ? copiedClipId.value === clip.value.id : false,
);
const modalPlayerRef = ref<InstanceType<typeof ClipPlayer> | null>(null);
const modalAutoAdvanced = ref(false);

const isOwner = computed(
  () => !!clip.value && clip.value.user_steam_id === auth.me?.steam_id,
);
// Visibility and delete are an admin's call (the api also lets a clip's own
// creator and staff from streamer up do both).
const canAdminister = computed(() => auth.isAdmin);

// The player is already named beside the title, so drop the "<player> — "
// prefix the API's auto-title leads with.
const displayTitle = computed(
  () =>
    clipDisplayTitle(clip.value?.title, clip.value?.target?.name) ??
    t("clips.untitled_clip"),
);
const duration = computed(() => formatClipDuration(clip.value?.duration_ms));

// Theater mode (the expanded view) is a per-browser preference: whoever
// turns it on keeps watching that way across clips and reloads. Phones never
// get it -- the default layout already fills the screen there.
const EXPANDED_STORAGE_KEY = "5stack:clip-modal-expanded";
const expandedPref = ref(false);
const canExpand = ref(false);
let expandQuery: MediaQueryList | null = null;
function syncCanExpand() {
  canExpand.value = !!expandQuery?.matches;
}
const expanded = computed(() => expandedPref.value && canExpand.value);
function setExpanded(value: boolean) {
  expandedPref.value = value;
  try {
    window.localStorage.setItem(EXPANDED_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // storage unavailable -- the choice just won't persist
  }
}
// Switching modes grows the video from its spot into the theater stage (and
// back) while the panel and backdrop crossfade underneath. The swap itself
// is still one class change on one player; a view transition snapshots both
// layouts and animates between them on the compositor, so the heavy mount
// on either side can't stall it. No API, a hidden tab or reduced motion:
// instant swap.
const morphing = ref(false);
async function toggleTheater(value = !expanded.value) {
  // A second press mid-morph would cut the running transition short.
  if (value === expanded.value || morphing.value) return;
  if (
    typeof document.startViewTransition !== "function" ||
    document.visibilityState !== "visible" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    setExpanded(value);
    return;
  }
  // The video only carries a transition name while it morphs, so it never
  // joins any other view transition on the page.
  morphing.value = true;
  document.documentElement.dataset.clipMorph = "";
  await nextTick();
  const transition = document.startViewTransition(async () => {
    setExpanded(value);
    await nextTick();
  });
  // An aborted transition rejects `ready` too; the swap has still happened.
  transition.ready.catch(() => {});
  try {
    await transition.finished;
  } catch {
    // skipped or interrupted -- the new layout is already in place
  } finally {
    morphing.value = false;
    delete document.documentElement.dataset.clipMorph;
  }
}

// Esc steps out of theater mode first; a second Esc closes.
function onEscapeKeyDown(event: KeyboardEvent) {
  if (!expanded.value) return;
  event.preventDefault();
  void toggleTheater(false);
}

const editing = ref(false);
const draftTitle = ref("");
const saving = ref(false);
const editError = ref<string | null>(null);

type Visibility = "private" | "public";
const VISIBILITY_OPTIONS = computed<
  Array<{
    value: Visibility;
    label: string;
    icon: any;
    hint: string;
  }>
>(() => [
  {
    value: "public",
    label: t("clips.visibility.public"),
    icon: Globe,
    hint: t("clips.visibility.public_hint"),
  },
  {
    value: "private",
    label: t("clips.visibility.private"),
    icon: Lock,
    hint: t("clips.visibility.private_hint"),
  },
]);
const visibilityMeta = computed(
  () =>
    VISIBILITY_OPTIONS.value.find((o) => o.value === clip.value?.visibility) ??
    VISIBILITY_OPTIONS.value[1],
);
const visSaving = ref(false);
async function setVisibility(v: Visibility) {
  if (!clip.value || visSaving.value || clip.value.visibility === v) {
    return;
  }
  visSaving.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        updateClip: [
          { clip_id: clip.value.id, visibility: v },
          { success: true },
        ],
      } as any),
    });
    // The match_clips subscription does not always echo this change back
    // promptly, so reflect it locally to keep the control in sync.
    if (clip.value) {
      clip.value = { ...clip.value, visibility: v };
    }
  } catch (e) {
    console.error("[clip-modal] visibility toggle failed:", e);
  } finally {
    visSaving.value = false;
  }
}

const fileSize = useClipFileSize(() => clip.value?.download_url ?? null);

// Full data for the upcoming clip, fetched while the current one is near
// its end (see prefetchNextClip). Lets a switch render instantly instead
// of waiting on the subscription round-trip; its video is warmed in a
// hidden <video> preloader (see preloadSrc).
const prefetchedClip = ref<Clip | null>(null);
const prefetchingId = ref<string | null>(null);

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe(id: string) {
  activeSub?.unsubscribe();
  notFound.value = false;
  // If we prefetched this clip near the previous one's end, show it
  // immediately — no spinner, and its video is already warm in the cache.
  if (prefetchedClip.value?.id === id) {
    clip.value = prefetchedClip.value;
  }
  // Keep the previous clip visible while switching so the layout
  // doesn't collapse into the skeleton state every time the queue
  // advances; only the initial open shows the full loader.
  if (!clip.value) loading.value = true;
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        { where: { id: { _eq: id } }, limit: 1 } as any,
        matchClipFieldsWithLineups,
      ],
    } as any),
  });
  activeSub = obs.subscribe({
    next: ({ data }: any) => {
      const row = data?.match_clips?.[0] ?? null;
      clip.value = row;
      loading.value = false;
      if (!row) notFound.value = true;
    },
    error: (err: any) => {
      console.error("[clip-modal] subscription error:", err);
      loading.value = false;
    },
  });
}

watch(
  () => props.clipId,
  (id) => {
    if (id) {
      subscribe(id);
    } else {
      activeSub?.unsubscribe();
      activeSub = null;
      clip.value = null;
      editing.value = false;
      prefetchedClip.value = null;
      prefetchingId.value = null;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disarmDelete();
  if (revealTimer) clearTimeout(revealTimer);
  activeSub?.unsubscribe();
  activeSub = null;
  window.removeEventListener("keydown", onModalKeydown);
  expandQuery?.removeEventListener("change", syncCanExpand);
});

const open = computed(() => !!props.clipId);
// True from the instant you hit next/prev until the new clip's data lands.
// The subscription round-trip has no visual of its own and we keep the
// previous clip on screen, so without this the press feels like nothing
// happened. Drives a spinner over the still-visible clip as instant ack.
const switching = computed(
  () =>
    open.value &&
    !!clip.value &&
    !!props.clipId &&
    props.clipId !== clip.value.id,
);
const hasQueueNav = computed(
  () => clipQueue.value.length > 1 && activeClipIndex.value >= 0,
);

function onUpdateOpen(v: boolean) {
  if (!v) closeClip();
}

function startEdit() {
  if (!clip.value) return;
  draftTitle.value = clip.value.title ?? "";
  editError.value = null;
  editing.value = true;
}
function cancelEdit() {
  editing.value = false;
  editError.value = null;
}
async function saveEdit() {
  if (!clip.value || saving.value) return;
  saving.value = true;
  editError.value = null;
  try {
    // Title-only — visibility has its own control; sending it here would
    // stomp concurrent edits.
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        updateClip: [
          {
            clip_id: clip.value.id,
            title: draftTitle.value.trim(),
          },
          { success: true },
        ],
      } as any),
    });
    editing.value = false;
  } catch (e) {
    editError.value =
      (e as any)?.graphQLErrors?.[0]?.message ??
      (e as Error)?.message ??
      "Failed to update clip";
  } finally {
    saving.value = false;
  }
}

function copyLink() {
  if (!clip.value) return;
  void shareClip(clip.value.id);
}

function onVisibilitySelect(event: Event) {
  event.preventDefault();
  void setVisibility(clip.value?.visibility === "public" ? "private" : "public");
}

// Delete takes two presses: the first arms it for three seconds.
const { deleting, deleteClip } = useClipDelete();
const deleteArmed = ref(false);
let disarmTimer: ReturnType<typeof setTimeout> | null = null;

function disarmDelete() {
  if (disarmTimer) {
    clearTimeout(disarmTimer);
    disarmTimer = null;
  }
  deleteArmed.value = false;
}

async function onDeleteSelect(event: Event) {
  event.preventDefault();
  const target = clip.value;
  if (!target || deleting.value) {
    return;
  }
  if (!deleteArmed.value) {
    deleteArmed.value = true;
    disarmTimer = setTimeout(disarmDelete, 3000);
    return;
  }
  disarmDelete();
  if (await deleteClip(target.id, target.title)) {
    shareMenuOpen.value = false;
    closeClip();
  }
}

const shareMenuOpen = ref(false);
watch(shareMenuOpen, (isOpen) => {
  if (!isOpen) {
    disarmDelete();
  }
});
watch(
  () => clip.value?.id,
  () => disarmDelete(),
);

const downloadFilename = computed<string>(() =>
  clip.value ? clipDownloadName(clip.value) : "clip.mp4",
);

const targetAvatarSrc = computed(() =>
  resolveAvatarUrl(clip.value?.target?.avatar_url ?? null, apiDomain.value),
);
const poster = computed(
  () =>
    clip.value?.thumbnail_download_url ??
    clip.value?.match_map?.map?.poster ??
    null,
);
const views = computed(() => clip.value?.views_count ?? 0);
// The queue already carries the clip's thumbnail, title, kills and length,
// so the dialog opens fully laid out while the rest of its data loads.
const activeQueueItem = computed(
  () => clipQueue.value.find((item) => item.id === props.clipId) ?? null,
);

const match = computed(() => clip.value?.match_map?.match ?? null);
const mapLabel = computed(() => {
  const map = clip.value?.match_map?.map;
  if (!map) return null;
  return map.label || cleanMapName(map.name);
});
const eventName = computed(
  () =>
    match.value?.event_links?.[0]?.event?.name ??
    match.value?.tournament_brackets?.[0]?.stage?.tournament?.name ??
    null,
);
const roundLabel = computed(() =>
  clip.value?.round != null
    ? t("clips.tile.round", { round: clip.value.round })
    : null,
);

// Scorecard for the map the play happened on, laid out like the watch
// ticker's cells. The clipped player's side is marked with their avatar.
const matchCard = computed(() => {
  const m = match.value;
  const mm = clip.value?.match_map;
  if (!m || !mm || !m.lineup_1 || !m.lineup_2) return null;
  const sid = String(clip.value?.target_steam_id ?? "");
  const decided = !!mm.winning_lineup_id;
  const teams = (
    [
      [m.lineup_1, mm.lineup_1_score, m.lineup_1_id],
      [m.lineup_2, mm.lineup_2_score, m.lineup_2_id],
    ] as const
  ).map(([lineup, score, id]) => ({
    id: lineup.id,
    name: lineup.name,
    avatar: resolveAvatarUrl(lineup.team?.avatar_url ?? null, apiDomain.value),
    monogram: teamMonogram(lineup.name),
    score,
    won: decided && mm.winning_lineup_id === id,
    lost: decided && mm.winning_lineup_id !== id,
    hasTarget:
      !!sid &&
      !!lineup.lineup_players?.some(
        (p) => String(p.steam_id ?? p.player?.steam_id) === sid,
      ),
  }));
  const bestOf = m.options?.best_of ?? 1;
  return {
    teams,
    header: [
      mapLabel.value,
      bestOf > 1 ? t("clips.detail.best_of", { count: bestOf }) : null,
      eventName.value,
    ]
      .filter(Boolean)
      .join(" · "),
  };
});

// Begin warming the next clip this far from the end. The data query is
// quick; the head start mostly lets the hidden <video> buffer the file so
// playback is instant on switch.
const PRELOAD_REMAINING_S = 6;

// Hidden preloader src — the prefetched next clip's video, but only while
// it's genuinely the *next* clip (not the one already on screen).
const preloadSrc = computed(() => {
  const p = prefetchedClip.value;
  if (!p?.download_url) return null;
  if (clip.value && p.id === clip.value.id) return null;
  return p.download_url;
});

// Pull the full next clip (incl. download_url + lineups) ahead of time so
// switching to it is instant. Idempotent per id; safe to call every tick.
async function prefetchNextClip() {
  const next = nextClip.value;
  if (!next) return;
  if (prefetchedClip.value?.id === next.id || prefetchingId.value === next.id) {
    return;
  }
  prefetchingId.value = next.id;
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        match_clips: [
          { where: { id: { _eq: next.id } }, limit: 1 } as any,
          matchClipFieldsWithLineups,
        ],
      } as any),
      fetchPolicy: "network-only",
    });
    const row = (data as any)?.match_clips?.[0] ?? null;
    // Guard against the queue having moved on while the query was in flight.
    if (row && nextClip.value?.id === row.id) prefetchedClip.value = row;
  } catch {
    // best-effort — a missed prefetch just falls back to the live fetch
  } finally {
    if (prefetchingId.value === next.id) prefetchingId.value = null;
  }
}

// Seconds left in the clip on screen; drives the expanded view's "Up next"
// card. Cancel holds auto-advance for this clip only.
const remaining = ref<number | null>(null);
const advanceCancelled = ref(false);
const upNextCountdown = computed(() =>
  nextClip.value &&
  !advanceCancelled.value &&
  remaining.value != null &&
  remaining.value <= PRELOAD_REMAINING_S
    ? Math.max(1, Math.ceil(remaining.value))
    : null,
);

function onModalProgress({
  currentTime,
  duration,
}: {
  progress: number;
  currentTime: number;
  duration: number;
}) {
  if (!Number.isFinite(duration) || duration <= 0) return;
  remaining.value = duration - currentTime;
  if (nextClip.value && remaining.value <= PRELOAD_REMAINING_S) {
    void prefetchNextClip();
  }
  if (
    nextClip.value &&
    !advanceCancelled.value &&
    remaining.value <= 0.35 &&
    !modalAutoAdvanced.value
  ) {
    modalAutoAdvanced.value = true;
    openNextClip();
  }
}

function onModalEnded() {
  if (nextClip.value && !advanceCancelled.value && !modalAutoAdvanced.value) {
    modalAutoAdvanced.value = true;
    openNextClip();
  }
}

watch(
  () => clip.value?.id,
  (id) => {
    modalAutoAdvanced.value = false;
    advanceCancelled.value = false;
    remaining.value = null;
    if (id) {
      void nextTick().then(() => modalPlayerRef.value?.play());
    }
    // Still covered by the snapshot: a clip with no video yet shows its
    // "finalizing" state at once; otherwise never hold the cover forever.
    if (id && !revealed.value) {
      if (!clip.value?.download_url) revealPlayer();
      else revealTimer ??= setTimeout(revealPlayer, REVEAL_FALLBACK_MS);
    }
  },
);

// Opening shows the clip's thumbnail over the player and fades it only once
// the video has a frame on screen (requestVideoFrameCallback, when the
// browser has it). Switching clips doesn't use it: the player crossfades
// clip to clip on its own.
const REVEAL_FALLBACK_MS = 3000;
const revealed = ref(false);
let revealTimer: ReturnType<typeof setTimeout> | null = null;
const snapshotSrc = computed(
  () =>
    activeQueueItem.value?.thumbnailUrl ??
    activeQueueItem.value?.posterUrl ??
    poster.value,
);
function revealPlayer() {
  revealed.value = true;
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
}
function playerVideo(e: Event): HTMLVideoElement | null {
  const target = e.target;
  return target instanceof HTMLVideoElement && !("preload" in target.dataset)
    ? target
    : null;
}
function onPlayerPlaying(e: Event) {
  const video = playerVideo(e);
  if (!video || revealed.value) return;
  if ("requestVideoFrameCallback" in video) {
    video.requestVideoFrameCallback(() => revealPlayer());
  } else {
    revealPlayer();
  }
}
// Autoplay refused: nothing is going to play, so show the paused frame.
function onPlayerLoadedData(e: Event) {
  const video = playerVideo(e);
  if (!video || revealed.value) return;
  setTimeout(() => {
    if (video.paused && !revealed.value) revealPlayer();
  }, 300);
}
// Re-cover on every fresh open (and reset on close).
watch(
  () => props.clipId,
  (id, previous) => {
    if (id && previous) return;
    revealed.value = false;
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
  },
);

// Keep the playing tile centred in the "Up next" strip.
const stripRef = ref<HTMLElement | null>(null);
watch(
  [activeClipIndex, () => !!clip.value, expanded],
  async () => {
    await nextTick();
    const strip = stripRef.value;
    const tile = strip?.children[activeClipIndex.value] as
      | HTMLElement
      | undefined;
    if (!strip || !tile) return;
    strip.scrollTo({
      left: tile.offsetLeft - strip.clientWidth / 2 + tile.clientWidth / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  },
  { immediate: true },
);

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function onModalKeydown(e: KeyboardEvent) {
  if (!open.value || isTypingTarget(e.target)) return;
  if (
    (e.key === "t" || e.key === "T") &&
    canExpand.value &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    e.preventDefault();
    void toggleTheater();
    return;
  }
  if (e.key === "ArrowLeft" && previousClip.value) {
    e.preventDefault();
    openPreviousClip();
  }
  if (e.key === "ArrowRight" && nextClip.value) {
    e.preventDefault();
    openNextClip();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onModalKeydown);
  expandQuery = window.matchMedia("(min-width: 640px)");
  expandQuery.addEventListener("change", syncCanExpand);
  syncCanExpand();
  try {
    expandedPref.value =
      window.localStorage.getItem(EXPANDED_STORAGE_KEY) === "1";
  } catch {
    // storage unavailable -- start in the default layout
  }
});

const onVideoChip =
  "inline-flex h-[30px] shrink-0 items-center gap-1 rounded-md bg-black/60 px-[9px] text-xs font-semibold tabular-nums text-white/90 backdrop-blur-sm sm:h-9 sm:px-[11px] sm:text-[13px]";
const onVideoAction =
  "clip-hit relative inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-black/55 text-white/85 backdrop-blur-sm transition-colors duration-150 hover:bg-black/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] data-[state=open]:bg-black/80 sm:h-9 sm:w-9";
const tileChip =
  "inline-flex h-[26px] shrink-0 items-center rounded-md px-2 text-xs font-semibold tabular-nums";
const edgeButton =
  "inline-flex h-11 w-11 items-center justify-center rounded-md bg-white/[0.06] text-white/75 transition-colors duration-150 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]";
</script>

<template>
  <Dialog :open="open" @update:open="onUpdateOpen">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        :class="expanded ? 'bg-black' : 'bg-black/85 backdrop-blur-sm'"
      />
      <DialogContent
        class="fixed inset-0 z-[60] flex flex-col outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        :class="
          expanded
            ? ''
            : 'clip-modal--default overflow-y-auto overscroll-contain bg-background sm:inset-auto sm:max-h-[94svh] sm:rounded-xl'
        "
        @escape-key-down="onEscapeKeyDown"
      >
        <VisuallyHidden as-child>
          <DialogTitle>{{ clip?.title || $t("common.clip") }}</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden as-child>
          <DialogDescription>{{
            $t("clips.detail.highlight_clip_viewer")
          }}</DialogDescription>
        </VisuallyHidden>

        <!-- Expanded: the clip's own frame, blurred, so the screen around
             the video carries its colour instead of flat black. -->
        <div
          v-if="expanded"
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <Transition
            enter-active-class="transition-opacity duration-500"
            enter-from-class="opacity-0"
            leave-active-class="absolute inset-0 transition-opacity duration-500"
            leave-to-class="opacity-0"
          >
            <img
              v-if="poster"
              :key="poster"
              :src="poster"
              alt=""
              class="h-full w-full scale-110 object-cover opacity-20 blur-3xl"
            />
          </Transition>
        </div>

        <header
          v-if="expanded"
          class="flex h-14 shrink-0 items-center gap-2 px-6"
        >
          <p
            v-if="hasQueueNav"
            class="text-[13px] tabular-nums text-white/55"
          >
            <span class="font-semibold text-white">{{
              activeClipIndex + 1
            }}</span>
            / {{ clipQueue.length }}
          </p>
          <button
            type="button"
            :class="[edgeButton, 'ml-auto h-9 w-9']"
            :aria-label="$t('common.close')"
            @click="closeClip"
          >
            <X class="h-4 w-4" />
          </button>
        </header>

        <div
          v-if="notFound"
          class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center"
        >
          <h2 class="text-lg font-semibold">
            {{ $t("clips.detail.clip_not_found") }}
          </h2>
          <p class="max-w-sm text-sm text-muted-foreground">
            {{ $t("clips.detail.clip_not_found_description") }}
          </p>
          <Button variant="secondary" size="sm" @click="closeClip">{{
            $t("common.close")
          }}</Button>
        </div>

        <template v-else>
          <!-- One player for both layouts: expanding only changes the
               wrappers' classes, so playback carries on without a reload. -->
          <div
            :class="
              expanded
                ? 'relative flex min-h-0 flex-1 items-center justify-center px-6'
                : 'shrink-0'
            "
          >
            <div
              class="group/video relative"
              :style="morphing ? { viewTransitionName: 'clip-modal-video' } : undefined"
              :class="expanded ? 'clip-modal-stage' : ''"
              @playing.capture="onPlayerPlaying"
              @loadeddata.capture="onPlayerLoadedData"
            >
              <ClipPlayer
                v-if="clip"
                ref="modalPlayerRef"
                class="!border-0"
                :class="
                  expanded ? 'clip-modal-player--expanded !rounded-xl' : '!rounded-none'
                "
                :src="clip.download_url"
                :poster="poster"
                :clip-key="clip.id"
                @ended="onModalEnded"
                @progress="onModalProgress"
                @prev="openPreviousClip"
                @next="openNextClip"
              >
                <template #empty>
                  <div
                    class="absolute inset-0 flex items-center justify-center gap-3 text-sm text-muted-foreground"
                  >
                    <Spinner class="h-5 w-5" />
                    {{ $t("clips.detail.render_finalizing") }}
                  </div>
                </template>

                <template #top-left>
                  <div
                    class="flex items-center gap-1.5"
                    :class="expanded ? 'p-1 sm:p-2' : ''"
                  >
                    <ClipKillBadge
                      :kills="clip.kills_count"
                      :round="clip.round"
                      :title="clip.title"
                      :size="expanded ? 'lg' : undefined"
                      :class="expanded ? '' : '!bg-black/60 backdrop-blur-sm'"
                    />
                    <span
                      v-if="duration"
                      :class="
                        expanded
                          ? onVideoChip
                          : [tileChip, 'bg-black/60 text-white/90 backdrop-blur-sm']
                      "
                    >
                      {{ duration }}
                    </span>
                    <span
                      :class="
                        expanded
                          ? onVideoChip
                          : [
                              tileChip,
                              'gap-1 bg-black/60 text-white/90 backdrop-blur-sm',
                            ]
                      "
                      :title="$t('clips.tile.views', { count: views }, views)"
                    >
                      <Eye class="h-3.5 w-3.5" />
                      {{ views }}
                    </span>
                    <span
                      v-if="!expanded && hasQueueNav"
                      :class="[
                        tileChip,
                        'bg-black/60 text-white/90 backdrop-blur-sm',
                      ]"
                    >
                      {{ activeClipIndex + 1 }} / {{ clipQueue.length }}
                    </span>
                  </div>
                </template>

                <template #top-right>
                  <div
                    class="flex items-center gap-2"
                    :class="expanded ? 'p-1 sm:p-2' : ''"
                  >
                    <ClipShareMenu
                      v-model:open="shareMenuOpen"
                      :copied="linkCopied"
                      :download-href="
                        clip.download_url
                          ? clipDownloadUrl(clip.download_url)
                          : null
                      "
                      :download-name="downloadFilename"
                      :size-label="fileSize"
                      content-class="z-[70]"
                      @copy="copyLink"
                    >
                      <template v-if="canAdminister">
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel
                          class="px-2 pb-0.5 pt-1 font-mono text-[0.58rem] font-normal uppercase tracking-[0.16em] text-muted-foreground"
                        >
                          {{ $t("clips.share_menu.admins_only") }}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          :disabled="visSaving"
                          @select="onVisibilitySelect"
                        >
                          <component
                            :is="visibilityMeta.icon"
                            :class="
                              clip.visibility === 'public'
                                ? 'text-success'
                                : 'text-muted-foreground'
                            "
                          />
                          <span class="flex min-w-0 flex-col leading-tight">
                            <span>{{ $t("clips.visibility.public") }}</span>
                            <span
                              class="truncate text-[0.7rem] text-muted-foreground"
                            >
                              {{ visibilityMeta.hint }}
                            </span>
                          </span>
                          <Switch
                            as="span"
                            aria-hidden="true"
                            tabindex="-1"
                            :model-value="clip.visibility === 'public'"
                            class="pointer-events-none ml-auto data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=unchecked]:bg-muted/70"
                          />
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          class="text-destructive transition-colors focus:text-destructive"
                          :class="
                            deleteArmed
                              ? 'bg-destructive/15 focus:bg-destructive/20'
                              : ''
                          "
                          :disabled="deleting"
                          @select="onDeleteSelect"
                        >
                          <Trash2 />
                          {{
                            deleting
                              ? $t("clips.delete_dialog.deleting")
                              : deleteArmed
                                ? $t("clips.share_menu.delete_confirm")
                                : $t("clips.share_menu.delete")
                          }}
                        </DropdownMenuItem>
                      </template>
                    </ClipShareMenu>
                    <button
                      v-if="!expanded"
                      type="button"
                      :class="[onVideoAction, '!h-8 !w-8']"
                      :aria-label="$t('common.close')"
                      @click.stop="closeClip"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </template>

                <template v-if="canExpand" #controls="{ buttonClass }">
                  <button
                    type="button"
                    :class="buttonClass"
                    :aria-label="$t('clips.detail.theater_mode')"
                    :aria-pressed="expanded"
                    :title="`${expanded ? $t('clips.detail.default_view') : $t('clips.detail.theater_mode')} (t)`"
                    @click.stop="toggleTheater()"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <rect v-if="expanded" x="5" y="7" width="14" height="10" rx="2" />
                      <rect v-else x="2" y="6" width="20" height="12" rx="2" />
                    </svg>
                  </button>
                </template>

                <template v-if="expanded" #bottom>
                  <div
                    class="-m-4 -mb-6 grid gap-1.5 bg-[linear-gradient(180deg,rgb(0_0_0/0)_0%,rgb(0_0_0/0.55)_45%,rgb(0_0_0/0.88)_100%)] p-4 pb-6 pr-28 pt-20 sm:-m-5 sm:-mb-7 sm:p-5 sm:pb-7 sm:pr-28 sm:pt-24"
                  >
                    <p
                      class="line-clamp-2 text-[clamp(1.375rem,2.3vw,2rem)] font-bold leading-[1.1] text-white [text-wrap:balance]"
                    >
                      {{ displayTitle }}
                    </p>
                    <NuxtLink
                      v-if="clip.target_steam_id"
                      :to="`/players/${clip.target_steam_id}`"
                      class="group/who pointer-events-auto flex w-fit max-w-full min-w-0 items-center gap-2 rounded-md text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
                      @click="closeClip"
                    >
                      <Avatar
                        class="h-[26px] w-[26px] shrink-0 text-[10px] ring-1 ring-white/20"
                      >
                        <AvatarImage
                          v-if="targetAvatarSrc"
                          :src="targetAvatarSrc"
                          alt=""
                        />
                        <AvatarFallback>{{
                          clip.target?.name?.slice(0, 1) ?? "?"
                        }}</AvatarFallback>
                      </Avatar>
                      <span
                        class="min-w-0 truncate font-bold text-white transition-colors group-hover/who:text-[hsl(var(--tac-amber))]"
                      >
                        {{ clip.target?.name ?? $t("clips.player") }}
                      </span>
                    </NuxtLink>
                    <p
                      v-if="roundLabel || mapLabel"
                      class="truncate text-[13px] text-white/70"
                    >
                      {{ [roundLabel, mapLabel].filter(Boolean).join(" · ") }}
                    </p>
                    <NuxtLink
                      v-if="matchCard"
                      :to="`/matches/${match!.id}`"
                      class="pointer-events-auto w-fit max-w-full truncate rounded-md text-[13px] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
                      :title="$t('clips.detail.view_match')"
                      @click="closeClip"
                    >
                      <span
                        :class="
                          matchCard.teams[0].won ? 'font-bold text-white' : ''
                        "
                        >{{ matchCard.teams[0].name }}</span
                      >
                      <span class="mx-1 font-bold tabular-nums text-white"
                        >{{ matchCard.teams[0].score ?? "–" }}–{{
                          matchCard.teams[1].score ?? "–"
                        }}</span
                      >
                      <span
                        :class="
                          matchCard.teams[1].won ? 'font-bold text-white' : ''
                        "
                        >{{ matchCard.teams[1].name }}</span
                      >
                    </NuxtLink>
                    <p
                      v-if="clip.user?.name"
                      class="truncate text-xs text-white/55"
                    >
                      {{ $t("clips.tile.clipped_by", { name: clip.user.name }) }}
                      ·
                      <TimeAgo :date="clip.created_at" hide-icon />
                    </p>
                  </div>
                </template>
              </ClipPlayer>
              <!-- Holds the player's exact box until the clip's data lands. -->
              <div
                v-else
                class="aspect-video w-full bg-black"
                :class="expanded ? 'clip-modal-player--expanded rounded-xl' : ''"
              />

              <!-- The thumbnail the tile showed stays over the player until
                   the video has painted its first frame, then fades into it:
                   no cut to black, no half-decoded poster, no chrome popping
                   in underneath. -->
              <Transition
                leave-active-class="transition-opacity [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                leave-to-class="opacity-0"
              >
                <div
                  v-if="!revealed"
                  class="pointer-events-none absolute inset-0 z-[5] overflow-hidden bg-black"
                  :class="expanded ? 'rounded-xl' : ''"
                >
                  <NuxtImg
                    v-if="snapshotSrc"
                    :src="snapshotSrc"
                    alt=""
                    class="h-full w-full object-cover"
                  />
                  <div
                    class="clip-modal-loading absolute inset-0 grid place-items-center"
                  >
                    <Spinner class="h-8 w-8 text-white/80" />
                  </div>
                </div>
              </Transition>

              <template v-if="!expanded">
                <button
                  v-if="previousClip"
                  type="button"
                  :class="[onVideoAction, 'clip-nav clip-nav--prev !h-10 !w-10']"
                  :aria-label="$t('ui_extras.previous_clip')"
                  :title="previousClip.title ?? $t('ui_extras.previous_clip')"
                  @click="openPreviousClip"
                >
                  <ChevronLeft class="h-5 w-5" />
                </button>
                <button
                  v-if="nextClip"
                  type="button"
                  :class="[onVideoAction, 'clip-nav clip-nav--next !h-10 !w-10']"
                  :aria-label="$t('ui_extras.next_clip')"
                  :title="nextClip.title ?? $t('ui_extras.next_clip')"
                  @click="openNextClip"
                >
                  <ChevronRight class="h-5 w-5" />
                </button>
              </template>

              <Transition
                enter-active-class="transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
                enter-from-class="opacity-0 translate-y-2"
                leave-active-class="transition-opacity duration-150 ease-in"
                leave-to-class="opacity-0"
              >
                <div
                  v-if="expanded && upNextCountdown && nextClip"
                  class="absolute right-4 top-[4.25rem] z-[5] flex w-[17rem] items-center gap-3 rounded-lg bg-black/75 p-2 pr-3 shadow-[0_0_0_1px_rgb(255_255_255/0.08)] backdrop-blur-md"
                >
                  <button
                    type="button"
                    class="relative grid aspect-video w-[6.5rem] shrink-0 place-items-center overflow-hidden rounded-[4px] bg-black outline outline-1 -outline-offset-1 outline-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
                    :aria-label="$t('ui_extras.next_clip')"
                    @click="openNextClip"
                  >
                    <NuxtImg
                      v-if="nextClip.thumbnailUrl ?? nextClip.posterUrl"
                      :src="nextClip.thumbnailUrl ?? nextClip.posterUrl ?? ''"
                      alt=""
                      class="h-full w-full object-cover"
                    />
                    <Film v-else class="h-4 w-4 text-white/40" />
                  </button>
                  <div class="min-w-0 flex-1">
                    <p
                      class="text-[11px] font-semibold tabular-nums text-[hsl(var(--tac-amber))]"
                    >
                      {{
                        $t("clips.detail.up_next_in", {
                          seconds: upNextCountdown,
                        })
                      }}
                    </p>
                    <p
                      class="line-clamp-2 text-[13px] font-bold leading-snug text-white"
                    >
                      {{
                        clipDisplayTitle(nextClip.title, nextClip.playerName) ??
                        $t("clips.untitled_clip")
                      }}
                    </p>
                    <button
                      type="button"
                      class="mt-0.5 rounded-sm text-xs text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
                      @click="advanceCancelled = true"
                    >
                      {{ $t("common.cancel") }}
                    </button>
                  </div>
                </div>
              </Transition>

              <!-- Instant "loading next clip" feedback while the new clip's
                   data is in flight, over the still-visible previous clip. -->
              <Transition
                enter-active-class="transition-opacity duration-150"
                enter-from-class="opacity-0"
                leave-active-class="transition-opacity duration-200"
                leave-to-class="opacity-0"
              >
                <div
                  v-if="switching"
                  class="pointer-events-none absolute inset-0 z-[6] grid place-items-center bg-black/35"
                  :class="expanded ? 'rounded-xl' : ''"
                >
                  <Spinner class="h-8 w-8 text-white" />
                </div>
              </Transition>

              <!-- Hidden preloader: warms the next clip's video near the end
                   of the current one so the switch plays instantly. Rendered
                   (not display:none) and offscreen so browsers honor the
                   preload hint. -->
              <video
                v-if="preloadSrc"
                :key="preloadSrc"
                :src="preloadSrc"
                data-preload
                preload="auto"
                muted
                playsinline
                tabindex="-1"
                aria-hidden="true"
                class="pointer-events-none absolute h-px w-px opacity-0"
              />
            </div>
          </div>

          <footer
            v-if="expanded"
            class="flex min-h-14 shrink-0 items-center justify-center px-6 py-2"
          >
            <form
              v-if="editing"
              class="flex w-full max-w-xl flex-wrap items-center gap-2"
              @submit.prevent="saveEdit"
            >
              <Label for="clip-modal-title" class="sr-only">
                {{ $t("clips.detail.title_label") }}
              </Label>
              <Input
                id="clip-modal-title"
                v-model="draftTitle"
                class="h-9 min-w-0 flex-1 font-semibold"
                :placeholder="$t('clips.untitled_clip')"
                maxlength="120"
                :disabled="saving"
                @keydown.esc.stop.prevent="cancelEdit"
              />
              <Button type="submit" size="sm" :loading="saving">
                {{ $t("common.save") }}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                :disabled="saving"
                @click="cancelEdit"
              >
                {{ $t("common.cancel") }}
              </Button>
              <p v-if="editError" class="w-full text-xs text-destructive">
                {{ editError }}
              </p>
            </form>
            <p
              v-else
              class="clip-modal-hints hidden items-center gap-2 text-xs text-white/40"
            >
              <Kbd>←</Kbd><Kbd>→</Kbd> {{ $t("clips.detail.previous_next") }}
              <span class="mx-1.5" aria-hidden="true">·</span>
              <Kbd>Esc</Kbd> {{ $t("clips.detail.default_view") }}
            </p>
          </footer>

          <template v-else>
            <div
              class="grid gap-x-10 gap-y-5 px-5 pb-6 pt-5 sm:px-6"
              :class="
                matchCard || !clip ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''
              "
            >
              <template v-if="!clip">
                <div class="grid min-w-0 content-start gap-2">
                  <h2
                    v-if="activeQueueItem"
                    class="text-[clamp(1.375rem,2.1vw,1.875rem)] font-bold leading-[1.15] [text-wrap:balance]"
                  >
                    {{
                      clipDisplayTitle(
                        activeQueueItem.title,
                        activeQueueItem.playerName,
                      ) ?? $t("clips.untitled_clip")
                    }}
                  </h2>
                  <Skeleton v-else class="h-[2.15rem] w-2/3" />
                  <Skeleton class="h-6 w-72 max-w-full rounded-md" />
                </div>
                <Skeleton class="h-[5.375rem] self-start rounded-lg" />
              </template>
              <template v-else>
                <!-- Inset by the scorecard's own padding and border, and the
                     card stretches to this column and spreads its rows, so the
                     title and the kills sit level with its first and last. -->
                <div
                  class="flex min-w-0 flex-col gap-2"
                  :class="matchCard ? 'lg:pb-[11px] lg:pt-[9px]' : ''"
                >
                  <div v-if="!editing" class="flex items-start gap-2">
                    <h2
                      class="min-w-0 flex-1 text-[clamp(1.375rem,2.1vw,1.875rem)] font-bold leading-[1.15] [text-wrap:balance]"
                    >
                      {{ displayTitle }}
                    </h2>
                    <Button
                      v-if="isOwner"
                      variant="ghost"
                      size="icon-sm"
                      class="mt-1 shrink-0 text-white/60"
                      :aria-label="$t('ui.edit_title')"
                      :title="$t('ui.edit_title')"
                      @click="startEdit"
                    >
                      <Pencil />
                    </Button>
                  </div>
                  <form v-else class="grid gap-2" @submit.prevent="saveEdit">
                    <Label for="clip-modal-title" class="sr-only">
                      {{ $t("clips.detail.title_label") }}
                    </Label>
                    <div class="flex flex-wrap items-center gap-2">
                      <Input
                        id="clip-modal-title"
                        v-model="draftTitle"
                        class="h-10 min-w-0 flex-1 text-base font-semibold"
                        :placeholder="$t('clips.untitled_clip')"
                        maxlength="120"
                        :disabled="saving"
                        @keydown.esc.stop.prevent="cancelEdit"
                      />
                      <Button type="submit" size="sm" :loading="saving">
                        {{ $t("common.save") }}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        :disabled="saving"
                        @click="cancelEdit"
                      >
                        {{ $t("common.cancel") }}
                      </Button>
                    </div>
                    <p v-if="editError" class="text-xs text-destructive">
                      {{ editError }}
                    </p>
                  </form>

                  <div
                    class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-white/60"
                  >
                    <NuxtLink
                      v-if="clip.target_steam_id"
                      :to="`/players/${clip.target_steam_id}`"
                      class="group/who flex min-w-0 max-w-full items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
                      @click="closeClip"
                    >
                      <Avatar
                        class="h-6 w-6 shrink-0 text-[10px] ring-1 ring-white/20"
                      >
                        <AvatarImage
                          v-if="targetAvatarSrc"
                          :src="targetAvatarSrc"
                          alt=""
                        />
                        <AvatarFallback>{{
                          clip.target?.name?.slice(0, 1) ?? "?"
                        }}</AvatarFallback>
                      </Avatar>
                      <span
                        class="min-w-0 truncate text-[15px] font-bold text-white transition-colors group-hover/who:text-[hsl(var(--tac-amber))]"
                      >
                        {{ clip.target?.name ?? $t("clips.player") }}
                      </span>
                    </NuxtLink>
                    <template v-if="roundLabel">
                      <span aria-hidden="true">·</span>
                      <span class="tabular-nums">{{ roundLabel }}</span>
                    </template>
                    <template v-if="!matchCard && mapLabel">
                      <span aria-hidden="true">·</span>
                      <span>{{ mapLabel }}</span>
                    </template>
                    <template
                      v-if="
                        clip.user?.name &&
                        clip.user_steam_id !== clip.target_steam_id
                      "
                    >
                      <span aria-hidden="true">·</span>
                      <span class="truncate">{{
                        $t("clips.tile.clipped_by", { name: clip.user.name })
                      }}</span>
                    </template>
                    <span aria-hidden="true">·</span>
                    <TimeAgo :date="clip.created_at" hide-icon />
                  </div>

                  <ClipKillfeed
                    :match-map-id="clip.match_map_id"
                    :round="clip.round"
                    :steam-id="clip.target_steam_id ?? clip.user_steam_id"
                  />
                </div>

                <NuxtLink
                  v-if="matchCard"
                  :to="`/matches/${match!.id}`"
                  class="group/match flex min-w-0 flex-col gap-1.5 self-start rounded-lg border border-border bg-muted/20 px-3 pb-2.5 pt-2 transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] lg:self-stretch lg:justify-between"
                  @click="closeClip"
                >
                  <span
                    class="flex h-4 items-center justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <span class="min-w-0 truncate">{{ matchCard.header }}</span>
                    <span
                      class="inline-flex shrink-0 items-center gap-1 transition-colors group-hover/match:text-foreground"
                    >
                      {{ $t("clips.detail.view_match") }}
                      <ArrowUpRight class="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <span
                    v-for="team in matchCard.teams"
                    :key="team.id"
                    class="flex min-w-0 items-center gap-2 text-[13px] font-semibold"
                    :class="team.lost ? 'text-muted-foreground' : 'text-foreground'"
                  >
                    <img
                      v-if="team.avatar"
                      :src="team.avatar"
                      alt=""
                      class="size-5 shrink-0 rounded-[4px] object-cover"
                      loading="lazy"
                    />
                    <span
                      v-else
                      aria-hidden="true"
                      class="inline-grid size-5 shrink-0 place-items-center rounded-[4px] bg-muted text-[0.6rem] font-extrabold tracking-wide text-foreground/80"
                      >{{ team.monogram }}</span
                    >
                    <span
                      class="min-w-0 truncate"
                      :class="{ 'font-bold': team.won }"
                      :title="team.name"
                      >{{ team.name }}</span
                    >
                    <Avatar
                      v-if="team.hasTarget && clip.target"
                      class="size-4 shrink-0 text-[8px] ring-1 ring-white/20"
                      :title="
                        $t('clips.detail.played_for', { name: clip.target.name })
                      "
                    >
                      <AvatarImage
                        v-if="targetAvatarSrc"
                        :src="targetAvatarSrc"
                        alt=""
                      />
                      <AvatarFallback>{{
                        clip.target.name.slice(0, 1)
                      }}</AvatarFallback>
                    </Avatar>
                    <span
                      v-if="team.score != null"
                      class="ml-auto min-w-[1.125rem] text-right text-sm tabular-nums"
                      :class="{ 'font-bold': !team.lost }"
                      >{{ team.score }}</span
                    >
                  </span>
                </NuxtLink>
              </template>
            </div>

            <section
              v-if="clipQueue.length > 1"
              class="border-t border-white/[0.06] px-5 pb-6 pt-4 sm:px-6"
            >
              <div
                :class="[
                  tacticalSectionLabelClasses,
                  '!flex w-full items-center justify-between',
                ]"
              >
                <span class="inline-flex items-center gap-2">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("clips.detail.up_next") }}
                </span>
                <span
                  v-if="hasQueueNav"
                  class="normal-case tabular-nums tracking-normal"
                >
                  {{ activeClipIndex + 1 }} / {{ clipQueue.length }}
                </span>
              </div>
              <div
                ref="stripRef"
                class="clip-strip -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 pt-1"
              >
                <button
                  v-for="q in clipQueue"
                  :key="q.id"
                  type="button"
                  class="group/q relative isolate aspect-video w-52 shrink-0 snap-start overflow-hidden rounded-lg border bg-card text-left transition-[border-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] motion-safe:active:scale-[0.97]"
                  :class="
                    q.id === clipId
                      ? 'border-[hsl(var(--tac-amber)/0.7)]'
                      : 'border-white/[0.07] hover:border-[hsl(var(--tac-amber)/0.45)]'
                  "
                  :aria-current="q.id === clipId ? 'true' : undefined"
                  @click="openClip(q.id)"
                >
                  <NuxtImg
                    v-if="q.thumbnailUrl ?? q.posterUrl"
                    :src="q.thumbnailUrl ?? q.posterUrl ?? ''"
                    alt=""
                    loading="lazy"
                    class="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover/q:scale-[1.03]"
                  />
                  <span
                    v-else
                    class="absolute inset-0 -z-20 grid place-items-center text-muted-foreground"
                  >
                    <Film class="h-5 w-5 opacity-50" />
                  </span>
                  <span
                    aria-hidden="true"
                    class="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(0_0_0/0.45)_0%,rgb(0_0_0/0)_30%,rgb(0_0_0/0.1)_45%,rgb(0_0_0/0.92)_100%)]"
                  />
                  <span
                    class="absolute inset-x-2 top-2 flex items-center justify-between gap-1.5"
                  >
                    <ClipKillBadge
                      :kills="q.killsCount"
                      :round="q.round"
                      :title="q.title"
                    />
                    <span
                      v-if="q.id === clipId"
                      :class="[
                        tileChip,
                        'ml-auto bg-black/70 text-[hsl(var(--tac-amber))] shadow-[inset_0_0_0_1px_hsl(var(--tac-amber)/0.55)]',
                      ]"
                    >
                      {{ $t("clips.detail.playing") }}
                    </span>
                    <span
                      v-else-if="formatClipDuration(q.durationMs)"
                      :class="[tileChip, 'ml-auto bg-black/60 text-white/90']"
                    >
                      {{ formatClipDuration(q.durationMs) }}
                    </span>
                  </span>
                  <span class="absolute inset-x-2.5 bottom-2 grid gap-0.5">
                    <span
                      class="truncate text-[13px] font-bold leading-tight text-white"
                    >
                      {{
                        clipDisplayTitle(q.title, q.playerName) ??
                        $t("clips.untitled_clip")
                      }}
                    </span>
                    <span
                      v-if="q.mapLabel || q.round != null"
                      class="truncate text-[11px] text-white/60"
                    >
                      {{
                        [
                          q.mapLabel,
                          q.round != null
                            ? $t("clips.tile.round", { round: q.round })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      }}
                    </span>
                  </span>
                </button>
              </div>
            </section>
          </template>
        </template>

      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<style scoped>
/* Default layout: the title row stays above the fold, so the video gives up
   width before the details give up the screen. */
@media (min-width: 640px) {
  .clip-modal--default {
    /* Centred with the translate property, not transform: the zoom-in
       keyframes own transform, and fighting them slid the dialog in from
       the bottom-right corner on open. */
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    width: min(94vw, 76rem, calc((94svh - 15rem) * 16 / 9));
    box-shadow:
      0 0 0 1px rgb(255 255 255 / 0.08),
      0 30px 80px -20px rgb(0 0 0 / 0.8);
  }
}

/* Only shown if the wait is long enough to need it. */
.clip-modal-loading {
  animation: clip-modal-loading-in 200ms ease-out 400ms both;
}
@keyframes clip-modal-loading-in {
  from {
    opacity: 0;
  }
}

/* Expanded: as large as the screen allows; the stage's height (viewport
   minus header and footer) decides the width. */
.clip-modal-stage {
  width: min(100%, calc((100svh - 7.5rem) * 16 / 9));
}
.clip-modal-player--expanded {
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.08),
    0 30px 80px -20px rgb(0 0 0 / 0.8);
}

.clip-nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  transform: translateY(-50%);
  opacity: 0;
  transition:
    opacity 150ms ease-out,
    background-color 150ms ease-out;
}
.clip-nav--prev {
  left: 0.75rem;
}
.clip-nav--next {
  right: 0.75rem;
}
.group\/video:hover .clip-nav,
.clip-nav:focus-visible {
  opacity: 1;
}
@media (hover: none) {
  .clip-nav {
    opacity: 1;
  }
}

/* 30–36px controls, 44px touch targets. */
@media (pointer: coarse) {
  .clip-hit::after {
    content: "";
    position: absolute;
    inset: -6px;
  }
}

@media (hover: hover) and (pointer: fine) {
  .clip-modal-hints {
    display: flex;
  }
}

.clip-strip {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}
</style>

<style>
/* Theater-mode morph (see toggleTheater). View-transition pseudo-elements
   live on the document root, so these can't be scoped; the data attribute
   limits them to this modal's transition. One clock: 240ms enter on the
   app's ease, 110ms ease-in for what leaves. */
:root[data-clip-morph]::view-transition-group(clip-modal-video) {
  animation-duration: 240ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
:root[data-clip-morph]::view-transition-old(clip-modal-video),
:root[data-clip-morph]::view-transition-new(clip-modal-video) {
  height: 100%;
  animation-duration: 240ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
:root[data-clip-morph]::view-transition-old(root) {
  animation: clip-morph-out 110ms ease-in both;
}
:root[data-clip-morph]::view-transition-new(root) {
  animation: clip-morph-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes clip-morph-out {
  to {
    opacity: 0;
  }
}
@keyframes clip-morph-in {
  from {
    opacity: 0;
  }
}
</style>
