<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { ArrowRight } from "lucide-vue-next";
import { $, order_by } from "~/generated/zeus";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { watchTickerMatchFields } from "~/graphql/watchTickerFields";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import WatchTickerCell from "~/components/watch/WatchTickerCell.vue";
import { seededSubscribe } from "~/utilities/seededSubscribe";
import { RESULT_MATCHES_WHERE } from "~/utilities/teamResults";
import {
  TICKER_LIVE_STATUSES,
  sortLiveMatches,
  tickerCell,
} from "~/components/watch/watchTicker";

const RECENT_LIMIT = 8;

const { t } = useI18n();
const { client } = useApolloClient();

const live = ref<any[]>([]);
const recent = ref<any[]>([]);
const liveLoaded = ref(false);

let liveSub: { unsubscribe: () => void } | undefined;

const liveQuery = generateSubscription({
  matches: [
    {
      where: {
        status: { _in: $("statuses", "[e_match_status_enum!]") },
      },
      order_by: [{ started_at: order_by.desc_nulls_last }],
      limit: 20,
    },
    watchTickerMatchFields,
  ],
} as any);

const recentQuery = generateQuery({
  matches: [
    {
      where: { ...RESULT_MATCHES_WHERE, source: { _eq: "5stack" } },
      order_by: [{ ended_at: order_by.desc_nulls_last }],
      limit: RECENT_LIMIT,
    },
    watchTickerMatchFields,
  ],
} as any);

async function loadRecent() {
  try {
    const { data } = await client.query({
      query: recentQuery,
      fetchPolicy: "network-only",
    });
    recent.value = (data as any)?.matches ?? [];
  } catch (err) {
    console.error("[landing-now] recent query error", err);
  }
}

onMounted(() => {
  liveSub = seededSubscribe(
    client,
    { query: liveQuery, variables: { statuses: [...TICKER_LIVE_STATUSES] } },
    {
      next: ({ data }: any) => {
        live.value = data?.matches ?? [];
        if (!liveLoaded.value) {
          liveLoaded.value = true;
          if (!live.value.length) void loadRecent();
        }
      },
      error: (err: any) => {
        console.error("[landing-now] live subscription error", err);
        liveLoaded.value = true;
        void loadRecent();
      },
    },
  );
});

onBeforeUnmount(() => liveSub?.unsubscribe());

const showingLive = computed(() => live.value.length > 0);

const cells = computed(() => {
  const now = new Date();
  const matches = showingLive.value
    ? sortLiveMatches(live.value)
    : recent.value;
  return matches.map((match) => tickerCell(match, { t, now }));
});
</script>

<template>
  <section v-if="cells.length" class="grid gap-3">
    <div class="flex items-baseline justify-between gap-4">
      <h2
        class="m-0 inline-flex items-center gap-2 text-[0.72rem] font-normal uppercase tracking-[0.24em] text-muted-foreground"
      >
        <span
          v-if="showingLive"
          class="relative inline-flex size-2 shrink-0"
          aria-hidden="true"
        >
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
          ></span>
          <span
            class="relative inline-flex size-2 rounded-full bg-destructive"
          ></span>
        </span>
        <span
          v-else
          class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
          aria-hidden="true"
        ></span>
        {{
          showingLive
            ? $t("pages.welcome.now.live")
            : $t("pages.welcome.now.recent")
        }}
      </h2>
      <NuxtLink
        to="/watch"
        class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[hsl(var(--tac-amber))] hover:underline"
      >
        {{ $t("pages.welcome.now.open_watch") }}
        <ArrowRight class="size-3.5" />
      </NuxtLink>
    </div>
    <HorizontalScrollRow>
      <WatchTickerCell
        v-for="cell in cells"
        :key="cell.id"
        :model="cell"
      />
    </HorizontalScrollRow>
  </section>
</template>
