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
  Crosshair,
  Download,
  Trash2,
  Share2,
  Check,
  Pencil,
  Lock,
  Globe,
  X,
  Radio,
  ChevronLeft,
  ChevronRight,
  ListVideo,
  Film,
  ArrowUpRight,
  Eye,
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
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import DeleteClipDialog from "~/components/clips/DeleteClipDialog.vue";
import MatchTableRow from "~/components/MatchTableRow.vue";
import {
  clipDownloadName,
  clipDownloadUrl,
} from "~/utilities/clipDownloadName";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { useClipModal } from "~/composables/useClipModal";
import { useClipShare } from "~/composables/useClipShare";
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
const showDelete = ref(false);
const { copiedClipId, shareClip } = useClipShare();
const linkCopied = computed(() =>
  clip.value ? copiedClipId.value === clip.value.id : false,
);
const modalPlayerRef = ref<InstanceType<typeof ClipPlayer> | null>(null);
const modalAutoAdvanced = ref(false);

const isOwner = computed(
  () => !!clip.value && clip.value.user_steam_id === auth.me?.steam_id,
);
const canDelete = computed(() => isOwner.value || auth.isAdmin);

// Strip a leading "<player> — " (or " - ", " – ") prefix from the clip
// title because the player is already named in the Highlighting card.
const displayTitle = computed(() => {
  const raw = clip.value?.title?.trim() ?? "";
  if (!raw) return t("clips.untitled_clip");
  const player = clip.value?.target?.name?.trim();
  if (!player) return raw;
  const escaped = player.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = raw
    .replace(new RegExp(`^${escaped}\\s*[—–-]\\s*`, "i"), "")
    .trim();
  return stripped || raw;
});

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
const canEditVisibility = computed(() => isOwner.value || auth.isAdmin);
const visPopoverOpen = ref(false);
const visSaving = ref(false);
async function setVisibility(v: Visibility) {
  if (!clip.value || visSaving.value || clip.value.visibility === v) {
    visPopoverOpen.value = false;
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
    // promptly, so reflect it locally to keep the chip in sync.
    if (clip.value) {
      clip.value = { ...clip.value, visibility: v };
    }
    visPopoverOpen.value = false;
  } catch (e) {
    console.error("[clip-modal] visibility toggle failed:", e);
  } finally {
    visSaving.value = false;
  }
}

// HEAD the download URL for Content-Length; schema doesn't track size.
const fileSizeBytes = ref<number | null>(null);
let lastSizeUrl: string | null = null;
async function fetchFileSize(url: string) {
  if (lastSizeUrl === url) return;
  lastSizeUrl = url;
  fileSizeBytes.value = null;
  try {
    const res = await fetch(url, { method: "HEAD" });
    const len = res.headers.get("content-length");
    if (len) {
      const n = Number(len);
      if (Number.isFinite(n) && n > 0) fileSizeBytes.value = n;
    }
  } catch {
    // best-effort
  }
}
function formatBytes(b: number | null): string | null {
  if (!b || !Number.isFinite(b)) return null;
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

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
      fileSizeBytes.value = null;
      lastSizeUrl = null;
      prefetchedClip.value = null;
      prefetchingId.value = null;
    }
  },
  { immediate: true },
);

