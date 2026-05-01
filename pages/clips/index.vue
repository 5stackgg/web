<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Film, Trash2, Download, Loader2 } from "lucide-vue-next";
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

const auth = useAuthStore();
const { $apollo } = useNuxtApp();

type Clip = {
  id: string;
  title: string | null;
  duration_ms: number | null;
  s3_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  match_map?: {
    id: string;
    map?: { name: string; thumbnail: string | null } | null;
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
      // Cast: match_clips not in zeus until the schema migration runs.
      match_clips: [
        {
          where: { user_steam_id: { _eq: me.steam_id } },
          order_by: [{ created_at: "desc" }],
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
    await $apollo.defaultClient.mutate({
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
      <template #title>My Clips</template>
    </TacticalPageHeader>
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
      <Card v-for="c in clips" :key="c.id" class="overflow-hidden">
        <div class="relative aspect-video bg-black">
          <video
            v-if="c.s3_url"
            :src="c.s3_url"
            :poster="c.thumbnail_url ?? undefined"
            class="absolute inset-0 h-full w-full object-contain"
            controls
            preload="metadata"
          />
          <div
            v-else
            class="absolute inset-0 flex items-center justify-center text-muted-foreground"
          >
            <Loader2 class="h-6 w-6 animate-spin" />
          </div>
          <span
            class="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-mono tabular-nums text-white"
          >
            {{ formatDuration(c.duration_ms) }}
          </span>
        </div>
        <CardContent class="p-3 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">
                {{ c.title || "Untitled clip" }}
              </div>
              <NuxtLink
                v-if="c.match_map?.match?.id"
                :to="`/matches/${c.match_map.match.id}`"
                class="block truncate text-xs text-muted-foreground hover:text-foreground"
              >
                {{ matchupLabel(c) }}
              </NuxtLink>
              <span v-else class="block truncate text-xs text-muted-foreground">
                {{ matchupLabel(c) }}
              </span>
            </div>
          </div>
          <div class="flex items-center justify-end gap-1">
            <Button v-if="c.s3_url" size="icon" variant="ghost" as-child>
              <a :href="c.s3_url" download :title="`Download ${c.title ?? 'clip'}`">
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
