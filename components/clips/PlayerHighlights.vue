<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ArrowRight } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";
import type { Clip } from "~/types/clip";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Scoped to clips where this player is the target, not the creator.
const props = defineProps<{
  steamId: string | number;
}>();

// Fires once the first subscription response comes back (with clips or
// empty). Lets the page hold downstream sections until the highlights
// area has decided whether it's going to occupy space or not, so the
// rest of the page doesn't render then shift down when clips arrive.
const emit = defineEmits<{ (e: "resolved"): void }>();
let hasResolved = false;
function markResolved() {
  if (hasResolved) return;
  hasResolved = true;
  emit("resolved");
}

const PAGE_SIZE = 20;
// "See all" only renders once the player has hit this many clips —
// avoids a redundant link when the entire highlight set already fits
// on screen.
const SEE_ALL_THRESHOLD = 10;

const clips = ref<Clip[]>([]);
const loading = ref(true);
const limit = ref(PAGE_SIZE);
const reachedEnd = ref(false);
const inFlight = ref(false);

const scrollRef = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);

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
      const next = (data?.match_clips ?? []) as Clip[];
      // Fewer rows than asked = we've hit the end of the player's clips.
      reachedEnd.value = next.length < limit.value;
      clips.value = next;
      loading.value = false;
      inFlight.value = false;
      markResolved();
    },
    error: (err: any) => {
      console.error("[player-highlights] subscription error:", err);
      loading.value = false;
      inFlight.value = false;
      markResolved();
    },
  });
}

watch(
  () => props.steamId,
  () => {
    limit.value = PAGE_SIZE;
    loading.value = true;
    reachedEnd.value = false;
    subscribe();
  },
  { immediate: true },
);
onBeforeUnmount(() => activeSub?.unsubscribe());

function loadMore() {
  if (reachedEnd.value || inFlight.value) return;
  inFlight.value = true;
  limit.value += PAGE_SIZE;
  subscribe();
}

const hasClips = computed(() => clips.value.length > 0);
const showSeeAll = computed(
  () => clips.value.length >= SEE_ALL_THRESHOLD || !reachedEnd.value,
);
const showMap = computed(() => {
  const seen = new Set<string>();
  for (const c of clips.value) {
    const name = c.match_map?.map?.name;
    if (name) seen.add(name);
    if (seen.size > 1) return true;
  }
  return false;
});
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,transform] [transition-duration:520ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,transform] motion-reduce:![transition-duration:1ms]"
    enter-from-class="opacity-0 translate-y-4 motion-reduce:translate-y-0"
    leave-active-class="transition-[opacity] [transition-duration:200ms]"
    leave-to-class="opacity-0"
  >
    <div v-if="hasClips">
      <div
        :class="[
          tacticalSectionLabelClasses,
          '!flex w-full items-center justify-between',
        ]"
      >
        <div class="inline-flex items-center gap-3">
          <span class="inline-flex items-center gap-2">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("common.highlights") }}
            <span
              class="rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] px-2 py-0.5 font-mono text-[0.55rem] text-[hsl(var(--tac-amber))] tracking-[0.16em]"
            >
              {{ clips.length }}
            </span>
          </span>
          <NuxtLink
            v-if="showSeeAll"
            :to="{ path: '/highlights', query: { player: String(steamId) } }"
            class="inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors normal-case"
          >
            {{ $t("common.see_all") }}
            <ArrowRight class="h-3 w-3" />
          </NuxtLink>
        </div>
        <ScrollArrows
          :can-left="scrollRef?.state?.canScrollLeft"
          :can-right="scrollRef?.state?.canScrollRight || !reachedEnd"
          @scroll="
            (d) => {
              scrollRef?.scrollByDirection(d);
              if (d === 'right') loadMore();
            }
          "
        />
      </div>

      <HorizontalScrollRow ref="scrollRef" @approaching-end="loadMore">
        <div
          v-for="c in clips"
          :key="c.id"
          class="w-[18rem] shrink-0 snap-start"
        >
          <HighlightCard :clip="c" :show-map="showMap" />
        </div>
      </HorizontalScrollRow>
    </div>
  </Transition>
</template>
