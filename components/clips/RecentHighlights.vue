<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Sparkles, ArrowRight } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import { Skeleton } from "~/components/ui/skeleton";
import HighlightCard from "~/components/clips/HighlightCard.vue";

// Compact strip of the latest public clips. Same HighlightCard the
// /highlights page uses (inline play on click, info popover on
// hover); this just trims the limit + adds a header + "See all" so
// it slots into the Watch tab without competing with the matches feed.
const props = withDefaults(
  defineProps<{
    limit?: number;
    title?: string;
  }>(),
  {
    limit: 8,
    title: "Recent Highlights",
  },
);

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
          limit: props.limit,
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
      console.error("[recent-highlights] subscription error:", err);
      loading.value = false;
    },
  });
}
subscribe();
onBeforeUnmount(() => activeSub?.unsubscribe());

const hasClips = computed(() => clips.value.length > 0);
</script>

<template>
  <!-- Hide entirely when there's nothing to show; an empty strip
       on the Watch tab is just visual noise above the matches feed. -->
  <div v-if="loading || hasClips">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <Sparkles class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
        <h2
          class="font-mono text-xs uppercase tracking-[0.18em] text-foreground/80"
        >
          {{ title }}
        </h2>
      </div>
      <NuxtLink
        :to="{ name: 'highlights' }"
        class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        See all
        <ArrowRight class="h-3 w-3" />
      </NuxtLink>
    </div>

    <div
      v-if="loading"
      class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      <Skeleton v-for="i in 4" :key="i" class="aspect-video w-full rounded-lg" />
    </div>

    <div
      v-else
      class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      <HighlightCard
        v-for="c in clips"
        :key="c.id"
        :clip="c"
        :active="activeClipId === c.id"
        @activate="activeClipId = c.id"
      />
    </div>
  </div>
</template>
