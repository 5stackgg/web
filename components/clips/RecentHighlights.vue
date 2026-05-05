<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Film, ArrowRight } from "lucide-vue-next";
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

// Compact strip of the latest public clips for embedding on /watch
// and similar surfaces. Hides itself entirely when there's nothing to
// show — empty strips read as broken section dividers and crowd the
// page above the actual matches feed.
//
// `sectionLabel` opts into the tactical section-header wrapper so the
// hide-when-empty behavior includes the label, not just the grid. Use
// it instead of wrapping this component yourself when you want both
// the label and the strip to disappear together on quiet days.
const props = withDefaults(
  defineProps<{
    limit?: number;
    title?: string;
    showHeader?: boolean;
    sectionLabel?: string;
  }>(),
  {
    limit: 8,
    title: "Recent Highlights",
    showHeader: true,
  },
);

const clips = ref<Clip[]>([]);
const loading = ref(true);

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
// Render only when we have something to display. We deliberately don't
// show the loading skeleton when sectionLabel is set — the section
// header itself would imply content that isn't there yet, and a flash
// of skeleton-then-vanish is worse than a single beat of nothing.
const shouldRender = computed(() =>
  props.sectionLabel ? hasClips.value : loading.value || hasClips.value,
);
</script>

<template>
  <div v-if="shouldRender">
    <!-- Tactical section header — opt-in via `sectionLabel`. Wraps the
         strip so the entire section hides together when empty. -->
    <div
      v-if="sectionLabel"
      :class="[tacticalSectionLabelClasses, 'flex items-center justify-between']"
    >
      <span class="inline-flex items-center gap-2">
        <span :class="tacticalSectionTickClasses"></span>
        {{ sectionLabel }}
      </span>
      <NuxtLink
        :to="{ name: 'highlights' }"
        class="inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors normal-case"
      >
        See all
        <ArrowRight class="h-3 w-3" />
      </NuxtLink>
    </div>

    <div
      v-else-if="showHeader"
      class="flex items-center justify-between mb-3"
    >
      <div class="flex items-center gap-2">
        <Film class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
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
      v-else
      class="flex justify-end mb-3 -mt-1"
    >
      <NuxtLink
        :to="{ name: 'highlights' }"
        class="inline-flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
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
      />
    </div>
  </div>
</template>
