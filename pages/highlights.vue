<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  Film,
  Loader2,
  Lock,
  Eye,
  Globe,
  Clapperboard,
  ListVideo,
  Trash2,
  Download,
  ArrowUpRight,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  generateMutation,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "~/components/ui/sheet";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import RenderQueuePanel from "~/components/clips/RenderQueuePanel.vue";
import DeleteClipDialog from "~/components/clips/DeleteClipDialog.vue";
import { clipDownloadName } from "~/utilities/clipDownloadName";
import type { Clip } from "~/types/clip";
import {
  tacticalFilterPillClasses,
  tacticalFilterPillActiveClasses,
} from "~/utilities/tacticalClasses";

// Single Highlights surface for everyone. Hasura row-level permissions
// gate which clips each role sees. Curators (streamer+) get extra
// affordances: visibility filters (admin only), per-card visibility
// toggles (admin only), delete, and a slide-in render queue.
definePageMeta({
  middleware: "highlights",
});

type Visibility = "public" | "private" | "unlisted";
type Filter = "all" | Visibility;

const nuxtApp = useNuxtApp();
const auth = useAuthStore();
const isAdmin = computed(() => auth.isAdmin);
const canCurate = computed(
  () =>
    auth.isAdmin ||
    auth.isStreamer ||
    auth.isMatchOrganizer ||
    auth.isTournamentOrganizer,
);

const clips = ref<Clip[]>([]);
const loading = ref(true);
const activeClipId = ref<string | null>(null);
const visibilityFilter = ref<Filter>("all");
const saving = ref<Record<string, boolean>>({});
const queueOpen = ref(false);

const pendingDeleteId = ref<string | null>(null);
const pendingDeleteTitle = ref<string | null>(null);
const deleteDialogOpen = ref(false);

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  // Admins can browse every visibility; everyone else relies on Hasura
  // row permissions (which already trim non-admins to public/unlisted).
  const where = isAdmin.value ? {} : { visibility: { _eq: "public" } };
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        {
          where,
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
      console.error("[highlights] subscription error:", err);
      loading.value = false;
    },
  });
}
subscribe();
onBeforeUnmount(() => activeSub?.unsubscribe());

const counts = computed(() => {
  const byVis: Record<Filter, number> = {
    all: clips.value.length,
    public: 0,
    private: 0,
    unlisted: 0,
  };
  for (const c of clips.value) byVis[c.visibility] = (byVis[c.visibility] ?? 0) + 1;
  return byVis;
});

const filteredClips = computed(() => {
  if (!isAdmin.value) return clips.value;
  if (visibilityFilter.value === "all") return clips.value;
  return clips.value.filter((c) => c.visibility === visibilityFilter.value);
});

const hasClips = computed(() => filteredClips.value.length > 0);

const adminFilters: Array<{ value: Filter; label: string; icon?: any }> = [
  { value: "all", label: "All" },
  { value: "public", label: "Public", icon: Globe },
  { value: "unlisted", label: "Unlisted", icon: Eye },
  { value: "private", label: "Private", icon: Lock },
];

async function setVisibility(clip: Clip, visibility: Visibility) {
  if (saving.value[clip.id] || clip.visibility === visibility) return;
  saving.value = { ...saving.value, [clip.id]: true };
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        updateClip: [
          { clip_id: clip.id, visibility },
          { success: true },
        ],
      } as any),
    });
  } catch (e) {
    console.error("[highlights] visibility toggle failed:", e);
  } finally {
    saving.value = { ...saving.value, [clip.id]: false };
  }
}

