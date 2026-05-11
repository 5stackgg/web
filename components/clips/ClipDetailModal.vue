<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  Download,
  Loader2,
  Trash2,
  Share2,
  Check,
  Pencil,
  Eye,
  Lock,
  Globe,
  X,
  Radio,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Shield,
  ListVideo,
  Film,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFieldsWithLineups } from "~/graphql/matchClip";
import type { Clip } from "~/types/clip";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import ClipMatchSummary from "~/components/clips/ClipMatchSummary.vue";
import {
  clipDownloadName,
  clipDownloadUrl,
} from "~/utilities/clipDownloadName";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { useClipModal } from "~/composables/useClipModal";

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
const linkCopied = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);
const videoProgress = ref(0);
const modalAutoAdvanced = ref(false);
const videoPlaying = ref(false);
const showIntroOverlay = ref(false);
let introOverlayTimer: ReturnType<typeof setTimeout> | null = null;

const isOwner = computed(
  () => !!clip.value && clip.value.user_steam_id === auth.me?.steam_id,
);
const canDelete = computed(() => isOwner.value || auth.isAdmin);

// Strip a leading "<player> — " (or " - ", " – ") prefix from the clip
// title because the player is already named in the Highlighting card.
const displayTitle = computed(() => {
  const raw = clip.value?.title?.trim() ?? "";
  if (!raw) return "Untitled clip";
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

type Visibility = "private" | "unlisted" | "public";
const VISIBILITY_OPTIONS: Array<{
  value: Visibility;
  label: string;
  icon: any;
  hint: string;
}> = [
  {
    value: "public",
    label: "Public",
    icon: Globe,
    hint: "Listed in the highlights feed",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    icon: Eye,
    hint: "Hidden from feeds — anyone with the link can view",
  },
  {
    value: "private",
    label: "Private",
    icon: Lock,
    hint: "Hidden from feeds — file URL still plays if shared",
  },
];
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

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe(id: string) {
  activeSub?.unsubscribe();
  notFound.value = false;
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
      linkCopied.value = false;
      fileSizeBytes.value = null;
      lastSizeUrl = null;
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
  if (introOverlayTimer) {
    clearTimeout(introOverlayTimer);
    introOverlayTimer = null;
  }
  window.removeEventListener("keydown", onModalKeydown);
});

const open = computed(() => !!props.clipId);
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

async function copyLink() {
  if (!clip.value) return;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/clips/${clip.value.id}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    linkCopied.value = true;
    setTimeout(() => (linkCopied.value = false), 1500);
  } catch (e) {
    console.error("[clip-modal] copy failed:", e);
  }
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
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
const targetTeamAvatarSrc = computed(() =>
  resolveAvatarUrl(
    targetLineup.value?.team?.avatar_url ?? null,
    apiDomain.value,
  ),
);
async function playModalVideo() {
  await nextTick();
  const video = videoRef.value;
  if (!video) return;
  try {
    await video.play();
  } catch {
    // Browser autoplay policy can still refuse; controls remain available.
  }
}

function onModalTimeUpdate() {
  const video = videoRef.value;
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
    videoProgress.value = 0;
    return;
  }
  videoProgress.value = Math.min(1, video.currentTime / video.duration);
  const remaining = video.duration - video.currentTime;
  if (nextClip.value && remaining <= 0.35 && !modalAutoAdvanced.value) {
    modalAutoAdvanced.value = true;
    openNextClip();
  }
}

function onModalEnded() {
  videoProgress.value = 1;
  videoPlaying.value = false;
  if (nextClip.value && !modalAutoAdvanced.value) {
    modalAutoAdvanced.value = true;
    openNextClip();
  }
}

function onModalPlay() {
  videoPlaying.value = true;
}

function onModalPause() {
  videoPlaying.value = false;
}

