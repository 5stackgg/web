<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
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
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  generateMutation,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
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
import { clipDownloadName } from "~/utilities/clipDownloadName";
import { useClipModal } from "~/composables/useClipModal";

// Broadcast-feed playback window. Subscribes by id so we react to
// edits / deletes / render completion without remounting. Closing
// pops the `?clip` query param via useClipModal — back/forward
// natively traverses recently-viewed clips.

const props = defineProps<{
  clipId: string | null;
}>();

const auth = useAuthStore();
const nuxtApp = useNuxtApp();
const { closeClip } = useClipModal();

const clip = ref<Clip | null>(null);
const loading = ref(false);
const notFound = ref(false);
const showDelete = ref(false);
const linkCopied = ref(false);

const isOwner = computed(
  () => !!clip.value && clip.value.user_steam_id === auth.me?.steam_id,
);

const editing = ref(false);
const draftTitle = ref("");
const saving = ref(false);
const editError = ref<string | null>(null);

// Inline visibility switcher (no edit-mode required). Owners + admins
// can flip the chip in the header strip; everyone else sees it as a
// read-only status indicator.
type Visibility = "private" | "unlisted" | "public";
const VISIBILITY_OPTIONS: Array<{
  value: Visibility;
  label: string;
  icon: any;
  hint: string;
}> = [
  { value: "public", label: "Public", icon: Globe, hint: "Visible in the highlights feed" },
  { value: "unlisted", label: "Unlisted", icon: Eye, hint: "Anyone with the link" },
  { value: "private", label: "Private", icon: Lock, hint: "Only the owner" },
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

// Clip mp4 size — schema doesn't track it, so we discover it via a
// HEAD on the download URL. Cloudflare returns Content-Length cheaply
// without serving the bytes. Failures (CORS, expired URL, network)
// fall through silently — the row in the meta block just hides.
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
    // Swallow — best-effort indicator, not load-bearing.
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
  loading.value = true;
  notFound.value = false;
  clip.value = null;
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        { where: { id: { _eq: id } }, limit: 1 } as any,
        matchClipFields,
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

// Re-probe size whenever the download URL changes — usually fires
// once when the subscription delivers, but covers the rare case of a
// re-upload mid-view.
watch(
  () => clip.value?.download_url ?? null,
  (url) => {
    if (url) void fetchFileSize(url);
  },
);
onBeforeUnmount(() => {
  activeSub?.unsubscribe();
  activeSub = null;
});

const open = computed(() => !!props.clipId);

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
    // Title-only update — visibility is owned by the inline chip and
    // shouldn't get rewritten by a stale snapshot taken at edit-mode
    // entry. Sending only the title here also lets the chip and the
    // edit form be used in any order without stomping each other.
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
  if (!clip.value?.download_url) return;
  try {
    await navigator.clipboard.writeText(clip.value.download_url);
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

const matchupLabel = computed(() => {
  const a = clip.value?.match_map?.match?.lineup_1?.name;
  const b = clip.value?.match_map?.match?.lineup_2?.name;
  if (a && b) return `${a} vs ${b}`;
  return (
    clip.value?.match_map?.map?.label ??
    clip.value?.match_map?.map?.name ??
    null
  );
});

const downloadFilename = computed<string>(() =>
  clip.value ? clipDownloadName(clip.value) : "clip.mp4",
);
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
          <DialogDescription>
            Highlight clip viewer
          </DialogDescription>
        </VisuallyHidden>

        <!-- Four-corner brackets — extend the tactical page-header
             corner motif so the modal reads as a focused field of
             that same system, not a generic radix dialog. -->
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

        <!-- Top transmission strip: source label + close. Mirrors the
             broadcast lower-third style used elsewhere in the app. -->
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

          <!-- Inline visibility switcher. Owner/admin: clickable
               popover with the three options; everyone else sees a
               read-only status chip. Sits in the header strip so the
               state is always visible without entering edit mode. -->
          <Popover v-if="clip && canEditVisibility" v-model:open="visPopoverOpen">
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
                <Lock v-else-if="clip.visibility === 'private'" class="h-3 w-3" />
                <Eye v-else-if="clip.visibility === 'unlisted'" class="h-3 w-3" />
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
                  <span class="block text-[0.7rem] text-muted-foreground leading-snug">
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

          <button
            type="button"
            class="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))] transition-colors cursor-pointer"
            @click="closeClip"
          >
            <X class="h-3 w-3" />
            Close
          </button>
        </div>

        <!-- Loading skeleton -->
        <div
          v-if="loading || (!clip && !notFound)"
          class="grid gap-4 p-4 sm:p-5 lg:grid-cols-[2fr_1fr]"
        >
          <div class="aspect-video w-full rounded-md bg-muted/30 animate-pulse"></div>
          <div class="space-y-3">
            <div class="h-7 w-3/4 rounded bg-muted/30 animate-pulse"></div>
            <div class="h-4 w-1/2 rounded bg-muted/30 animate-pulse"></div>
            <div class="h-32 rounded bg-muted/20 animate-pulse"></div>
          </div>
        </div>

        <!-- Not found -->
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

        <!-- Body -->
        <div
          v-else-if="clip"
          class="grid gap-4 sm:gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] flex-1 min-h-0"
        >
          <!-- LEFT: Player + caption strip -->
          <div class="flex flex-col gap-3 min-w-0">
            <div
              class="relative aspect-video w-full overflow-hidden rounded-md bg-black border border-border/60"
            >
              <video
                v-if="clip.download_url"
                :src="clip.download_url"
                :poster="clip.thumbnail_url ?? clip.match_map?.map?.poster ?? undefined"
                class="absolute inset-0 h-full w-full object-contain"
                controls
                autoplay
                muted
                playsinline
                preload="auto"
              />
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center text-muted-foreground"
              >
                <Loader2 class="h-6 w-6 animate-spin" />
                <span class="ml-3 text-sm font-mono uppercase tracking-[0.18em]">
                  Render finalizing…
                </span>
              </div>

              <!-- Subtle scanline veneer over the player. CSS-only,
                   no extra layers. Pointer-events-none so it doesn't
                   eat clicks on the native video controls. -->
              <div class="clip-scanlines pointer-events-none absolute inset-0"></div>
            </div>

            <!-- Caption strip — broadcast lower-third style. Holds
                 title + matchup + edit affordance. -->
            <div
              class="relative rounded-md border border-border/50 bg-[linear-gradient(180deg,hsl(var(--card)/0.55)_0%,hsl(var(--card)/0.25)_100%)] [backdrop-filter:blur(6px)] px-4 py-3"
            >
              <span
                aria-hidden="true"
                class="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-[hsl(var(--tac-amber))] via-[hsl(var(--tac-amber)/0.6)] to-transparent"
              ></span>

              <div v-if="!editing" class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                  <h2
                    class="relative text-xl sm:text-2xl font-bold uppercase leading-tight tracking-[0.01em] [font-stretch:85%]"
                  >
                    <span
                      aria-hidden="true"
                      class="pointer-events-none absolute left-[3px] top-[3px] select-none whitespace-nowrap text-transparent [-webkit-text-stroke:1px_hsl(var(--tac-amber)/0.3)]"
                    >
                      {{ clip.title || "Untitled clip" }}
                    </span>
                    <span
                      class="relative bg-[linear-gradient(180deg,hsl(var(--foreground))_0%,hsl(var(--foreground)/0.7)_100%)] bg-clip-text text-transparent"
                    >
                      {{ clip.title || "Untitled clip" }}
                    </span>
                  </h2>
                  <p v-if="matchupLabel" class="mt-1 text-sm text-muted-foreground">
                    {{ matchupLabel }}
                    <span
                      v-if="clip.target?.name"
                      class="ml-1 text-muted-foreground/70"
                    >
                      · highlighting
                      <NuxtLink
                        :to="`/players/${clip.target.steam_id}`"
                        class="text-foreground/90 hover:text-[hsl(var(--tac-amber))] transition-colors"
                      >
                        {{ clip.target.name }}
                      </NuxtLink>
                    </span>
                  </p>
                </div>
                <button
                  v-if="isOwner"
                  type="button"
                  class="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer"
                  title="Edit title"
                  @click="startEdit"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </button>
              </div>

              <!-- Edit form: title only. Visibility moved to the
                   inline chip in the header strip — clicking it
                   switches in place without entering edit mode, so
                   the form stays narrow and keeps focus on the title
                   change. -->
              <div v-else class="space-y-3">
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
                    <Loader2 v-if="saving" class="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT: Match summary + meta + actions. On lg+ this is a
               sidebar; below lg it stacks. -->
          <aside class="flex flex-col gap-3 min-w-0">
            <ClipMatchSummary v-if="clip.match_map?.match" :clip="clip" />

            <!-- Meta block — broadcast-style data row, no card.
                 Visibility lives in the header chip now (always
                 visible, switchable for owner/admin without entering
                 edit mode), so we don't repeat it here. -->
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

              <template v-if="clip.user?.name">
                <dt
                  class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground self-center"
                >
                  Author
                </dt>
                <dd class="text-right truncate">
                  <NuxtLink
                    :to="`/players/${clip.user.steam_id}`"
                    class="hover:text-[hsl(var(--tac-amber))] transition-colors"
                  >
                    {{ clip.user.name }}
                  </NuxtLink>
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

            <!-- Action tile row — broadcast switcher style. Each tile
                 is a hard button with a corner tick + uppercase label. -->
            <div class="grid grid-cols-2 gap-2">
              <a
                v-if="clip.download_url"
                :href="`${clip.download_url}&dl=1`"
                :download="downloadFilename"
                class="action-tile group"
              >
                <Download class="h-4 w-4" />
                <span>Download</span>
              </a>
              <button
                v-if="clip.download_url"
                type="button"
                class="action-tile group"
                @click="copyLink"
              >
                <Check
                  v-if="linkCopied"
                  class="h-4 w-4 text-emerald-400"
                />
                <Share2 v-else class="h-4 w-4" />
                <span>{{ linkCopied ? "Copied" : "Copy link" }}</span>
              </button>
              <button
                v-if="isOwner"
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
/* Scanline veneer on the player. Two stacked linear-gradients (one
   horizontal scan + one vertical chroma fringe) at low opacity; reads
   as broadcast-CRT character without obscuring the video. The
   transform: translateZ(0) hint lets the GPU compose the layer. */
.clip-scanlines {
  background-image: repeating-linear-gradient(
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

/* Action tile — broadcast switcher button. Hard edge, mono label,
   amber affordance on hover/focus. The corner tick is a tiny notch
   at top-right that mirrors the page-header corner brackets but at a
   smaller scale, anchoring the tile in the same visual system. */
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
</style>