function askDelete(c: Clip) {
  pendingDeleteId.value = c.id;
  pendingDeleteTitle.value = c.title;
  deleteDialogOpen.value = true;
}
function onDeleted(id: string) {
  clips.value = clips.value.filter((c) => c.id !== id);
}
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>
        <Film class="h-3.5 w-3.5" />
        Community Reel
      </template>
      <template #title>Highlights</template>
      <template #actions>
        <div class="flex items-center gap-3">
          <div
            class="hidden sm:flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Clapperboard class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
            <span>
              <span class="text-foreground font-semibold">{{ counts.all }}</span>
              {{ counts.all === 1 ? "clip" : "clips" }}
            </span>
            <template v-if="isAdmin">
              <span class="text-border">·</span>
              <span>{{ counts.public }} public</span>
            </template>
          </div>
          <Sheet v-if="canCurate" v-model:open="queueOpen">
            <SheetTrigger as-child>
              <Button variant="outline" size="sm">
                <ListVideo class="h-3.5 w-3.5 mr-1.5" />
                Queue
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              class="w-full sm:max-w-xl overflow-y-auto"
            >
              <SheetHeader>
                <SheetTitle class="flex items-center gap-2">
                  <ListVideo class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
                  Render Queue
                </SheetTitle>
                <SheetDescription>
                  Active and recently-finished render batches across the platform.
                </SheetDescription>
              </SheetHeader>
              <div class="mt-6">
                <RenderQueuePanel />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition v-if="isAdmin" :delay="60" class="mt-4">
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="opt in adminFilters"
        :key="opt.value"
        type="button"
        :class="[
          tacticalFilterPillClasses,
          visibilityFilter === opt.value && tacticalFilterPillActiveClasses,
        ]"
        @click="visibilityFilter = opt.value"
      >
        <component :is="opt.icon" v-if="opt.icon" class="h-3 w-3" />
        <span>{{ opt.label }}</span>
        <span class="font-mono tabular-nums opacity-70">
          {{ counts[opt.value] }}
        </span>
      </button>
    </div>
  </PageTransition>

  <PageTransition v-if="loading" :delay="80" class="mt-6">
    <div
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <Skeleton v-for="i in 8" :key="i" class="aspect-video w-full rounded-lg" />
    </div>
  </PageTransition>

  <PageTransition v-else-if="!hasClips" :delay="80" class="mt-6">
    <Empty>
      <EmptyTitle>No clips here yet</EmptyTitle>
      <EmptyDescription>
        {{
          isAdmin
            ? "Try a different filter — or wait for new clips to render."
            : "Public clips will appear here as they're rendered. Check back soon."
        }}
      </EmptyDescription>
    </Empty>
  </PageTransition>

  <PageTransition v-else :delay="80" class="mt-6">
    <div
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <div v-for="c in filteredClips" :key="c.id" class="space-y-2">
        <HighlightCard
          :clip="c"
          :active="activeClipId === c.id"
          @activate="activeClipId = c.id"
        />

        <!-- Admin visibility row -->
        <div
          v-if="isAdmin"
          class="flex items-stretch gap-1 rounded-md border border-border/50 bg-card/40 p-1 [backdrop-filter:blur(6px)]"
        >
          <button
            v-for="opt in [
              { value: 'private', icon: Lock, label: 'Private' },
              { value: 'unlisted', icon: Eye, label: 'Unlisted' },
              { value: 'public', icon: Globe, label: 'Public' },
            ]"
            :key="opt.value"
            type="button"
            :title="`Set ${opt.label.toLowerCase()}`"
            class="group relative flex-1 inline-flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition-colors duration-150 disabled:cursor-not-allowed"
            :class="
              c.visibility === opt.value
                ? 'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))] border border-[hsl(var(--tac-amber)/0.4)]'
                : 'border border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground'
            "
            :disabled="saving[c.id] || c.visibility === opt.value"
            @click="setVisibility(c, opt.value as any)"
          >
            <Loader2
              v-if="saving[c.id] && c.visibility !== opt.value"
              class="h-3 w-3 animate-spin"
            />
            <component v-else :is="opt.icon" class="h-3 w-3" />
            {{ opt.label }}
          </button>
        </div>

        <!-- Curator action row (streamer+). Open / Download / Delete. -->
        <div
          v-if="canCurate"
          class="flex items-center justify-between gap-1 rounded-md border border-border/50 bg-card/40 px-1.5 py-1 [backdrop-filter:blur(6px)]"
        >
          <NuxtLink
            :to="`/clips/${c.id}`"
            class="inline-flex items-center gap-1.5 px-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Open
            <ArrowUpRight class="h-3 w-3" />
          </NuxtLink>
          <div class="flex items-center gap-0.5">
            <a
              v-if="c.download_url"
              :href="`${c.download_url}&dl=1`"
              :download="clipDownloadName(c)"
              :title="`Download ${c.title ?? 'clip'}`"
              class="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download class="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              :title="`Delete ${c.title ?? 'clip'}`"
              class="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
              @click="askDelete(c)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </PageTransition>

  <DeleteClipDialog
    v-if="canCurate"
    v-model="deleteDialogOpen"
    :clip-id="pendingDeleteId"
    :title="pendingDeleteTitle"
    @deleted="onDeleted"
  />
</template>
