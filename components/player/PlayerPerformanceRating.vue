<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "vue-chartjs";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import { Crosshair, MapPin, Bomb } from "lucide-vue-next";
import StatLabel from "~/components/common/StatLabel.vue";
import StatScale from "~/components/common/StatScale.vue";
import { usePlayerComparison } from "~/composables/usePlayerComparison";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
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

const COLOR_YOU = "#fbbf24";
const COLOR_YOU_FILL = "rgba(251, 191, 36, 0.22)";

const PERFORMANCE_QUERY = gql`
  query PlayerPerformance($steamId: bigint!) {
    player_performance_v(where: { steam_id: { _eq: $steamId } }, limit: 1) {
      aim_rating
      positioning_rating
      utility_rating
      accuracy_score
      hs_score
      spotted_score
      crosshair_score
      ttd_score
      counter_strafe_score
      survival_score
      traded_score
      kast_score
      flash_assists_score
      blind_score
      util_eff_score
    }
  }
`;

const MATCHES_QUERY = gql`
  query PlayerPerfMatches(
    $where: player_match_performance_v_bool_exp!
    $limit: Int!
  ) {
    player_match_performance_v(
      where: $where
      order_by: { played_at: desc }
      limit: $limit
    ) {
      played_at
      aim_rating
      positioning_rating
      utility_rating
    }
  }
`;

const RECENT_WINDOW = 20;

const SUBMETRICS: Array<{
  key: string;
  category: string;
  glossary: string;
  raw?: string;
  unit?: string;
}> = [
  {
    key: "accuracy_score",
    category: "aim",
    glossary: "accuracy",
    raw: "accuracy",
    unit: "%",
  },
  {
    key: "hs_score",
    category: "aim",
    glossary: "hs",
    raw: "hs_pct",
    unit: "%",
  },
  {
    key: "spotted_score",
    category: "aim",
    glossary: "accuracy_spotted",
    raw: "accuracy_spotted",
    unit: "%",
  },
  { key: "crosshair_score", category: "aim", glossary: "crosshair_placement" },
  { key: "ttd_score", category: "aim", glossary: "time_to_damage" },
  {
    key: "counter_strafe_score",
    category: "aim",
    glossary: "counter_strafing",
    raw: "counter_strafe_pct",
    unit: "%",
  },
  {
    key: "survival_score",
    category: "positioning",
    glossary: "survived_pct",
    raw: "survival_pct",
    unit: "%",
  },
  {
    key: "traded_score",
    category: "positioning",
    glossary: "traded",
    raw: "traded_death_pct",
    unit: "%",
  },
  {
    key: "kast_score",
    category: "positioning",
    glossary: "kast",
    raw: "kast_pct",
    unit: "%",
  },
  {
    key: "flash_assists_score",
    category: "utility",
    glossary: "flash_assists",
    raw: "flash_assists_pr",
    unit: "/rd",
  },
  {
    key: "blind_score",
    category: "utility",
    glossary: "flash_blind",
    raw: "enemy_blind_pr",
    unit: "s/rd",
  },
  {
    key: "util_eff_score",
    category: "utility",
    glossary: "util_efficiency",
    raw: "util_efficiency",
  },
];

const loading = ref(true);
const row = ref<Record<string, any> | null>(null);
const matchRows = ref<Array<Record<string, any>>>([]);

const COLOR_COMPARE = "#38bdf8";
const COLOR_COMPARE_FILL = "rgba(56, 189, 248, 0.18)";

function buildWhere(steamId: string) {
  const where: Record<string, any> = { steam_id: { _eq: steamId } };
  if (props.source && !["all", "", "external"].includes(props.source)) {
    where.source = { _eq: props.source };
  }
  return where;
}

