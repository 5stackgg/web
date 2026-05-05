<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ArrowRight, ChevronLeft, ChevronRight, Plus } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import { Skeleton } from "~/components/ui/skeleton";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import type { Clip } from "~/types/clip";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Horizontal-scroll strip of a player's highlights for the player
// profile page. Scoped to clips where this player is the TARGET —
// the rendered subject of the clip — not the creator. A streamer
// rendering a montage of someone else's frags should attach the clip
// to that fragger's profile, not their own.
const props = defineProps<{
  steamId: string | number;
}>();

const PAGE_SIZE = 20;
const MAX_LIMIT = 60;

const clips = ref<Clip[]>([]);
const loading = ref(true);
const limit = ref(PAGE_SIZE);
const railEl = ref<HTMLDivElement | null>(null);
const sentinelEl = ref<HTMLDivElement | null>(null);

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  if (!props.steamId) return;
  const sid = String(props.steamId);
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        {
          where: {
            target_steam_id: { _eq: sid },
          },
          order_by: [{ created_at: "desc" }],
          limit: limit.value,
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
      console.error("[player-highlights] subscription error:", err);
      loading.value = false;
    },
  });
}

watch(
  () => props.steamId,
  () => {
    limit.value = PAGE_SIZE;
    loading.value = true;
    subscribe();
  },
  { immediate: true },
);
onBeforeUnmount(() => activeSub?.unsubscribe());

// Infinite-scroll sentinel. When the trailing tile becomes visible
// inside the rail's scroll viewport AND the current page is full,
// bump the limit and re-subscribe. The `clips.length >= limit` guard
// stops fetching once the server has fewer rows than we asked for —
// no more pages exist.
let observer: IntersectionObserver | null = null;
function ensureObserver() {
  observer?.disconnect();
  if (!sentinelEl.value || !railEl.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (
          e.isIntersecting &&
          clips.value.length >= limit.value &&
          limit.value < MAX_LIMIT
        ) {
          limit.value = Math.min(limit.value + PAGE_SIZE, MAX_LIMIT);
          subscribe();
        }
      }
    },
    { root: railEl.value, threshold: 0.1, rootMargin: "0px 200px 0px 0px" },
  );
  observer.observe(sentinelEl.value);
}
onMounted(ensureObserver);
watch([sentinelEl, railEl], () => ensureObserver());
onBeforeUnmount(() => observer?.disconnect());

// Manual arrows for desktop. Touch + trackpad scroll naturally.
function scrollByDir(dir: "left" | "right") {
  const el = railEl.value;
  if (!el) return;
  el.scrollBy({
    left: dir === "right" ? el.clientWidth * 0.8 : -el.clientWidth * 0.8,
    behavior: "smooth",
  });
}

const hasClips = computed(() => clips.value.length > 0);
const hasMore = computed(
  () => clips.value.length >= limit.value && limit.value < MAX_LIMIT,
);
const hitMaxLimit = computed(() => limit.value >= MAX_LIMIT);
</script>

<template>
  <div v-if="loading || hasClips">
    <div
      :class="[tacticalSectionLabelClasses, 'flex items-center justify-between']"
    >
      <span class="inline-flex items-center gap-2">
        <span :class="tacticalSectionTickClasses"></span>
        HIGHLIGHTS
        <span
          v-if="hasClips"
          class="rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] px-2 py-0.5 font-mono text-[0.55rem] text-[hsl(var(--tac-amber))] tracking-[0.16em]"
        >
          {{ clips.length }}
        </span>
      </span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/50 bg-card/40 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Scroll left"
          @click="scrollByDir('left')"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/50 bg-card/40 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Scroll right"
          @click="scrollByDir('right')"
        >
          <ChevronRight class="h-3.5 w-3.5" />
        </button>
        <NuxtLink
          :to="{ path: '/highlights', query: { player: String(steamId) } }"
          class="ml-2 inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground hover:text-[hsl(var(--tac-amber))] transition-colors normal-case"
        >
          See all
          <ArrowRight class="h-3 w-3" />
        </NuxtLink>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex gap-3 overflow-hidden pb-1"
    >
      <Skeleton
        v-for="i in 5"
        :key="i"
        class="aspect-video w-[18rem] shrink-0 rounded-lg"
      />
    </div>

    <div
      v-else
      ref="railEl"
      class="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory player-highlights-rail"
    >
      <div
        v-for="c in clips"
        :key="c.id"
        class="w-[18rem] shrink-0 snap-start"
      >
        <HighlightCard :clip="c" />
      </div>

      <!-- Trailing sentinel triggers the next page when scrolled into
           view. Hidden visually but takes up enough space to be
           observable. Replaced by a "See all" tile once we hit the
           in-page cap. -->
      <div
        v-if="hasMore"
        ref="sentinelEl"
        class="w-[18rem] shrink-0 snap-start"
      >
        <div
          class="aspect-video w-full rounded-lg border border-dashed border-border/50 bg-card/20 flex items-center justify-center"
        >
          <span class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            Loading more…
          </span>
        </div>
      </div>

      <NuxtLink
        v-else-if="hitMaxLimit"
        :to="{ path: '/highlights', query: { player: String(steamId) } }"
        class="w-[18rem] shrink-0 snap-start group/more"
      >
        <div
          class="aspect-video w-full rounded-lg border border-border/50 bg-[linear-gradient(135deg,hsl(var(--card)/0.55)_0%,hsl(var(--card)/0.2)_100%)] [backdrop-filter:blur(6px)] flex flex-col items-center justify-center gap-2 transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.05)]"
        >
          <span
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))] transition-transform group-hover/more:scale-110"
          >
            <Plus class="h-4 w-4" />
          </span>
          <span class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-foreground/80">
            See all highlights
          </span>
          <span class="text-[0.65rem] text-muted-foreground">
            for this player
          </span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
/* Subtle scrollbar inside the horizontal rail — visible enough to
   communicate "this scrolls" but doesn't dominate the row. */
.player-highlights-rail {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border) / 0.6) transparent;
}
.player-highlights-rail::-webkit-scrollbar {
  height: 6px;
}
.player-highlights-rail::-webkit-scrollbar-track {
  background: transparent;
}
.player-highlights-rail::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.6);
  border-radius: 999px;
}
.player-highlights-rail::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--tac-amber) / 0.5);
}
</style>