watch(
  () => clip.value?.id,
  (id) => {
    videoProgress.value = 0;
    modalAutoAdvanced.value = false;
    videoPlaying.value = false;
    if (introOverlayTimer) clearTimeout(introOverlayTimer);
    if (id) {
      showIntroOverlay.value = true;
      introOverlayTimer = setTimeout(() => {
        showIntroOverlay.value = false;
      }, 1800);
      void playModalVideo();
    } else {
      showIntroOverlay.value = false;
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
        class="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent
        :class="[
          'clip-modal-content',
          'fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'z-50 w-full sm:w-[min(95vw,68rem)] max-h-svh sm:max-h-[92vh] overflow-y-auto',
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
          <DialogTitle>{{ clip?.title || "Clip" }}</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden as-child>
          <DialogDescription> Highlight clip viewer </DialogDescription>
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
            Highlight
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
                  : clip.visibility === 'unlisted'
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-muted-foreground hover:text-foreground'
              "
              :title="`Visibility: ${clip.visibility}. Click to change.`"
            >
              <span
                class="inline-flex h-4 w-4 items-center justify-center rounded-full"
                :class="
                  clip.visibility === 'public'
                    ? 'bg-emerald-400/15'
                    : clip.visibility === 'unlisted'
                      ? 'bg-amber-400/15'
                      : 'bg-white/5'
                "
              >
                <Loader2 v-if="visSaving" class="h-3 w-3 animate-spin" />
                <Lock
                  v-else-if="clip.visibility === 'private'"
                  class="h-3 w-3"
                />
                <Eye
                  v-else-if="clip.visibility === 'unlisted'"
                  class="h-3 w-3"
                />
                <Globe v-else class="h-3 w-3" />
              </span>
              {{ clip.visibility }}
            </PopoverTrigger>
            <PopoverContent class="w-64 p-1" align="end">
              <div
                class="px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                Visibility
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
                      : opt.value === 'unlisted'
                        ? 'bg-amber-400/15 text-amber-300'
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
                : clip.visibility === 'unlisted'
                  ? 'text-amber-300'
                  : 'text-muted-foreground'
            "
            :title="`Visibility: ${clip.visibility}`"
          >
            <Lock v-if="clip.visibility === 'private'" class="h-3 w-3" />
            <Eye v-else-if="clip.visibility === 'unlisted'" class="h-3 w-3" />
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
              :title="previousClip?.title ?? 'Previous clip'"
              @click="openPreviousClip"
            >
              <ChevronLeft class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))] disabled:cursor-not-allowed disabled:opacity-35"
              :disabled="!nextClip"
              :title="nextClip?.title ?? 'Next clip'"
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
            <span class="hidden sm:inline">Close</span>
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
            Signal lost
          </span>
          <h2 class="text-lg font-semibold">Clip not found</h2>
          <p class="text-sm text-muted-foreground max-w-sm">
            It may have been deleted, or you don't have permission to view it.
          </p>
          <Button variant="outline" size="sm" @click="closeClip">Close</Button>
        </div>

        <div
          v-else-if="clip"
          class="grid gap-4 sm:gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] flex-1 min-h-0"
        >
          <div
            class="flex flex-col gap-3 min-w-0"
            :class="clipQueue.length > 1 ? 'justify-start' : 'justify-center'"
          >
            <div
              class="group/video relative aspect-video w-full overflow-hidden rounded-md bg-black border border-border/60"
            >
              <video
                v-if="clip.download_url"
                ref="videoRef"
                :src="clip.download_url"
                :poster="
                  clip.thumbnail_download_url ??
                  clip.match_map?.map?.poster ??
                  undefined
                "
                class="absolute inset-0 h-full w-full object-contain"
                controls
                autoplay
                muted
                playsinline
                preload="auto"
                @ended="onModalEnded"
                @loadedmetadata="onModalTimeUpdate"
                @timeupdate="onModalTimeUpdate"
                @play="onModalPlay"
                @pause="onModalPause"
              />
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center text-muted-foreground"
              >
                <Loader2 class="h-6 w-6 animate-spin" />
                <span
                  class="ml-3 text-sm font-mono uppercase tracking-[0.18em]"
                >
                  Render finalizing…
                </span>
              </div>

              <div
                class="pointer-events-none absolute inset-x-0 top-0 z-[3] flex items-start gap-2 p-3 sm:p-4 bg-[linear-gradient(180deg,hsl(0_0%_0%/0.7)_0%,transparent_100%)] transition-opacity duration-300"
                :class="
                  videoPlaying && !showIntroOverlay && !editing
                    ? 'opacity-0 group-hover/video:opacity-100'
                    : 'opacity-100'
                "
              >
                <h2
                  class="min-w-0 flex-1 truncate text-base sm:text-xl font-bold uppercase leading-tight tracking-[0.01em] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
                  :title="displayTitle"
                >
                  {{ displayTitle }}
                </h2>
                <button
                  v-if="isOwner && !editing"
                  type="button"
                  class="pointer-events-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/20 bg-black/55 text-white/85 backdrop-blur-sm transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))] cursor-pointer"
                  title="Edit title"
                  @click="startEdit"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </button>
              </div>

              <div
                class="clip-scanlines pointer-events-none absolute inset-0"
              ></div>

              <div
                v-if="nextClip"
                class="pointer-events-none absolute right-3 top-3 z-[2] inline-flex max-w-[60%] items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-2.5 py-1 font-mono text-[0.54rem] uppercase tracking-[0.18em] text-white/75 backdrop-blur-md"
              >
                <span class="text-[hsl(var(--tac-amber))]">Next:</span>
                <span class="truncate">
                  {{ nextClip.playerName ?? "clip" }}
                </span>
              </div>

              <button
                v-if="previousClip"
                type="button"
                class="clip-nav-button clip-nav-button--prev opacity-0 transition-opacity duration-200 group-hover/video:opacity-100 focus-visible:opacity-100"
                :title="previousClip.title ?? 'Previous clip'"
                @click="openPreviousClip"
              >
                <ChevronLeft class="h-5 w-5" />
              </button>
              <button
                v-if="nextClip"
                type="button"
                class="clip-nav-button clip-nav-button--next opacity-0 transition-opacity duration-200 group-hover/video:opacity-100 focus-visible:opacity-100"
                :title="nextClip.title ?? 'Next clip'"
                @click="openNextClip"
              >
                <ChevronRight class="h-5 w-5" />
              </button>
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
                    Title
                  </Label>
                  <Input
                    id="clip-modal-title"
                    v-model="draftTitle"
                    placeholder="Untitled clip"
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
                    Cancel
                  </Button>
                  <Button size="sm" :disabled="saving" @click="saveEdit">
                    <Loader2
                      v-if="saving"
                      class="h-3.5 w-3.5 mr-1.5 animate-spin"
                    />
                    Save
                  </Button>
                </div>
              </div>
            </div>

            <div
              v-if="clipQueue.length > 1"
              class="flex flex-1 min-h-0 flex-col rounded-md border border-border/50 bg-card/30 [backdrop-filter:blur(6px)]"
            >
              <div
                class="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                <span class="inline-flex items-center gap-2">
                  <ListVideo class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
                  Other clips
                </span>
                <span class="tabular-nums">
                  {{ activeClipIndex + 1 }} / {{ clipQueue.length }}
                </span>
              </div>
              <div class="clip-queue-list min-h-0 flex-1 overflow-y-auto p-1.5">
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
                      {{ q.playerName ?? "Clip" }}
                    </span>
                    <span
                      class="block truncate font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      {{ q.title ?? "Untitled" }}
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
              v-if="clip.target?.name"
              :to="`/players/${clip.target.steam_id}`"
              class="group/target relative flex items-center gap-3 rounded-md border border-border/50 bg-[linear-gradient(135deg,hsl(var(--tac-amber)/0.08)_0%,hsl(var(--card)/0.4)_60%)] [backdrop-filter:blur(6px)] py-2.5 pl-2.5 pr-3 transition-all hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[linear-gradient(135deg,hsl(var(--tac-amber)/0.14)_0%,hsl(var(--card)/0.45)_60%)]"
              :title="`Open ${clip.target.name}'s profile`"
              @click="closeClip"
            >
              <span
                class="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)]"
              >
                <NuxtImg
                  v-if="targetAvatarSrc"
                  :src="targetAvatarSrc"
                  :alt="clip.target.name"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover/target:scale-110"
                />
                <span
                  v-else
                  class="font-sans text-base font-bold uppercase text-[hsl(var(--tac-amber))]"
                >
                  {{ clip.target.name.charAt(0) }}
                </span>
              </span>
              <span class="flex flex-col leading-tight min-w-0 flex-1">
                <span
                  class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground/80 group-hover/target:text-[hsl(var(--tac-amber))] transition-colors"
                >
                  Highlighting
                </span>
                <span
                  class="truncate text-base font-semibold text-foreground group-hover/target:text-[hsl(var(--tac-amber))] transition-colors"
                >
                  {{ clip.target.name }}
                </span>
                <span
                  v-if="targetTeamName"
                  class="mt-1 inline-flex max-w-full items-center gap-1.5 self-start rounded border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.1)] px-1.5 py-0.5 font-mono text-[0.56rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
                  :title="targetTeamName"
                >
                  <span
                    v-if="targetTeamAvatarSrc"
                    class="inline-flex h-4 w-4 shrink-0 overflow-hidden rounded-full border border-[hsl(var(--tac-amber)/0.35)]"
                  >
                    <NuxtImg
                      :src="targetTeamAvatarSrc"
                      :alt="targetTeamName"
                      class="h-full w-full object-cover"
                    />
                  </span>
                  <Shield v-else class="h-3 w-3 shrink-0" />
                  <span class="truncate">{{ targetTeamName }}</span>
                </span>
              </span>
              <ArrowUpRight
                class="h-4 w-4 shrink-0 text-muted-foreground/60 transition-all group-hover/target:text-[hsl(var(--tac-amber))] group-hover/target:translate-x-0.5 group-hover/target:-translate-y-0.5"
              />
            </NuxtLink>

            <ClipMatchSummary
              v-if="clip.match_map?.match"
              :clip="clip"
              @navigate="closeClip"
            />

            <dl
              class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm rounded-md border border-border/50 bg-card/30 [backdrop-filter:blur(6px)] px-4 py-3"
            >
              <dt
                class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground self-center"
              >
                Duration
              </dt>
              <dd class="text-right font-mono tabular-nums">
                {{ formatDuration(clip.duration_ms) }}
              </dd>

              <template v-if="formatBytes(fileSizeBytes)">
                <dt
                  class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground self-center"
                >
                  Size
                </dt>
                <dd class="text-right font-mono tabular-nums">
                  {{ formatBytes(fileSizeBytes) }}
                </dd>
              </template>

              <dt
                class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground self-center"
              >
                Created
              </dt>
              <dd class="text-right text-muted-foreground/90 text-xs">
                {{ formatDate(clip.created_at) }}
              </dd>
            </dl>

            <div class="grid grid-cols-2 gap-2">
              <a
                v-if="clip.download_url"
                :href="clipDownloadUrl(clip.download_url)"
                :download="downloadFilename"
                class="action-tile group"
              >
                <Download class="h-4 w-4" />
                <span>Download</span>
              </a>
              <button type="button" class="action-tile group" @click="copyLink">
                <Check v-if="linkCopied" class="h-4 w-4 text-emerald-400" />
                <Share2 v-else class="h-4 w-4" />
                <span>{{ linkCopied ? "Copied" : "Copy link" }}</span>
              </button>
              <button
                v-if="canDelete"
                type="button"
                class="action-tile action-tile--danger group col-span-2"
                @click="showDelete = true"
              >
                <Trash2 class="h-4 w-4" />
                <span>Delete clip</span>
              </button>
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
