<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  ArrowLeft,
  Download,
  Film,
  Loader2,
  Trash2,
  Share2,
  Check,
  Pencil,
  Eye,
  Lock,
  Globe,
} from "lucide-vue-next";
import { useAuthStore } from "~/stores/AuthStore";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNuxtApp } from "#app";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  generateMutation,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { clipDownloadName } from "~/utilities/clipDownloadName";

// Single-clip viewer. Big player up top, metadata + actions sidebar
// next to it on wide screens, stacks under on mobile. Subscribes to the
// match_clips row by id so a still-rendering clip auto-fills its download_url
// when the upload completes (rare here since the user only navigates
// from the library after `done`, but cheap to support).
const route = useRoute();
const router = useRouter();
const nuxtApp = useNuxtApp();

type Clip = {
  id: string;
  user_steam_id: string;
  target_steam_id: string | null;
  title: string | null;
  duration_ms: number | null;
  download_url: string | null;
  thumbnail_url: string | null;
  visibility: string;
  created_at: string;
  user?: { steam_id: string; name: string; avatar_url: string | null } | null;
  target?: { steam_id: string; name: string; avatar_url: string | null } | null;
  match_map?: {
    id: string;
    map?: {
      name: string;
      poster: string | null;
      label: string | null;
    } | null;
    match?: {
      id: string;
      lineup_1?: { name: string } | null;
      lineup_2?: { name: string } | null;
    } | null;
  } | null;
};

const clip = ref<Clip | null>(null);
const loading = ref(true);
const notFound = ref(false);
const showDelete = ref(false);
const deleting = ref(false);
const linkCopied = ref(false);

// Edit-mode state. Only owners see the affordance; others see the
// readonly inspector. We snapshot title + visibility into draftTitle
// / draftVisibility on enter, write back on save, discard on cancel.
const auth = useAuthStore();
const isOwner = computed(
  () => !!clip.value && clip.value.user_steam_id === auth.me?.steam_id,
);
const editing = ref(false);
const draftTitle = ref("");
const draftVisibility = ref<"private" | "unlisted" | "match" | "public">(
  "private",
);
const saving = ref(false);
const editError = ref<string | null>(null);

function startEdit() {
  if (!clip.value) return;
  draftTitle.value = clip.value.title ?? "";
  draftVisibility.value = (clip.value.visibility as any) ?? "private";
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
    await nuxtApp.$apollo.defaultClient.mutate({
      // Cast: updateClip is gated behind the latest hasura metadata
      // apply; zeus types lag until codegen runs.
      mutation: generateMutation({
        updateClip: [
          {
            clip_id: clip.value.id,
            title: draftTitle.value.trim(),
            visibility: draftVisibility.value,
          },
          { success: true },
        ],
      } as any),
    });
    editing.value = false;
    // Subscription will deliver the updated row — no manual refetch.
  } catch (e) {
    editError.value =
      (e as any)?.graphQLErrors?.[0]?.message ??
      (e as Error)?.message ??
      "Failed to update clip";
  } finally {
    saving.value = false;
  }
}

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe(id: string) {
  activeSub?.unsubscribe();
  loading.value = true;
  notFound.value = false;
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
      console.error("[clip] subscription error:", err);
      loading.value = false;
    },
  });
}

watch(
  () => route.params.id,
  (id) => {
    if (typeof id === "string" && id.length > 0) subscribe(id);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  activeSub?.unsubscribe();
  activeSub = null;
});

async function confirmDelete() {
  if (!clip.value || deleting.value) return;
  deleting.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        deleteClip: [
          { clip_id: clip.value.id },
          { success: true },
        ],
      } as any),
    });
    showDelete.value = false;
    router.replace("/clips");
  } catch (e) {
    console.error("[clip] delete failed:", e);
  } finally {
    deleting.value = false;
  }
}