async function load() {
  if (!props.steamId) {
    row.value = null;
    matchRows.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const [perf, matches] = await Promise.all([
      apolloClient.query({
        query: PERFORMANCE_QUERY,
        variables: { steamId: props.steamId },
        fetchPolicy: "network-only",
      }),
      apolloClient.query({
        query: MATCHES_QUERY,
        variables: {
          where: buildWhere(props.steamId),
          limit: props.limit ?? RECENT_WINDOW,
        },
        fetchPolicy: "network-only",
      }),
    ]);
    row.value = (perf.data as any)?.player_performance_v?.[0] ?? null;
    matchRows.value = (matches.data as any)?.player_match_performance_v ?? [];
  } catch {
    row.value = null;
    matchRows.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => [props.steamId, props.source, props.limit], load, {
  immediate: true,
});

const COMPARE_QUERY = gql`
  query PlayerPerfCompare(
    $steamId: bigint!
    $where: player_match_performance_v_bool_exp!
    $limit: Int!
  ) {
    perf: player_performance_v(
      where: { steam_id: { _eq: $steamId } }
      limit: 1
    ) {
      aim_rating
      positioning_rating
      utility_rating
      accuracy_score
      hs_score
      spotted_score
      crosshair_score
      ttd_score
      counter_strafe_score
      survival_score
      traded_score
      kast_score
      flash_assists_score
      blind_score
      util_eff_score
    }
    matches: player_match_performance_v(
      where: $where
      order_by: { played_at: desc }
      limit: $limit
    ) {
      aim_rating
      positioning_rating
      utility_rating
    }
  }
`;

const {
  enabled: compareEnabled,
  comparePlayer,
  compareData,
} = usePlayerComparison(
  COMPARE_QUERY,
  (steamId) => ({
    steamId,
    where: buildWhere(steamId),
    limit: props.limit ?? RECENT_WINDOW,
  }),
  (data: any) => ({
    perf: (data?.perf?.[0] ?? null) as Record<string, any> | null,
    matches: (data?.matches ?? []) as Array<Record<string, any>>,
  }),
  () => [props.source, props.limit],
);

function avgOf(rows: Array<Record<string, any>>, key: string): number | null {
  const xs = rows
    .filter((r) => r[key] != null)
    .map((r) => Number(r[key]))
    .filter((n) => !Number.isNaN(n));
  if (!xs.length) {
    return null;
  }
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

function recentAvg(key: string): number | null {
  return avgOf(matchRows.value, key);
}

function compareAvg(key: string): number | null {
  if (!compareEnabled.value || !compareData.value) {
    return null;
  }
  return avgOf(compareData.value.matches, key);
}

function compareScore(key: string): number | null {
  if (!compareEnabled.value || !compareData.value?.perf) {
    return null;
  }
  const v = compareData.value.perf[key];
  return v == null ? null : Number(v);
}

const categories = computed(() => [
  {
    key: "aim",
    label: t("player.performance.categories.aim"),
    you: recentAvg("aim_rating"),
    other: compareAvg("aim_rating"),
    provisional: false,
  },
  {
    key: "positioning",
    label: t("player.performance.categories.positioning"),
    you: recentAvg("positioning_rating"),
    other: compareAvg("positioning_rating"),
    provisional: false,
  },
  {
    key: "utility",
    label: t("player.performance.categories.utility"),
    you: recentAvg("utility_rating"),
    other: compareAvg("utility_rating"),
    provisional: true,
  },
]);

const hasData = computed(
  () =>
    matchRows.value.length > 0 && categories.value.some((c) => c.you != null),
);

function tier(v: number | null | undefined) {
  if (v == null) return { label: "—", cls: "text-muted-foreground" };
  if (v >= 80)
    return { label: t("player.performance.tiers.elite"), cls: "text-success" };
  if (v >= 60)
    return {
      label: t("player.performance.tiers.good"),
      cls: "text-[hsl(var(--tac-amber))]",
    };
  if (v >= 40)
    return {
      label: t("player.performance.tiers.average"),
      cls: "text-foreground",
    };
  return {
    label: t("player.performance.tiers.subpar"),
    cls: "text-destructive",
  };
}

const categoryIcon: Record<string, any> = {
  aim: Crosshair,
  positioning: MapPin,
  utility: Bomb,
};

const focusAreas = computed(() => {
  if (!row.value) return [];
  return SUBMETRICS.map((m) => ({
    ...m,
    score: row.value?.[m.key] as number | null,
    other: compareScore(m.key),
  }))
    .filter((m) => m.score != null)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, 3);
});

const chartData = computed(() => {
  const datasets: any[] = [
    {
      label: t("player.performance.you"),
      data: categories.value.map((c) => c.you ?? 0),
      borderColor: COLOR_YOU,
      backgroundColor: COLOR_YOU_FILL,
      pointBackgroundColor: COLOR_YOU,
      borderWidth: 2,
      pointRadius: 3,
    },
  ];
  if (compareEnabled.value && categories.value.some((c) => c.other != null)) {
    datasets.push({
      label: comparePlayer.value?.name ?? t("player.performance.compare"),
      data: categories.value.map((c) => c.other ?? 0),
      borderColor: COLOR_COMPARE,
      backgroundColor: COLOR_COMPARE_FILL,
      pointBackgroundColor: COLOR_COMPARE,
      borderWidth: 2,
      pointRadius: 3,
    });
  }
  return { labels: categories.value.map((c) => c.label), datasets };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: compareEnabled.value,
      labels: { color: "rgba(255,255,255,0.85)", boxWidth: 12 },
    },
  },
  scales: {
    r: {
      min: 0,
      max: 100,
      angleLines: { color: "rgba(255,255,255,0.16)" },
      grid: { color: "rgba(255,255,255,0.1)" },
      ticks: { display: false, stepSize: 25 },
      pointLabels: {
        color: "rgba(255,255,255,0.85)",
        font: { size: 13, family: "'Oxanium', sans-serif" },
      },
    },
  },
}));
</script>

