<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { ChevronLeft, ChevronRight, List } from "lucide-vue-next";
import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { watchTickerMatchFields } from "~/graphql/watchTickerFields";
import { teamMatchesFilter } from "~/graphql/teamPulseFields";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import WatchTickerCell from "~/components/watch/WatchTickerCell.vue";
import { Skeleton } from "~/components/ui/skeleton";
import {
  TICKER_RESULTS_PAGE,
  tickerCell,
} from "~/components/watch/watchTicker";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// A team's results as the /watch ticker shows them: newest first, paging in
// older ones as the row scrolls.
const props = defineProps<{ teamId: string }>();
const emit = defineEmits<{ (e: "all-matches"): void }>();

const { t, locale } = useI18n();
const { client } = useApolloClient();

const results = ref<any[]>([]);
const loaded = ref(false);
const loading = ref(false);
const done = ref(false);
const scrollRow = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);

// Bumped when the team changes so a page that lands late is dropped.
let generation = 0;

const resultsQuery = generateQuery({
  matches: [
    {
      where: { status: { _eq: "Finished" }, ...teamMatchesFilter },
      order_by: [{ ended_at: order_by.desc_nulls_last }],
      limit: $("limit", "Int!"),
      offset: $("offset", "Int!"),
    },
    watchTickerMatchFields,
  ],
} as any);

async function load(reset = false) {
  if (reset) {
    generation++;
    results.value = [];
    loaded.value = false;
    done.value = false;
  } else if (loading.value || done.value) {
    return;
  }
  const current = generation;
  loading.value = true;
  try {
    const { data } = await client.query({
      query: resultsQuery,
      variables: {
        teamId: props.teamId,
        limit: TICKER_RESULTS_PAGE,
        offset: results.value.length,
      },
      fetchPolicy: "network-only",
    });
    if (current !== generation) return;
    const page: any[] = (data as any)?.matches ?? [];
    results.value = [...results.value, ...page];
    done.value = page.length < TICKER_RESULTS_PAGE;
  } catch (error) {
    console.error("[team-results] results query error", error);
  } finally {
    if (current === generation) {
      loading.value = false;
      loaded.value = true;
    }
  }
}

watch(
  () => props.teamId,
  () => {
    if (typeof window !== "undefined") void load(true);
  },
  { immediate: true },
);

const now = ref(new Date());
const clock =
  typeof window !== "undefined"
    ? setInterval(() => (now.value = new Date()), 60_000)
    : null;
onBeforeUnmount(() => clock && clearInterval(clock));

const cells = computed(() =>
  results.value.map((match) =>
    tickerCell(match, { t, locale: locale.value, now: now.value }),
  ),
);

function scrollRight() {
  scrollRow.value?.scrollByDirection("right");
  if (!scrollRow.value?.state.canScrollRight) void load();
}

const arrowClasses =
  "inline-flex size-8 items-center justify-center rounded-md border border-border bg-muted/30 text-foreground/80 transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-muted/30";
</script>

<template>
  <section
    v-if="!loaded || results.length"
    aria-labelledby="team-results-label"
  >
    <div class="mb-2.5 flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-baseline gap-3">
        <h2
          id="team-results-label"
          :class="[tacticalSectionLabelClasses, '!mb-0 !flex']"
        >
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.watch.ticker.results") }}
        </h2>
        <span class="truncate text-xs text-muted-foreground max-sm:hidden">
          {{ $t("team.pulse.results.hint") }}
        </span>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          class="relative mr-1.5 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] [@media(pointer:fine)]:after:hidden"
          @click="emit('all-matches')"
        >
          {{ $t("team.pulse.results.all_matches") }}
          <ChevronRight class="size-3.5" />
        </button>
        <button
          type="button"
          class="max-sm:hidden"
          :aria-label="$t('ui.scroll.left')"
          :disabled="!scrollRow?.state.canScrollLeft"
          :class="arrowClasses"
          @click="scrollRow?.scrollByDirection('left')"
        >
          <ChevronLeft class="size-4" />
        </button>
        <button
          type="button"
          class="max-sm:hidden"
          :aria-label="$t('ui.scroll.right')"
          :disabled="!scrollRow?.state.canScrollRight && done"
          :class="arrowClasses"
          @click="scrollRight"
        >
          <ChevronRight class="size-4" />
        </button>
      </div>
    </div>

    <div
      v-if="!loaded"
      role="status"
      class="flex gap-3 overflow-hidden px-px pb-2 pt-1"
      :aria-label="$t('pages.watch.ticker.loading_older')"
    >
      <Skeleton
        v-for="i in 6"
        :key="i"
        class="h-[6.875rem] w-56 shrink-0 rounded-lg"
      />
    </div>

    <HorizontalScrollRow v-else ref="scrollRow" @approaching-end="load()">
      <div
        v-for="cell in cells"
        :key="cell.id"
        class="flex shrink-0 snap-start"
      >
        <WatchTickerCell :model="cell" />
      </div>
      <template v-if="loading">
        <Skeleton
          v-for="i in 3"
          :key="`sk-${i}`"
          class="h-[6.875rem] w-56 shrink-0 rounded-lg"
          :aria-label="$t('pages.watch.ticker.loading_older')"
        />
      </template>
      <button
        v-else-if="done"
        type="button"
        class="flex h-[6.875rem] w-40 shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
        @click="emit('all-matches')"
      >
        <List class="size-4" />
        {{ $t("team.pulse.results.all_matches") }}
      </button>
    </HorizontalScrollRow>
  </section>
</template>
