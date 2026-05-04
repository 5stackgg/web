<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Film, Trash2, Download, Play, ListVideo } from "lucide-vue-next";
import { useNuxtApp } from "#app";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  generateMutation,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import { useAuthStore } from "~/stores/AuthStore";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import { clipDownloadName } from "~/utilities/clipDownloadName";
import RenderQueuePanel from "~/components/clips/RenderQueuePanel.vue";
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

// Streamer-rank+ curation surface — every clip across the platform.
// "Manage Highlights" in the UI; path is /manage-highlights. The streamer middleware
// passes for streamer / match_organizer / tournament_organizer /
// administrator, matching the LeftNav gate. Hasura's per-role row
// permissions still apply on top, so what each role actually sees
// in the grid is gated server-side too.
definePageMeta({
  middleware: "streamer",
});

const auth = useAuthStore();
// Holding nuxtApp instead of destructuring `$apollo`: vue-apollo's
// global `beforeCreate` mixin does `this.$apollo = ...`, and a
// `<script setup>` binding called `$apollo` would be read-only on the
// component proxy, making that mixin throw on mount.
const nuxtApp = useNuxtApp();

type Clip = {
  id: string;
  title: string | null;
  duration_ms: number | null;
  download_url: string | null;
  thumbnail_url: string | null;
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

const clips = ref<Clip[]>([]);
const loading = ref(true);

let activeSub: { unsubscribe: () => void } | null = null;

function subscribe() {
  activeSub?.unsubscribe();
  const me = auth.me;
  if (!me?.steam_id) {
    clips.value = [];
    loading.value = false;
    return;
  }
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      // Admin row-permission on match_clips returns every row, so we
      // drop the previous user_steam_id filter and surface the whole
      // platform's clips here. Limit caps the live grid; future
      // pagination / filters can extend.
      match_clips: [
        {
          order_by: [{ created_at: "desc" }],
          limit: 200,
        } as any,
        matchClipFields,
      ],
    } as any),
  });
  activeSub = obs.subscribe({
    next: ({ data }: any) => {
      clips.value = data?.match_clips ?? [];
      loading.value = false;
    },
    error: (err: any) => {
      console.error("[clips] subscription error:", err);
      loading.value = false;
    },
  });
}

watch(() => auth.me?.steam_id, () => subscribe(), { immediate: true });
onBeforeUnmount(() => {
  activeSub?.unsubscribe();
  activeSub = null;
});

const pendingDeleteId = ref<string | null>(null);
const deleting = ref(false);
async function confirmDelete() {
  const id = pendingDeleteId.value;
  if (!id || deleting.value) return;
  deleting.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        deleteClip: [
          { clip_id: id },
          { success: true },
        ],
      } as any),
    });
    // Subscription will repopulate; remove optimistically too so the
    // card disappears immediately instead of waiting for the round-trip.
    clips.value = clips.value.filter((c) => c.id !== id);
  } catch (e) {
    console.error("[clips] delete failed:", e);
  } finally {
    deleting.value = false;
    pendingDeleteId.value = null;
  }
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function matchupLabel(c: Clip): string {
  const a = c.match_map?.match?.lineup_1?.name;
  const b = c.match_map?.match?.lineup_2?.name;
  if (a && b) return `${a} vs ${b}`;
  return c.match_map?.map?.name ?? "Demo clip";
}

const isEmpty = computed(() => !loading.value && clips.value.length === 0);
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #title>Manage Highlights</template>
    </TacticalPageHeader>
  </PageTransition>

  <!-- Compact summary of the active render parent. Full queue +
       history lives at /manage-highlights/queue. The panel hides itself
       when nothing's in flight, so this shrinks to nothing on quiet
       days. The "View queue" link is visible when there IS an
       active batch — it's the gateway into the dedicated page. -->
  <PageTransition :delay="50" class="mt-6">
    <div class="space-y-2">
      <RenderQueuePanel compact />
      <div>
        <Button variant="ghost" size="sm" as-child>
          <NuxtLink to="/manage-highlights/queue" class="text-xs">
            <ListVideo class="h-3.5 w-3.5 mr-1.5" />
            View full render queue
          </NuxtLink>
        </Button>
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Skeleton v-for="i in 6" :key="i" class="aspect-video w-full rounded-lg" />
    </div>

    <Empty v-else-if="isEmpty">
      <Film class="h-10 w-10 text-muted-foreground" />
      <EmptyTitle>No clips yet</EmptyTitle>
      <EmptyDescription>
        Watch a finished match's demo and click "Create clip" in the
        playback controls to render your first clip.
      </EmptyDescription>
    </Empty>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Card has NO click handler. The previous "make the whole
           card clickable" pattern fought every action button inside
           it — even @click.stop.prevent on the trash button wasn't
           reliably preventing the parent click on every browser /
           component-library combo, so the delete dialog never
           opened. New layout: the thumbnail and the title-block are
           each their own NuxtLink to the clip detail; action buttons
           are siblings, not children of any clickable element. No
           bubble-stopping gymnastics needed. -->
      <Card
        v-for="c in clips"
        :key="c.id"
        class="overflow-hidden group transition-all hover:border-[hsl(var(--tac-amber)/0.6)] hover:shadow-md"
      >
        <NuxtLink
          :to="`/clips/${c.id}`"
          class="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div class="relative aspect-video bg-black overflow-hidden cursor-pointer">
            <NuxtImg
              v-if="c.match_map?.map?.poster"
              :src="c.match_map.map.poster"
              class="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform group-hover:scale-105"
              :alt="c.match_map?.map?.label ?? c.match_map?.map?.name ?? ''"
            />
            <div
              v-else
              class="absolute inset-0 flex items-center justify-center text-muted-foreground"
            >
              <Film class="h-10 w-10 opacity-30" />
            </div>
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Play class="h-12 w-12 text-white drop-shadow-lg" :stroke-width="2.5" />
            </div>
            <span
              class="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[0.65rem] font-mono tabular-nums text-white"
            >
              {{ formatDuration(c.duration_ms) }}
            </span>
          </div>
        </NuxtLink>
        <CardContent class="p-3 space-y-2">
          <NuxtLink
            :to="`/clips/${c.id}`"
            class="block min-w-0 hover:text-foreground/90"
          >
            <div class="truncate font-medium">
              {{ c.title || "Untitled clip" }}
            </div>
            <span class="block truncate text-xs text-muted-foreground">
              {{ matchupLabel(c) }}
            </span>
          </NuxtLink>
          <div class="flex items-center justify-end gap-1">
            <Button v-if="c.download_url" size="icon" variant="ghost" as-child>
              <a
                :href="`${c.download_url}&dl=1`"
                :download="clipDownloadName(c)"
                :title="`Download ${c.title ?? 'clip'}`"
              >
                <Download class="h-4 w-4" />
              </a>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              :title="`Delete ${c.title ?? 'clip'}`"
              @click="pendingDeleteId = c.id"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </PageTransition>

  <AlertDialog
    :open="pendingDeleteId !== null"
    @update:open="(v) => { if (!v) pendingDeleteId = null; }"
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