watch(
  () => clip.value?.download_url ?? null,
  (url) => {
    if (url) void fetchFileSize(url);
  },
);
onBeforeUnmount(() => {
  activeSub?.unsubscribe();
  activeSub = null;
  window.removeEventListener("keydown", onModalKeydown);
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
const queuePositionLabel = computed(() => {
  if (!hasQueueNav.value) return null;
  return `${activeClipIndex.value + 1} / ${clipQueue.value.length}`;
});

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
    // Title-only — visibility is owned by the header chip; sending it
    // here would stomp concurrent edits.
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

function onDeleted() {
  closeClip();
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Same compact tactical format the reel uses ("5D AGO", "1H AGO"…)
// so the bottom player-display row reads identically in both surfaces.
function formatRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return null;
  const diff = Date.now() - ts;
  if (diff < 0) return t("clips.detail.just_now");
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return t("clips.detail.just_now");
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  return `${Math.floor(diff / (30 * day))}mo ago`;
}

const downloadFilename = computed<string>(() =>
  clip.value ? clipDownloadName(clip.value) : "clip.mp4",
);

const targetAvatarSrc = computed(() =>
  resolveAvatarUrl(clip.value?.target?.avatar_url ?? null, apiDomain.value),
);
const targetLineup = computed(() => {
  const sid = clip.value?.target_steam_id;
  const match = clip.value?.match_map?.match;
  if (!sid || !match) return null;
  const lineups = [match.lineup_1, match.lineup_2];
  return (
    lineups.find((lineup) =>
      lineup?.lineup_players?.some(
        (member) =>
          String(member.steam_id ?? member.player?.steam_id) === String(sid),
      ),
    ) ?? null
  );
});
const targetTeamName = computed(() => targetLineup.value?.name ?? null);
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

function onModalProgress({
  currentTime,
  duration,
}: {
  progress: number;
  currentTime: number;
  duration: number;
}) {
  if (!Number.isFinite(duration) || duration <= 0) return;
  const remaining = duration - currentTime;
  if (nextClip.value && remaining <= PRELOAD_REMAINING_S) {
    void prefetchNextClip();
  }
  if (nextClip.value && remaining <= 0.35 && !modalAutoAdvanced.value) {
    modalAutoAdvanced.value = true;
    openNextClip();
  }
}

function onModalEnded() {
  if (nextClip.value && !modalAutoAdvanced.value) {
    modalAutoAdvanced.value = true;
    openNextClip();
  }
}

watch(
  () => clip.value?.id,
  (id) => {
    modalAutoAdvanced.value = false;
    if (id) {
      void nextTick().then(() => modalPlayerRef.value?.play());
    }
  },
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
});
</script>

<template>
  <Dialog :open="open" @update:open="onUpdateOpen">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent
        :class="[
          'clip-modal-content',
          'fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'z-[60] w-full sm:w-[min(95vw,68rem)] max-h-svh sm:max-h-[92vh] overflow-y-auto',
          'flex flex-col',
          'bg-[hsl(var(--background))] sm:rounded-xl',
          'border border-border/60 sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'duration-200',
        ]"
      >
        <VisuallyHidden as-child>
          <DialogTitle>{{ clip?.title || $t("common.clip") }}</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden as-child>
          <DialogDescription>{{
            $t("clips.detail.highlight_clip_viewer")
          }}</DialogDescription>
        </VisuallyHidden>

        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-2 top-2 h-[14px] w-[14px] border-l-2 border-t-2 border-[hsl(var(--tac-amber))] z-10"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute right-2 top-2 h-[14px] w-[14px] border-r-2 border-t-2 border-[hsl(var(--tac-amber))] z-10"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-2 bottom-2 h-[14px] w-[14px] border-l-2 border-b-2 border-[hsl(var(--tac-amber))] z-10"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute right-2 bottom-2 h-[14px] w-[14px] border-r-2 border-b-2 border-[hsl(var(--tac-amber))] z-10"
        ></span>

        <div
          class="relative flex items-center gap-3 border-b border-border/40 px-4 sm:px-5 py-2.5"
        >
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--tac-amber))] opacity-60 animate-ping"
            ></span>
            <span
              class="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tac-amber))]"
            ></span>
          </span>
          <Radio class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
          <span
            class="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-foreground/80"
          >
            {{ $t("clips.detail.default_title") }}
          </span>

          <Popover
            v-if="clip && canEditVisibility"
            v-model:open="visPopoverOpen"
          >
            <PopoverTrigger
              class="ml-auto inline-flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-card/50 pl-1.5 pr-2.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] transition-colors cursor-pointer hover:border-[hsl(var(--tac-amber)/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="
                clip.visibility === 'public'
                  ? 'text-emerald-300 hover:text-emerald-200'
                  : 'text-muted-foreground hover:text-foreground'
              "
              :title="
                $t('ui_extras.visibility_change_hint', {
                  value: clip.visibility,
                })
              "
            >
              <span
                class="inline-flex h-4 w-4 items-center justify-center rounded-full"
                :class="
                  clip.visibility === 'public'
                    ? 'bg-emerald-400/15'
                    : 'bg-white/5'
                "
              >
                <Spinner v-if="visSaving" class="h-3 w-3" />
                <Lock
                  v-else-if="clip.visibility === 'private'"
                  class="h-3 w-3"
                />
                <Globe v-else class="h-3 w-3" />
              </span>
              {{ clip.visibility }}
            </PopoverTrigger>
            <PopoverContent class="z-[70] w-64 p-1" align="end">
              <div
                class="px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("clips.detail.visibility") }}
              </div>
              <button
                v-for="opt in VISIBILITY_OPTIONS"
                :key="opt.value"
                type="button"
                class="w-full text-left flex items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/60 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                :class="clip.visibility === opt.value ? 'bg-muted/40' : ''"
                :disabled="visSaving"
                @click="setVisibility(opt.value)"
              >
                <span
                  class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded"
                  :class="
                    opt.value === 'public'
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : 'bg-muted/40 text-muted-foreground'
                  "
                >
                  <component :is="opt.icon" class="h-3 w-3" />
                </span>
                <span class="flex-1 min-w-0">
                  <span class="flex items-center gap-1.5 font-medium">
                    {{ opt.label }}
                    <Check
                      v-if="clip.visibility === opt.value"
                      class="h-3 w-3 text-[hsl(var(--tac-amber))]"
                    />
                  </span>
                  <span
                    class="block text-[0.7rem] text-muted-foreground leading-snug"
                  >
                    {{ opt.hint }}
                  </span>
                </span>
              </button>
            </PopoverContent>
          </Popover>
          <span
            v-else-if="clip"
            class="ml-auto inline-flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-card/40 pl-1.5 pr-2.5 font-mono text-[0.6rem] uppercase tracking-[0.18em]"
            :class="
              clip.visibility === 'public'
                ? 'text-emerald-300'
                : 'text-muted-foreground'
            "
            :title="
              $t('ui_extras.visibility_label', { value: clip.visibility })
            "
          >
            <Lock v-if="clip.visibility === 'private'" class="h-3 w-3" />
            <Globe v-else class="h-3 w-3" />
            {{ clip.visibility }}
          </span>

          <span
            v-if="hasQueueNav"
            class="hidden sm:inline-flex h-7 items-center rounded-full border border-border/60 bg-card/35 px-2.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground tabular-nums"
          >
            {{ queuePositionLabel }}
          </span>
          <div v-if="hasQueueNav" class="inline-flex items-center gap-1">
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))] disabled:cursor-not-allowed disabled:opacity-35"
              :disabled="!previousClip"
              :title="previousClip?.title ?? $t('ui_extras.previous_clip')"
              @click="openPreviousClip"
            >
              <ChevronLeft class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))] disabled:cursor-not-allowed disabled:opacity-35"
              :disabled="!nextClip"
              :title="nextClip?.title ?? $t('ui_extras.next_clip')"
              @click="openNextClip"
            >
              <ChevronRight class="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            class="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))] transition-colors cursor-pointer"
            @click="closeClip"
          >
            <X class="h-3 w-3" />
            <span class="hidden sm:inline">{{ $t("common.close") }}</span>
          </button>
        </div>

        <div
          v-if="loading || (!clip && !notFound)"
          class="grid gap-4 p-4 sm:p-5 lg:grid-cols-[2fr_1fr]"
        >
          <div
            class="aspect-video w-full rounded-md bg-muted/30 animate-pulse"
          ></div>
          <div class="space-y-3">
            <div class="h-7 w-3/4 rounded bg-muted/30 animate-pulse"></div>
            <div class="h-4 w-1/2 rounded bg-muted/30 animate-pulse"></div>
            <div class="h-32 rounded bg-muted/20 animate-pulse"></div>
          </div>
        </div>

        <div
          v-else-if="notFound"
          class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
        >
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-destructive"
          >
            {{ $t("clips.detail.signal_lost") }}
          </span>
          <h2 class="text-lg font-semibold">
            {{ $t("clips.detail.clip_not_found") }}
          </h2>
          <p class="text-sm text-muted-foreground max-w-sm">
            {{ $t("clips.detail.clip_not_found_description") }}
          </p>
          <Button variant="outline" size="sm" @click="closeClip">{{
            $t("common.close")
          }}</Button>
        </div>

        <div
          v-else-if="clip"
          class="grid gap-4 sm:gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)] flex-1 min-h-0"
        >
          <div
            class="flex flex-col gap-3 min-w-0"
            :class="clipQueue.length > 1 ? 'justify-start' : 'justify-center'"
          >
            <div class="group/video relative">
              <ClipPlayer
                ref="modalPlayerRef"
                :src="clip.download_url"
                :poster="
                  clip.thumbnail_download_url ??
                  clip.match_map?.map?.poster ??
                  null
                "
                :clip-key="clip.id"
                @ended="onModalEnded"
                @progress="onModalProgress"
              >
                <template #empty>
                  <div
                    class="absolute inset-0 flex items-center justify-center text-muted-foreground"
                  >
                    <Spinner class="h-6 w-6" />
                    <span
                      class="ml-3 text-sm font-mono uppercase tracking-[0.18em]"
                    >
                      {{ $t("clips.detail.render_finalizing") }}
                    </span>
                  </div>
                </template>
                <template #top-left>
                  <h2
                    class="min-w-0 truncate text-base sm:text-xl font-bold uppercase leading-tight tracking-[0.01em] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
                    :title="displayTitle"
                  >
                    {{ displayTitle }}
                  </h2>
                </template>
                <template #top-right>
                  <span
                    class="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2.5 font-mono text-[0.7rem] font-medium leading-none tabular-nums text-white/85 backdrop-blur-sm"
                    :title="
                      t(
                        'clips.plays_count',
                        { count: clip.views_count ?? 0 },
                        clip.views_count ?? 0,
                      )
                    "
                  >
                    <Eye class="h-3.5 w-3.5" />
                    {{ clip.views_count ?? 0 }}
                  </span>
                  <button
                    v-if="isOwner && !editing"
                    type="button"
                    class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/85 backdrop-blur-sm transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))] cursor-pointer"
                    :title="$t('ui.edit_title')"
                    @click.stop="startEdit"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-black/55 backdrop-blur-sm transition-all duration-200 hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))] cursor-pointer"
                    :class="
                      linkCopied
                        ? 'share-flash border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber))] scale-110'
                        : 'border-white/20 text-white/85'
                    "
                    :title="
                      linkCopied
                        ? $t('clips.link_copied')
                        : $t('clips.share_clip')
                    "
                    :aria-label="$t('clips.share_clip')"
                    @click.stop="copyLink"
                  >
                    <Check v-if="linkCopied" class="h-3.5 w-3.5" />
                    <Share2 v-else class="h-3.5 w-3.5" />
                  </button>
                </template>
                <template #bottom>
                  <div class="flex min-w-0 items-center gap-2.5">
                    <span
                      class="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.14)]"
                    >
                      <NuxtImg
                        v-if="targetAvatarSrc"
                        :src="targetAvatarSrc"
                        :alt="clip.target?.name ?? 'Player'"
                        class="h-full w-full object-cover"
                      />
                      <span
                        v-else
                        class="font-mono text-xs font-bold uppercase text-[hsl(var(--tac-amber))]"
                      >
                        {{
                          clip.target?.name?.charAt(0) ??
                          clip.title?.charAt(0) ??
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
                            v-if="clip.target_steam_id"
                            :to="`/players/${clip.target_steam_id}`"
                            class="pointer-events-auto text-white transition-colors hover:text-[hsl(var(--tac-amber))]"
                            :title="`Open ${clip.target?.name ?? 'player'}'s profile`"
                            @click.stop="closeClip"
                            >{{
                              clip.target?.name ?? $t("clips.match_highlight")
                            }}</NuxtLink
                          ><template v-else>{{
                            clip.target?.name ?? $t("clips.match_highlight")
                          }}</template
                          ><span
                            v-if="targetTeamName"
                            class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white/55"
                          >
                            · {{ targetTeamName }}</span
                          ></span
                        >
                        <span
                          class="inline-flex shrink-0 items-center gap-1 rounded border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.85)] px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-white tabular-nums shadow-[0_0_10px_hsl(var(--destructive)/0.4)]"
                          :title="`${clip.kills_count ?? 1} kill${(clip.kills_count ?? 1) === 1 ? '' : 's'} in clip`"
                        >
                          <Crosshair class="h-3 w-3" />
                          {{ clip.kills_count ?? 1 }}K
                        </span>
                      </div>
                      <div class="mt-0.5 flex min-w-0 items-center gap-1.5">
                        <span
                          v-if="clip.match_map?.map?.name"
                          class="min-w-0 truncate font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/55"
                          ><!--
                        -->{{ clip.match_map.map.name }}</span
                        >
                        <span
                          v-if="formatRelativeTime(clip.created_at)"
                          class="shrink-0 font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/40"
                        >
                          · {{ formatRelativeTime(clip.created_at) }}
                        </span>
                        <span
                          class="shrink-0 font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/40 tabular-nums"
                        >
                          · {{ formatDuration(clip.duration_ms) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
              </ClipPlayer>

              <button
                v-if="previousClip"
                type="button"
                class="clip-nav-button clip-nav-button--prev opacity-0 transition-opacity duration-200 group-hover/video:opacity-100 focus-visible:opacity-100"
                :title="previousClip.title ?? $t('ui_extras.previous_clip')"
                @click="openPreviousClip"
              >
                <ChevronLeft class="h-5 w-5" />
              </button>
              <button
                v-if="nextClip"
                type="button"
                class="clip-nav-button clip-nav-button--next opacity-0 transition-opacity duration-200 group-hover/video:opacity-100 focus-visible:opacity-100"
                :title="nextClip.title ?? $t('ui_extras.next_clip')"
                @click="openNextClip"
              >
                <ChevronRight class="h-5 w-5" />
              </button>

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
                  class="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center rounded-md bg-black/35 backdrop-blur-[1px]"
                >
                  <Spinner class="h-9 w-9 text-[hsl(var(--tac-amber))]" />
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
                preload="auto"
                muted
                playsinline
                tabindex="-1"
                aria-hidden="true"
                class="pointer-events-none absolute h-px w-px opacity-0"
              />
            </div>

            <div
              v-if="editing"
              class="relative rounded-md border border-border/50 bg-[linear-gradient(180deg,hsl(var(--card)/0.55)_0%,hsl(var(--card)/0.25)_100%)] [backdrop-filter:blur(6px)] px-4 py-3"
            >
              <span
                aria-hidden="true"
                class="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-[hsl(var(--tac-amber))] via-[hsl(var(--tac-amber)/0.6)] to-transparent"
              ></span>
              <div class="space-y-3">
                <div class="space-y-1">
                  <Label
                    for="clip-modal-title"
                    class="text-[0.62rem] font-mono uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {{ $t("clips.detail.title_label") }}
                  </Label>
                  <Input
                    id="clip-modal-title"
                    v-model="draftTitle"
                    :placeholder="$t('clips.untitled_clip')"
                    maxlength="120"
                    :disabled="saving"
                  />
                </div>
                <p v-if="editError" class="text-xs text-destructive">
                  {{ editError }}
                </p>
                <div class="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    :disabled="saving"
                    @click="cancelEdit"
                  >
                    {{ $t("common.cancel") }}
                  </Button>
                  <Button size="sm" :disabled="saving" @click="saveEdit">
                    <Spinner v-if="saving" class="h-3.5 w-3.5 mr-1.5" />
                    {{ $t("common.save") }}
                  </Button>
                </div>
              </div>
            </div>

            <div
              v-if="clipQueue.length > 1"
              class="flex flex-col rounded-md border border-border/50 bg-card/30 [backdrop-filter:blur(6px)]"
            >
              <div
                class="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                <span class="inline-flex items-center gap-2">
                  <ListVideo class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
                  {{ $t("clips.detail.other_clips") }}
                </span>
                <span class="tabular-nums">
                  {{ activeClipIndex + 1 }} / {{ clipQueue.length }}
                </span>
              </div>
              <div class="clip-queue-list max-h-[17rem] overflow-y-auto p-1.5">
                <button
                  v-for="q in clipQueue"
                  :key="q.id"
                  type="button"
                  class="group/q relative flex w-full items-center gap-2 rounded border px-1.5 py-1.5 text-left transition-colors"
                  :class="
                    q.id === clip.id
                      ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)]'
                      : 'border-transparent hover:bg-muted/40'
                  "
                  :title="q.title ?? 'Clip'"
                  @click="openClip(q.id)"
                >
                  <span
                    class="relative h-10 w-16 shrink-0 overflow-hidden rounded border border-border/50 bg-black"
                  >
                    <NuxtImg
                      v-if="q.thumbnailUrl ?? q.posterUrl"
                      :src="q.thumbnailUrl ?? q.posterUrl ?? ''"
                      :alt="q.title ?? 'Clip'"
                      class="h-full w-full object-cover opacity-85 transition-transform duration-300 group-hover/q:scale-[1.04]"
                    />
                    <span
                      v-else
                      class="flex h-full w-full items-center justify-center text-muted-foreground"
                    >
                      <Film class="h-3.5 w-3.5" />
                    </span>
                    <span
                      v-if="q.id === clip.id"
                      class="absolute left-1 top-1 inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_6px_hsl(var(--tac-amber)/0.8)]"
                    ></span>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate text-sm font-semibold"
                      :class="
                        q.id === clip.id
                          ? 'text-[hsl(var(--tac-amber))]'
                          : 'text-foreground'
                      "
                    >
                      {{ q.playerName ?? $t("common.clip") }}
                    </span>
                    <span
                      class="block truncate font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      {{ q.title ?? $t("common.untitled") }}
                    </span>
                  </span>
                  <ChevronRight
                    v-if="q.id !== clip.id"
                    class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-all group-hover/q:translate-x-0.5 group-hover/q:text-[hsl(var(--tac-amber))]"
                  />
                </button>
              </div>
            </div>
          </div>

          <aside class="flex flex-col gap-3 min-w-0">
            <NuxtLink
              v-if="clip.match_map?.match"
              :to="`/matches/${clip.match_map.match.id}`"
              class="group/match-link flex flex-col items-stretch !h-auto cursor-pointer"
              @click="closeClip"
            >
              <MatchTableRow
                :match="clip.match_map.match"
                compact
                always-show
                hide-overview
                class="!h-auto pointer-events-none rounded-md border border-transparent transition-all group-hover/match-link:border-[hsl(var(--tac-amber)/0.5)] group-hover/match-link:bg-[hsl(var(--tac-amber)/0.05)] group-hover/match-link:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.25)]"
              />
              <span
                class="mt-1 inline-flex items-center gap-1 self-end font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover/match-link:text-[hsl(var(--tac-amber))]"
              >
                {{ $t("clips.detail.view_match") }}
                <ArrowUpRight
                  class="h-3 w-3 transition-transform group-hover/match-link:translate-x-0.5 group-hover/match-link:-translate-y-0.5"
                />
              </span>
            </NuxtLink>

            <dl
              v-if="formatBytes(fileSizeBytes)"
              class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm rounded-md border border-border/50 bg-card/30 [backdrop-filter:blur(6px)] px-4 py-3"
            >
              <dt
                class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground self-center"
              >
                Size
              </dt>
              <dd class="text-right font-mono tabular-nums">
                {{ formatBytes(fileSizeBytes) }}
              </dd>
            </dl>

            <div class="mt-auto flex flex-col gap-2">
              <button
                type="button"
                class="action-tile action-tile--primary group"
                :class="linkCopied ? 'action-tile--primary-copied' : ''"
                :aria-label="
                  linkCopied ? $t('toasts.link_copied') : $t('clips.share_clip')
                "
                @click.stop="copyLink"
              >
                <Check v-if="linkCopied" class="h-4 w-4" />
                <Share2 v-else class="h-4 w-4" />
                <span>{{
                  linkCopied ? $t("clips.link_copied") : $t("clips.share_clip")
                }}</span>
              </button>
              <div class="grid grid-cols-2 gap-2">
                <a
                  v-if="clip.download_url"
                  :href="clipDownloadUrl(clip.download_url)"
                  :download="downloadFilename"
                  class="action-tile group"
                  :class="canDelete ? '' : 'col-span-2'"
                >
                  <Download class="h-4 w-4" />
                  <span>{{ $t("common.download") }}</span>
                </a>
                <button
                  v-if="canDelete"
                  type="button"
                  class="action-tile action-tile--danger group"
                  :class="clip.download_url ? '' : 'col-span-2'"
                  @click="showDelete = true"
                >
                  <Trash2 class="h-4 w-4" />
                  <span>{{ $t("ui_extras.delete_clip") }}</span>
                </button>
              </div>
            </div>
          </aside>
        </div>

        <DeleteClipDialog
          v-model="showDelete"
          :clip-id="clip?.id ?? null"
          :title="clip?.title ?? null"
          @deleted="onDeleted"
        />
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<style scoped>
.clip-scanlines {
  background-image:
    repeating-linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0) 0,
      rgba(255, 255, 255, 0) 2px,
      rgba(0, 0, 0, 0.18) 2px,
      rgba(0, 0, 0, 0.18) 3px
    ),
    radial-gradient(
      ellipse at center,
      transparent 60%,
      rgba(0, 0, 0, 0.45) 100%
    );
  mix-blend-mode: multiply;
  opacity: 0.35;
  transform: translateZ(0);
}

