<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect,
} from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import { Film } from "lucide-vue-next";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import HighlightSkeleton from "~/components/clips/HighlightSkeleton.vue";
import { useClipModal, type ClipQueueItem } from "~/composables/useClipModal";
import type { Clip } from "~/types/clip";

const props = defineProps<{
  teamId: string;
}>();

const PAGE_SIZE = 12;

const steamIds = ref<string[]>([]);
const clips = ref<Clip[]>([]);
const loading = ref(true);
const limit = ref(PAGE_SIZE);
const reachedEnd = ref(false);
const inFlight = ref(false);

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  if (steamIds.value.length === 0) {
    clips.value = [];
    loading.value = false;
    return;
  }
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        {
          where: {
            target_steam_id: { _in: steamIds.value },
            visibility: { _eq: "public" },
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
      reachedEnd.value = next.length < limit.value;
      clips.value = next;
      loading.value = false;
      inFlight.value = false;
    },
    error: (err: any) => {
      console.error("[team-highlights] subscription error:", err);
      loading.value = false;
      inFlight.value = false;
    },
  });
}

async function loadRoster() {
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        team_roster: [
          { where: { team_id: { _eq: props.teamId } } } as any,
          { player_steam_id: true },
        ],
      } as any),
      fetchPolicy: "network-only",
    });
    steamIds.value = ((data as any)?.team_roster ?? []).map((row: any) =>
      String(row.player_steam_id),
    );
  } catch (err) {
    console.error("[team-highlights] roster fetch error:", err);
    steamIds.value = [];
  }
  subscribe();
}

watch(
  () => props.teamId,
  () => {
    limit.value = PAGE_SIZE;
    loadRoster();
  },
  { immediate: true },
);

const { setClipQueue, clearClipQueue } = useClipModal();
const clipQueueScope = computed(() => `team-highlights:${props.teamId}`);
function clipQueueItem(c: Clip): ClipQueueItem {
  return {
    id: c.id,
    title: c.title,
    playerName: c.target?.name ?? null,
    teamName: null,
    durationMs: c.duration_ms,
    thumbnailUrl: c.thumbnail_download_url,
    posterUrl: c.match_map?.map?.poster ?? null,
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

const hasClips = computed(() => clips.value.length > 0);
</script>

<template>
  <div>
    <div
      v-if="loading"
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <HighlightSkeleton v-for="i in 6" :key="i" />
    </div>

    <div
      v-else-if="!hasClips"
      class="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-4 py-16 text-center"
    >
      <Film class="h-6 w-6 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">
        {{ $t("team.highlights.empty") }}
      </p>
    </div>

    <TransitionGroup
      v-else
      tag="div"
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      enter-active-class="transition-[opacity,transform] duration-500 ease-out"
      enter-from-class="opacity-0 translate-y-3"
      move-class="transition-transform duration-300 ease-out"
    >
      <HighlightCard v-for="c in clips" :key="c.id" :clip="c" />
    </TransitionGroup>

    <div
      v-if="hasClips && !reachedEnd"
      ref="sentinel"
      class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <HighlightSkeleton v-for="i in 3" :key="i" />
    </div>
  </div>
</template>
