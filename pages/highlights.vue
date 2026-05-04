<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Sparkles, Filter, Loader2, Lock, Eye, Globe } from "lucide-vue-next";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import HighlightCard from "~/components/clips/HighlightCard.vue";

// Two-mode page:
//   - Guests / regular users → browse public clips only.
//     The Hasura guest + user role permissions filter rows to
//     visibility = 'public' (and 'unlisted' for users), so a query
//     without an explicit filter still respects row-level visibility.
//   - Admins → see EVERY clip plus per-card visibility toggles, so
//     they can promote a private clip to public (or pull one back)
//     in one click.
//
// One page covers both cases because Hasura's row permissions do the
// actual gating; the UI just exposes more affordances when isAdmin
// is true.
//
// The `highlights` middleware enforces the operator-controlled
// public.highlights_public_enabled flag — when off, only streamer+
// users can reach this page; everyone else gets redirected to /.
definePageMeta({
  middleware: "highlights",
});

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
    map?: { name: string; poster: string | null; label: string | null } | null;
    match?: {
      id: string;
      lineup_1?: { name: string } | null;
      lineup_2?: { name: string } | null;
    } | null;
  } | null;
};

const nuxtApp = useNuxtApp();
const auth = useAuthStore();
const isAdmin = computed(() => auth.isAdmin);

const clips = ref<Clip[]>([]);
const loading = ref(true);
const activeClipId = ref<string | null>(null);
// Visibility filter is admin-only — non-admins always see "public"
// (the only thing Hasura returns for them). Default "public" so a
// fresh load is the same as the public browse.
const visibilityFilter = ref<"all" | "public" | "private" | "unlisted">(
  "public",
);
const saving = ref<Record<string, boolean>>({});

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  // Admins query without a visibility filter to see every clip.
  // Non-admins (and guests) still get a clean query — Hasura's
  // row-level permission filters down to public / unlisted as
  // appropriate per role, so the result for them is "all the public
  // clips" without us having to spell that out client-side.
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

const filteredClips = computed(() => {
  // For non-admins the server already trimmed to public — show as-is.
  if (!isAdmin.value) return clips.value;
  if (visibilityFilter.value === "all") return clips.value;
  return clips.value.filter((c) => c.visibility === visibilityFilter.value);
});
const counts = computed(() => {
  const byVis: Record<string, number> = {
    all: clips.value.length,
    public: 0,
    private: 0,
    unlisted: 0,
  };
  for (const c of clips.value) byVis[c.visibility] = (byVis[c.visibility] ?? 0) + 1;
  return byVis;
});
const hasClips = computed(() => filteredClips.value.length > 0);

async function setVisibility(
  clip: Clip,
  visibility: "public" | "private" | "unlisted",
) {
  if (saving.value[clip.id]) return;
  saving.value = { ...saving.value, [clip.id]: true };
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      // Cast: updateClip rolls in with the latest hasura metadata
      // apply; zeus types lag until codegen runs.
      mutation: generateMutation({
        updateClip: [
          { clip_id: clip.id, visibility },
          { success: true },
        ],
      } as any),
    });
    // Subscription delivers the new row state; no manual refetch.
  } catch (e) {
    console.error("[highlights-admin] visibility toggle failed:", e);
  } finally {
    saving.value = { ...saving.value, [clip.id]: false };
  }
}
</script>

<template>
  <PageTransition>
    <TacticalPageHeader
      :icon="Sparkles"
      title="Highlights"
      :subtitle="
        isAdmin
          ? 'Admin curation — promote any clip to public, or pull one back.'
          : 'Public clips from across the platform — click any clip to play it here.'
      "
    >
      <!-- Admin-only visibility filter. Hidden for guests / regular
           users since their server-side row permission already
           constrains them to public clips. -->
      <template v-if="isAdmin" #actions>
        <div class="flex items-center gap-2">
          <Filter class="h-4 w-4 text-muted-foreground" />
          <Select v-model="visibilityFilter">
            <SelectTrigger class="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({{ counts.all }})</SelectItem>
              <SelectItem value="public">
                Public ({{ counts.public }})
              </SelectItem>
              <SelectItem value="private">
                Private ({{ counts.private }})
              </SelectItem>
              <SelectItem value="unlisted">
                Unlisted ({{ counts.unlisted }})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition v-if="loading" :delay="80">
    <div
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <Skeleton v-for="i in 6" :key="i" class="aspect-video w-full rounded-lg" />
    </div>
  </PageTransition>

  <PageTransition v-else-if="!hasClips" :delay="80">
    <Empty>
      <EmptyTitle>No clips match this filter</EmptyTitle>
      <EmptyDescription>
        Try a different visibility filter or wait for new clips to be rendered.
      </EmptyDescription>
    </Empty>
  </PageTransition>

  <PageTransition v-else :delay="80">
    <div
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <div v-for="c in filteredClips" :key="c.id" class="space-y-2">
        <HighlightCard
          :clip="c"
          :active="activeClipId === c.id"
          @activate="activeClipId = c.id"
        />
        <!-- Admin-only curation row beneath each card. Three buttons
             matching the three visibility states; current state
             renders as the "active" variant so the admin sees the
             clip's status at a glance. Hidden for non-admins —
             they see a plain card grid. -->
        <div
          v-if="isAdmin"
          class="flex items-center gap-1 rounded-md border border-border/50 bg-muted/20 p-1"
        >
          <Button
            v-for="opt in [
              { value: 'private', icon: Lock, label: 'Private' },
              { value: 'unlisted', icon: Eye, label: 'Unlisted' },
              { value: 'public', icon: Globe, label: 'Public' },
            ]"
            :key="opt.value"
            size="sm"
            :variant="c.visibility === opt.value ? 'default' : 'ghost'"
            class="flex-1 h-7 text-[0.7rem]"
            :disabled="saving[c.id] || c.visibility === opt.value"
            @click="setVisibility(c, opt.value as any)"
          >
            <Loader2
              v-if="saving[c.id]"
              class="h-3 w-3 mr-1 animate-spin"
            />
            <component
              v-else
              :is="opt.icon"
              class="h-3 w-3 mr-1"
            />
            {{ opt.label }}
          </Button>
        </div>
      </div>
    </div>
  </PageTransition>
</template>
