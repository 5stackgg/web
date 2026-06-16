<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "vue-chartjs";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import StatLabel from "~/components/common/StatLabel.vue";
import { usePlayerComparison } from "~/composables/usePlayerComparison";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
);

const props = defineProps<{
  steamId: string;
  source?: string | null;
  limit?: number | null;
}>();
const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

const QUERY = gql`
  query PlayerConsistency(
    $where: player_match_performance_v_bool_exp!
    $limit: Int!
  ) {
    player_match_performance_v(
      where: $where
      order_by: { played_at: desc }
      limit: $limit
    ) {
      match_id
      played_at
      aim_rating
      positioning_rating
      utility_rating
      overall_rating
    }
  }
`;

const loading = ref(true);
const rows = ref<Array<Record<string, any>>>([]);

const COLOR_COMPARE = "#38bdf8";

function buildWhere(steamId: string) {
  const where: Record<string, any> = { steam_id: { _eq: steamId } };
  if (props.source && !["all", "", "external"].includes(props.source)) {
    where.source = { _eq: props.source };
  }
  return where;
}

async function load() {
  if (!props.steamId) {
    rows.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const { data } = await apolloClient.query({
      query: QUERY,
      variables: {
        where: buildWhere(props.steamId),
        limit: props.limit ?? 20,
      },
      fetchPolicy: "network-only",
    });
    rows.value = [
      ...((data as any)?.player_match_performance_v ?? []),
    ].reverse();
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => [props.steamId, props.source, props.limit], load, {
  immediate: true,
});

const {
  enabled: compareEnabled,
  comparePlayer,
  compareData,
} = usePlayerComparison(
  QUERY,
  (steamId) => ({ where: buildWhere(steamId), limit: props.limit ?? 20 }),
  (data: any) =>
    [...((data?.player_match_performance_v ?? []) as any[])].reverse(),
  () => [props.source, props.limit],
);

const compareOverall = computed<Array<number | null>>(() => {
  if (!compareEnabled.value || !compareData.value) {
    return [];
  }
  return compareData.value.map((r: any) =>
    r.overall_rating == null ? null : Number(r.overall_rating),
  );
});

const overall = computed(() =>
  rows.value
    .filter((r) => r.overall_rating != null)
    .map((r) => Number(r.overall_rating))
    .filter((n) => !Number.isNaN(n)),
);

const hasData = computed(() => overall.value.length >= 3);

const stddev = computed(() => {
  const xs = overall.value;
  if (xs.length < 2) {
    return 0;
  }
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance =
    xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length;
  return Math.sqrt(variance);
});

const consistencyScore = computed(() =>
  Math.max(0, Math.min(100, Math.round(100 - stddev.value * 4))),
);

const consistencyTier = computed(() => {
  const v = consistencyScore.value;
  if (v >= 75)
    return {
      label: t("player.performance.consistency.rock_solid"),
      cls: "text-success",
    };
  if (v >= 55)
    return {
      label: t("player.performance.consistency.steady"),
      cls: "text-[hsl(var(--tac-amber))]",
    };
  return {
    label: t("player.performance.consistency.streaky"),
    cls: "text-destructive",
  };
});

const chartData = computed(() => {
  const datasets: any[] = [
    {
      label: compareEnabled.value
        ? t("player.performance.you")
        : t("player.performance.consistency.overall"),
      data: rows.value.map((r) =>
        r.overall_rating == null ? null : Number(r.overall_rating),
      ),
      borderColor: "#fbbf24",
      backgroundColor: "rgba(251, 191, 36, 0.12)",
      borderWidth: 2.5,
      pointRadius: 2.5,
      tension: 0.3,
      fill: !compareEnabled.value,
    },
  ];
  if (compareEnabled.value && compareOverall.value.length) {
    datasets.push({
      label: comparePlayer.value?.name ?? t("player.performance.compare"),
      data: compareOverall.value,
      borderColor: COLOR_COMPARE,
      backgroundColor: "rgba(56, 189, 248, 0.12)",
      borderWidth: 2,
      pointRadius: 2,
      tension: 0.3,
      fill: false,
    });
  }
  const len = Math.max(rows.value.length, compareOverall.value.length);
  return {
    labels: Array.from({ length: len }, (_, i) => `${i + 1}`),
    datasets,
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: compareEnabled.value,
      labels: { color: "rgba(255,255,255,0.85)", boxWidth: 12 },
    },
    tooltip: {
      backgroundColor: "rgba(20,22,28,0.96)",
      callbacks: {
        title: (items: any[]) => {
          const r = rows.value[items[0]?.dataIndex];
          return r?.played_at ? new Date(r.played_at).toLocaleDateString() : "";
        },
        label: (item: any) =>
          `${t("player.performance.consistency.overall")}: ${item.raw}`,
      },
    },
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      grid: { color: "rgba(255,255,255,0.08)" },
      ticks: { color: "rgba(255,255,255,0.5)", stepSize: 25 },
    },
    x: { grid: { display: false }, ticks: { display: false } },
  },
}));
</script>

<template>
  <Card class="bg-card/20">
    <CardContent class="p-3 sm:p-4">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1">
            <span :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses" />
              <StatLabel
                stat="consistency"
                :label="$t('player.performance.consistency.title')"
              />
            </span>
            <span :class="tacticalSectionDescriptionClasses">
              {{ $t("player.performance.consistency.description") }}
            </span>
          </div>
          <span
            v-if="hasData"
            class="shrink-0 font-mono text-xl font-bold leading-none tabular-nums"
            :class="consistencyTier.cls"
            >{{ consistencyScore }}</span
          >
        </div>

        <Skeleton v-if="loading" class="h-[220px] w-full" />
        <div
          v-else-if="!hasData"
          class="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
        >
          {{ $t("player.performance.consistency.not_enough") }}
        </div>
        <div v-else class="relative h-[220px]">
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
