<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect,
} from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { Film } from "lucide-vue-next";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import HighlightSkeleton from "~/components/clips/HighlightSkeleton.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import EventPlayerFilter from "~/components/events/EventPlayerFilter.vue";
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { matchClipFields } from "~/graphql/matchClip";
import { useClipModal, type ClipQueueItem } from "~/composables/useClipModal";
import type { Clip } from "~/types/clip";

const props = defineProps<{
  eventId: string;
}>();

const PAGE_SIZE = 12;

const HIGHLIGHTS_SUBSCRIPTION = typedGql("subscription")({
  match_clips: [
    {
      where: $("where", "match_clips_bool_exp!"),
      order_by: $("orderBy", "[match_clips_order_by!]!"),
      limit: $("limit", "Int!"),
    },
    matchClipFields,
  ],
});

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

const sort = ref("views");
const sortOptions = computed(() => [
  { key: "views", label: t("pages.highlights.sort.views") },
  { key: "recent", label: t("pages.highlights.sort.recent") },
]);

const filterPlayer = ref<{ steam_id: string | number; name?: string } | null>(
  null,
);

const clips = ref<Clip[]>([]);
const loading = ref(true);
const limit = ref(PAGE_SIZE);
const reachedEnd = ref(false);
const inFlight = ref(false);
// Hides the toolbar only when the event has no highlights at all; a filter
// that matches nothing must keep it so the filter can be cleared.
const eventHasClips = ref(false);

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  loading.value = true;

  const filtered = filterPlayer.value !== null;
  const filters: any[] = [
    { visibility: { _eq: "public" } },
    {
      match_map: {
        match: { event_links: { event_id: { _eq: props.eventId } } },
      },
    },
  ];
  if (filterPlayer.value) {
    filters.push({
      target_steam_id: { _eq: String(filterPlayer.value.steam_id) },
    });
  }

  activeSub = apolloClient
    .subscribe({
      query: HIGHLIGHTS_SUBSCRIPTION,
      variables: {
        where: { _and: filters },
        orderBy:
          sort.value === "views"
            ? [
                { views_count: order_by.desc_nulls_last },
                { created_at: order_by.desc },
              ]
            : [{ created_at: order_by.desc }],
        limit: limit.value,
      },
    })
    .subscribe({
      next: ({ data }: any) => {
        const next = (data?.match_clips ?? []) as Clip[];
        reachedEnd.value = next.length < limit.value;
        clips.value = next;
        if (!filtered && next.length > 0) {
          eventHasClips.value = true;
        }
        loading.value = false;
        inFlight.value = false;
      },
      error: (error: any) => {
        console.error("Error subscribing to event highlights:", error);
        loading.value = false;
        inFlight.value = false;
      },
    });
}

watch(
  [() => props.eventId, sort, () => filterPlayer.value?.steam_id],
  () => {
    limit.value = PAGE_SIZE;
    subscribe();
  },
  { immediate: true },
);

const { setClipQueue, clearClipQueue } = useClipModal();
const clipQueueScope = computed(() => `event-highlights:${props.eventId}`);
function clipQueueItem(clip: Clip): ClipQueueItem {
  return {
    id: clip.id,
    title: clip.title,
    playerName: clip.target?.name ?? null,
    teamName: null,
    durationMs: clip.duration_ms,
    thumbnailUrl: clip.thumbnail_download_url,
    posterUrl: clip.match_map?.map?.poster ?? null,
  };
}
watchEffect(() => {
  if (clips.value.length === 0) {
    return;
  }
  setClipQueue(clips.value.map(clipQueueItem), clipQueueScope.value);
});

function loadMore() {
  if (reachedEnd.value || inFlight.value || loading.value) {
    return;
  }
  inFlight.value = true;
  limit.value += PAGE_SIZE;
  subscribe();
}

const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore();
      }
    },
    { rootMargin: "600px 0px" },
  );
  watch(
    sentinel,
    (el) => {
      observer?.disconnect();
      if (el) {
        observer?.observe(el);
      }
    },
    { immediate: true },
  );
});

onBeforeUnmount(() => {
  observer?.disconnect();
  activeSub?.unsubscribe();
  clearClipQueue(clipQueueScope.value);
});
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="eventHasClips"
      class="flex flex-wrap items-center justify-between gap-2"
    >
      <div class="w-full max-w-xs">
        <EventPlayerFilter
          v-model="filterPlayer"
          :event-id="eventId"
          :label="$t('event.media.filter_by_player')"
        />
      </div>
      <AnimatedFilters v-model="sort" :options="sortOptions" square />
    </div>

    <div
      v-if="loading && clips.length === 0"
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <HighlightSkeleton v-for="i in 6" :key="i" />
    </div>

    <div
      v-else-if="clips.length === 0"
      class="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-4 py-16 text-center"
    >
      <Film class="h-6 w-6 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">
        {{
          filterPlayer
            ? $t("event.highlights.none_for_player")
            : $t("event.highlights.none")
        }}
      </p>
    </div>

    <template v-else>
      <TransitionGroup
        tag="div"
        class="grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3"
        :class="{ 'opacity-60': loading && !inFlight }"
        enter-active-class="transition-[opacity,transform] duration-500 ease-out"
        enter-from-class="opacity-0 translate-y-3"
        move-class="transition-transform duration-300 ease-out"
      >
        <HighlightCard v-for="clip in clips" :key="clip.id" :clip="clip" />
      </TransitionGroup>

      <div
        v-if="!reachedEnd"
        ref="sentinel"
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <HighlightSkeleton v-for="i in 3" :key="i" />
      </div>
    </template>
  </div>
</template>