<template>
  <Card class="bg-card/20">
    <CardContent class="p-3 sm:p-4">
      <div class="flex flex-col gap-4">
        <span :class="tacticalSectionDescriptionClasses">
          {{ $t("player.performance.description") }}
        </span>

        <template v-if="loading">
          <div class="grid gap-4 lg:grid-cols-2">
            <Skeleton class="h-[340px] w-full" />
            <div class="flex flex-col gap-2 self-center">
              <Skeleton v-for="i in 3" :key="i" class="h-24 w-full" />
            </div>
          </div>
        </template>

        <div
          v-else-if="!hasData"
          class="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
        >
          {{ $t("player.performance.not_enough_data") }}
        </div>

        <template v-else>
          <div class="grid gap-6 lg:grid-cols-2 lg:items-center">
            <div class="relative h-[260px] sm:h-[300px]">
              <Radar :data="chartData" :options="chartOptions" />
            </div>

            <div class="flex flex-col justify-center gap-3">
              <div
                v-for="c of categories"
                :key="c.key"
                class="flex items-center justify-between gap-3 rounded border border-border/60 bg-background/40 px-3 py-2"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <component
                    :is="categoryIcon[c.key]"
                    class="w-4 h-4 shrink-0 text-muted-foreground"
                  />
                  <span class="font-semibold truncate">
                    <StatLabel :stat="c.key" :label="c.label" />
                  </span>
                  <span
                    v-if="c.provisional"
                    class="shrink-0 px-1.5 py-0.5 rounded bg-muted/50 text-[0.55rem] font-mono uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {{ $t("player.performance.provisional") }}
                  </span>
                </div>
                <div
                  class="flex shrink-0 items-baseline gap-2 font-mono tabular-nums"
                >
                  <span class="text-lg font-bold" :class="tier(c.you).cls">{{
                    c.you ?? "—"
                  }}</span>
                  <span
                    v-if="compareEnabled"
                    class="text-sm font-bold"
                    :style="{ color: COLOR_COMPARE }"
                    >{{ c.other ?? "—" }}</span
                  >
                </div>
              </div>
            </div>
          </div>

          <div v-if="focusAreas.length" class="flex flex-col gap-2">
            <span :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("player.performance.focus_areas") }}
            </span>
            <div class="grid gap-3 sm:grid-cols-3">
              <div
                v-for="f of focusAreas"
                :key="f.key"
                class="flex flex-col gap-3 rounded border border-border/60 bg-background/40 p-4"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <component
                      :is="categoryIcon[f.category]"
                      class="w-4 h-4 shrink-0 text-muted-foreground"
                    />
                    <span class="font-semibold text-sm truncate">
                      <StatLabel
                        :stat="f.glossary"
                        :label="$t(`player.performance.metrics.${f.key}.label`)"
                      />
                    </span>
                  </div>
                  <div
                    class="flex shrink-0 items-baseline gap-2 font-mono leading-none tabular-nums"
                  >
                    <span
                      class="text-xl font-bold"
                      :class="tier(f.score).cls"
                      >{{ f.score }}</span
                    >
                    <span
                      v-if="compareEnabled"
                      class="text-base font-bold"
                      :style="{ color: COLOR_COMPARE }"
                      >{{ f.other ?? "—" }}</span
                    >
                  </div>
                </div>
                <p class="text-xs leading-snug text-muted-foreground">
                  {{ $t(`player.performance.metrics.${f.key}.coach`) }}
                </p>
                <StatScale
                  :stat="f.glossary"
                  :score="f.score"
                  class="mt-auto pt-2"
                />
              </div>
            </div>
          </div>
        </template>
      </div>
    </CardContent>
  </Card>
</template>