async function copyLink() {
  if (!clip.value?.download_url) return;
  try {
    await navigator.clipboard.writeText(clip.value.download_url);
    linkCopied.value = true;
    setTimeout(() => (linkCopied.value = false), 1500);
  } catch (e) {
    console.error("[clip] copy failed:", e);
  }
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
  return clip.value?.match_map?.map?.label ?? clip.value?.match_map?.map?.name ?? null;
});

const downloadFilename = computed<string>(() => {
  return clip.value
    ? clipDownloadName(clip.value)
    : "clip.mp4";
});

const mapLabel = computed(
  () => clip.value?.match_map?.map?.label ?? clip.value?.match_map?.map?.name ?? null,
);
</script>

<template>
  <PageTransition>
    <div class="mb-4 flex items-center gap-2">
      <Button variant="ghost" size="sm" as-child>
        <NuxtLink to="/clips" class="flex items-center gap-2">
          <ArrowLeft class="h-4 w-4" />
          My Clips
        </NuxtLink>
      </Button>
    </div>
  </PageTransition>

  <PageTransition v-if="loading" :delay="80">
    <div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Skeleton class="aspect-video w-full rounded-lg" />
      <div class="space-y-3">
        <Skeleton class="h-6 w-3/4" />
        <Skeleton class="h-4 w-1/2" />
        <Skeleton class="h-10 w-full" />
      </div>
    </div>
  </PageTransition>

  <PageTransition v-else-if="notFound" :delay="80">
    <div class="flex flex-col items-center gap-3 py-16 text-center">
      <Film class="h-10 w-10 text-muted-foreground" />
      <h2 class="text-lg font-medium">Clip not found</h2>
      <p class="text-sm text-muted-foreground">
        It may have been deleted or doesn't belong to you.
      </p>
      <Button as-child variant="outline">
        <NuxtLink to="/clips">Back to my clips</NuxtLink>
      </Button>
    </div>
  </PageTransition>

  <PageTransition v-else-if="clip" :delay="80">
    <div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <!-- Player. autoplay because the user explicitly clicked into a
           single clip — a stalled <video> with a play button to find
           is worse UX here than on the library grid. muted is required
           by browser autoplay policies; the controls reveal an unmute
           button. -->
      <div class="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
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
          <span class="ml-3 text-sm">Render still finalizing…</span>
        </div>
      </div>

      <!-- Inspector — title, source match, actions. -->
      <div class="space-y-4">
        <div v-if="!editing">
          <div class="flex items-start justify-between gap-2">
            <h1 class="text-2xl font-semibold leading-tight">
              {{ clip.title || "Untitled clip" }}
            </h1>
            <Button
              v-if="isOwner"
              variant="ghost"
              size="icon"
              class="h-8 w-8 shrink-0"
              title="Edit title and visibility"
              @click="startEdit"
            >
              <Pencil class="h-4 w-4" />
            </Button>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            <NuxtLink
              v-if="clip.match_map?.match?.id && matchupLabel"
              :to="`/matches/${clip.match_map.match.id}`"
              class="hover:text-foreground"
            >
              {{ matchupLabel }}
            </NuxtLink>
            <span v-else-if="matchupLabel">{{ matchupLabel }}</span>
          </p>
          <p
            v-if="clip.target?.name"
            class="mt-1 text-xs text-muted-foreground"
          >
            Highlighting
            <NuxtLink
              :to="`/players/${clip.target.steam_id}`"
              class="text-foreground hover:underline"
            >
              {{ clip.target.name }}
            </NuxtLink>
          </p>
        </div>

        <!-- Owner-only edit form. Inline above the metadata card so
             the contextual placement reads as "you're editing the
             title above, here's where it goes". -->
        <div v-else class="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
          <div class="space-y-1">
            <Label for="clip-edit-title">Title</Label>
            <Input
              id="clip-edit-title"
              v-model="draftTitle"
              placeholder="Untitled clip"
              maxlength="120"
              :disabled="saving"
            />
          </div>
          <div class="space-y-1">
            <Label>Visibility</Label>
            <Select v-model="draftVisibility" :disabled="saving">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <span class="inline-flex items-center gap-2">
                    <Lock class="h-3.5 w-3.5" />
                    Private — only you
                  </span>
                </SelectItem>
                <SelectItem value="unlisted">
                  <span class="inline-flex items-center gap-2">
                    <Eye class="h-3.5 w-3.5" />
                    Unlisted — anyone with the link
                  </span>
                </SelectItem>
                <SelectItem value="public">
                  <span class="inline-flex items-center gap-2">
                    <Globe class="h-3.5 w-3.5" />
                    Public — show in highlights feed
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p
            v-if="editError"
            class="text-xs text-destructive"
          >
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
            <Button
              size="sm"
              :disabled="saving"
              @click="saveEdit"
            >
              <Loader2 v-if="saving" class="h-4 w-4 mr-2 animate-spin" />
              Save
            </Button>
          </div>
        </div>

        <Card>
          <CardContent class="p-4 space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Duration</span>
              <span class="font-mono tabular-nums">
                {{ formatDuration(clip.duration_ms) }}
              </span>
            </div>
            <div v-if="mapLabel" class="flex items-center justify-between">
              <span class="text-muted-foreground">Map</span>
              <span>{{ mapLabel }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Visibility</span>
              <span class="inline-flex items-center gap-1.5 capitalize">
                <Lock
                  v-if="clip.visibility === 'private'"
                  class="h-3 w-3 text-muted-foreground"
                />
                <Eye
                  v-else-if="clip.visibility === 'unlisted'"
                  class="h-3 w-3 text-muted-foreground"
                />
                <Globe
                  v-else-if="clip.visibility === 'public'"
                  class="h-3 w-3 text-emerald-400"
                />
                {{ clip.visibility }}
              </span>
            </div>
            <div
              v-if="clip.user?.name"
              class="flex items-center justify-between"
            >
              <span class="text-muted-foreground">Created by</span>
              <NuxtLink
                :to="`/players/${clip.user.steam_id}`"
                class="hover:text-foreground"
              >
                {{ clip.user.name }}
              </NuxtLink>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Created</span>
              <span>{{ formatDate(clip.created_at) }}</span>
            </div>
          </CardContent>
        </Card>

        <div class="flex flex-wrap gap-2">
          <Button v-if="clip.download_url" as-child class="flex-1 min-w-[8rem]">
            <!-- `&dl=1` (not `?`) because download_url already carries
                 a query string. Explicit `:download="downloadFilename"`
                 (not just `download`) forces the browser to use the
                 friendly filename even when Chromium would otherwise
                 fall back to the URL path's UUID basename. -->
            <a
              :href="`${clip.download_url}&dl=1`"
              :download="downloadFilename"
            >
              <Download class="h-4 w-4 mr-2" />
              Download
            </a>
          </Button>
          <Button
            v-if="clip.download_url"
            variant="outline"
            class="flex-1 min-w-[8rem]"
            @click="copyLink"
          >
            <Check v-if="linkCopied" class="h-4 w-4 mr-2 text-emerald-400" />
            <Share2 v-else class="h-4 w-4 mr-2" />
            {{ linkCopied ? "Copied" : "Copy link" }}
          </Button>
          <Button
            v-if="isOwner"
            variant="outline"
            class="text-destructive hover:text-destructive"
            @click="showDelete = true"
          >
            <Trash2 class="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  </PageTransition>

  <AlertDialog
    :open="showDelete"
    @update:open="(v) => { if (!v) showDelete = false; }"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this clip?</AlertDialogTitle>
        <AlertDialogDescription>
          The clip is removed from your library and the underlying file is
          deleted. This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
        <AlertDialogAction :disabled="deleting" @click="confirmDelete">
          {{ deleting ? "Deleting…" : "Delete" }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
