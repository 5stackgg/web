<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Sparkles } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import HighlightCard from "~/components/clips/HighlightCard.vue";

// Public highlights feed. Click a card to play it inline (no nav to
// /clips/<id>); only one card is active at a time so we don't
// overload the network. The info popover on each card surfaces
// extra context, with a "Open detail page →" link for users who
// want the full /clips/<id> view.

type Clip = {
  id: string;
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

const clips = ref<Clip[]>([]);
const loading = ref(true);
// Only one card streams at a time. When the user clicks a different
// card it takes over; the previous one drops back to its idle thumb.
const activeClipId = ref<string | null>(null);

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        {
          where: { visibility: { _eq: "public" } },
          order_by: [{ created_at: "desc" }],
          limit: 60,
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

const hasClips = computed(() => clips.value.length > 0);
</script>

<template>
  <PageTransition>
    <TacticalPageHeader
      :icon="Sparkles"
      title="Highlights"
      subtitle="Public clips from across the platform — click any clip to play it here."
    />
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
      <EmptyTitle>No public highlights yet</EmptyTitle>
      <EmptyDescription>
        When a player marks a clip as <strong>public</strong> from their
        library, it shows up here for everyone to watch.
      </EmptyDescription>
    </Empty>
  </PageTransition>

  <PageTransition v-else :delay="80">
    <div
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <HighlightCard
        v-for="c in clips"
        :key="c.id"
        :clip="c"
        :active="activeClipId === c.id"
        @activate="activeClipId = c.id"
      />
    </div>
  </PageTransition>
</template>
