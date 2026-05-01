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
} from "lucide-vue-next";
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
  title: string | null;
  duration_ms: number | null;
  download_url: string | null;
  thumbnail_url: string | null;
  visibility: string;
  created_at: string;
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
        <div>
          <h1 class="text-2xl font-semibold leading-tight">
            {{ clip.title || "Untitled clip" }}
          </h1>
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
              <span class="capitalize">{{ clip.visibility }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Created</span>
              <span>{{ formatDate(clip.created_at) }}</span>
            </div>
          </CardContent>
        </Card>

        <div class="flex flex-wrap gap-2">
          <Button v-if="clip.download_url" as-child class="flex-1 min-w-[8rem]">
            <!-- &dl=1 (not ?) — download_url already carries
                 ?file=<key>, so a second ? would mash `dl=1` into the
                 file value and Backblaze would 404. -->
            <a :href="`${clip.download_url}&dl=1`" download>
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