.clip-nav-button {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: inline-flex;
  height: 2.5rem;
  width: 2.5rem;
  transform: translateY(-50%);
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border) / 0.65);
  border-radius: 0.375rem;
  background: hsl(0 0% 0% / 0.58);
  color: hsl(var(--foreground) / 0.8);
  cursor: pointer;
  opacity: 0.78;
  backdrop-filter: blur(8px);
  transition:
    opacity 150ms ease,
    border-color 150ms ease,
    color 150ms ease,
    transform 150ms ease;
}
.clip-nav-button:hover {
  border-color: hsl(var(--tac-amber) / 0.7);
  color: hsl(var(--tac-amber));
  opacity: 1;
}
.clip-nav-button--prev {
  left: 0.75rem;
}
.clip-nav-button--prev:hover {
  transform: translate(-2px, -50%);
}
.clip-nav-button--next {
  right: 0.75rem;
}
.clip-nav-button--next:hover {
  transform: translate(2px, -50%);
}

.action-tile {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 2.5rem;
  padding: 0 0.875rem;
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--border) / 0.6);
  background: hsl(var(--card) / 0.45);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: hsl(var(--foreground) / 0.85);
  cursor: pointer;
  transition: all 150ms ease;
  user-select: none;
}
.action-tile::after {
  content: "";
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-top: 1px solid hsl(var(--tac-amber) / 0.55);
  border-right: 1px solid hsl(var(--tac-amber) / 0.55);
  transition: border-color 150ms ease;
}
.action-tile:hover {
  border-color: hsl(var(--tac-amber) / 0.6);
  background: hsl(var(--tac-amber) / 0.08);
  color: hsl(var(--foreground));
}
.action-tile:hover::after {
  border-color: hsl(var(--tac-amber));
}
.action-tile:active {
  transform: translateY(1px);
}
.action-tile--primary {
  height: 2.75rem;
  border-color: hsl(var(--tac-amber));
  background: linear-gradient(
    135deg,
    var(--tac-amber-cta-from) 0%,
    hsl(var(--tac-amber)) 50%,
    var(--tac-amber-cta-to) 100%
  );
  color: hsl(0 0% 8%);
  font-weight: 700;
  letter-spacing: 0.18em;
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.35),
    0 6px 18px -6px hsl(var(--tac-amber) / 0.55);
}
.action-tile--primary::after {
  border-top-color: hsl(0 0% 8% / 0.65);
  border-right-color: hsl(0 0% 8% / 0.65);
}
.action-tile--primary:hover {
  transform: translateY(-1px);
  background: linear-gradient(
    135deg,
    color-mix(in hsl, var(--tac-amber-cta-from), white 12%) 0%,
    hsl(var(--tac-amber)) 50%,
    color-mix(in hsl, var(--tac-amber-cta-to), white 10%) 100%
  );
  color: hsl(0 0% 6%);
  border-color: hsl(var(--tac-amber));
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.55),
    0 12px 28px -6px hsl(var(--tac-amber) / 0.75),
    0 0 24px hsl(var(--tac-amber) / 0.35);
}
.action-tile--primary:hover::after {
  border-top-color: hsl(0 0% 8%);
  border-right-color: hsl(0 0% 8%);
}
.action-tile--primary:active {
  transform: translateY(0);
}
.action-tile--primary-copied {
  animation: share-flash 480ms ease-out;
}
@keyframes share-flash {
  0% {
    box-shadow:
      0 0 0 1px hsl(var(--tac-amber)),
      0 0 32px hsl(var(--tac-amber) / 0.9);
  }
  100% {
    box-shadow:
      0 0 0 1px hsl(var(--tac-amber) / 0.55),
      0 12px 28px -6px hsl(var(--tac-amber) / 0.75);
  }
}

.action-tile--danger {
  color: hsl(var(--destructive) / 0.9);
}
.action-tile--danger::after {
  border-top-color: hsl(var(--destructive) / 0.55);
  border-right-color: hsl(var(--destructive) / 0.55);
}
.action-tile--danger:hover {
  border-color: hsl(var(--destructive) / 0.7);
  background: hsl(var(--destructive) / 0.08);
  color: hsl(var(--destructive));
}
.action-tile--danger:hover::after {
  border-top-color: hsl(var(--destructive));
  border-right-color: hsl(var(--destructive));
}

.clip-queue-list {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border) / 0.6) transparent;
}
.clip-queue-list::-webkit-scrollbar {
  width: 6px;
}
.clip-queue-list::-webkit-scrollbar-track {
  background: transparent;
}
.clip-queue-list::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.6);
  border-radius: 999px;
}
.clip-queue-list::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--tac-amber) / 0.5);
}
</style>
