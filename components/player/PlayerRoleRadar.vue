<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
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
import { playerRolesQuery } from "~/graphql/playerMatchMapRolesGraphql";
import { usePlayerCompareTarget } from "~/composables/usePlayerCompareTarget";
import { normalizeViewRole, type CombatRole } from "~/utilities/roleClassify";
import { Card, CardContent } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { Skeleton } from "~/components/ui/skeleton";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

type RoleKey = "all" | CombatRole;

interface MapRecord {
  role: CombatRole;
  rounds: number;
  kills: number;
  deaths: number;
  openKills: number;
  openDeaths: number;
  openingAttempts: number;
  tradeKills: number;
  tradedDeaths: number;
  flashAssists: number;
  utilDamage: number;
  rating: number;
  adr: number;
  kast: number;
}

const props = defineProps<{
  steamId: string;
  name?: string | null;
  matchType?: string | string[] | null;
  source?: string | null;
  limit?: number | null;
  since?: string | null;
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();
const { compareTarget } = usePlayerCompareTarget();

const WINDOW_MAPS = 60;

const COLOR_A_LINE = "#fbbf24";
const COLOR_A_FILL = "rgba(251, 191, 36, 0.22)";
const COLOR_B_LINE = "#38bdf8";
const COLOR_B_FILL = "rgba(56, 189, 248, 0.22)";

interface AxisDef {
  key: string;
  label: string;
  max: number;
  inverted?: boolean;
  decimals: number;
  format?: (v: number) => string;
}

const axisDefs: AxisDef[] = [
  { key: "rating", label: t("match.radar.axes.rating"), max: 2.0, decimals: 2 },
  { key: "adr", label: t("match.radar.axes.adr"), max: 120, decimals: 1 },
  { key: "opening_attempts", label: t("match.radar.axes.opening_attempts"), max: 50, decimals: 1 },
  { key: "opening", label: t("match.radar.axes.opening"), max: 2.0, decimals: 2 },
  { key: "kpr", label: t("match.radar.axes.kpr"), max: 1.2, decimals: 2 },
  { key: "trade_kills", label: t("match.radar.axes.trade_kills"), max: 0.3, decimals: 2 },
  { key: "kd", label: t("match.radar.axes.kd"), max: 2.0, decimals: 2 },
  { key: "traded", label: t("match.radar.axes.traded"), max: 0.4, decimals: 2 },
  { key: "dpr", label: t("match.radar.axes.dpr"), max: 1.0, inverted: true, decimals: 2 },
  { key: "udr", label: t("match.radar.axes.udr"), max: 15, decimals: 1 },
  { key: "flash_assists", label: t("match.radar.axes.flash_assists"), max: 0.3, decimals: 2 },
  { key: "kast", label: t("match.radar.axes.kast"), max: 100, decimals: 0, format: (v) => `${Math.round(v)}%` },
];

const ROLE_ORDER: CombatRole[] = ["sniper", "entry", "support", "rifler"];

const loading = ref(true);
const roleFilter = ref<RoleKey>("all");
const playerMaps = ref<MapRecord[]>([]);
const compareMaps = ref<MapRecord[]>([]);

function buildMatchesWhere() {
  const where: Record<string, any> = { status: { _eq: "Finished" } };
  if (props.source && props.source !== "all") {
    where.source =
      props.source === "external" ? { _neq: "5stack" } : { _eq: "5stack" };
  }
  if (props.matchType) {
    where.options = {
      type: {
        _in: Array.isArray(props.matchType)
          ? props.matchType
          : [props.matchType],
      },
    };
  }
  if (props.since) {
    where.started_at = { _gte: props.since };
  }
  return where;
}

async function loadMaps(steamId: string): Promise<MapRecord[]> {
  const { data } = await apolloClient.query({
    query: playerRolesQuery,
    variables: {
      steamId,
      where: buildMatchesWhere(),
      limit: props.limit ?? WINDOW_MAPS,
    },
    fetchPolicy: "network-only",
  });
  const rows = ((data as any)?.v_player_match_map_roles ?? []) as any[];
  return rows
    .map((r) => ({
      role: normalizeViewRole(r.role),
      rounds: Number(r.rounds ?? 0),
      kills: Number(r.kills ?? 0),
      deaths: Number(r.deaths ?? 0),
      openKills: Number(r.open_kills ?? 0),
      openDeaths: Number(r.open_deaths ?? 0),
      openingAttempts: Number(r.opening_attempts ?? 0),
      tradeKills: Number(r.trade_kill_successes ?? 0),
      tradedDeaths: Number(r.traded_death_successes ?? 0),
      flashAssists: Number(r.flash_assists ?? 0),
      utilDamage: Number(r.util_damage ?? 0),
      rating: Number(r.hltv_rating ?? 0),
      adr: Number(r.adr ?? 0),
      kast: Number(r.kast_pct ?? 0),
    }))
    .filter((m) => m.rounds > 0);
}

let loadGen = 0;

async function loadAll() {
  if (!props.steamId) {
    playerMaps.value = [];
    compareMaps.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  const gen = ++loadGen;
  try {
    const mine = await loadMaps(props.steamId);
    if (gen !== loadGen) {
      return;
    }
    playerMaps.value = mine;
    const compareId = compareTarget.value?.steam_id
      ? String(compareTarget.value.steam_id)
      : null;
    compareMaps.value = compareId ? await loadMaps(compareId) : [];
  } catch {
    if (gen === loadGen) {
      playerMaps.value = [];
      compareMaps.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(
  () => [
    props.steamId,
    props.source,
    props.matchType,
    props.limit,
    props.since,
    compareTarget.value?.steam_id,
  ],
  loadAll,
  { immediate: true },
);

function aggregate(maps: MapRecord[]): Record<string, number | null> | null {
  if (!maps.length) {
    return null;
  }
  const sum = {
    rounds: 0,
    kills: 0,
    deaths: 0,
    openKills: 0,
    openDeaths: 0,
    openingAttempts: 0,
    tradeKills: 0,
    tradedDeaths: 0,
    flashAssists: 0,
    utilDamage: 0,
    wRating: 0,
    wAdr: 0,
    wKast: 0,
  };
  for (const m of maps) {
    sum.rounds += m.rounds;
    sum.kills += m.kills;
    sum.deaths += m.deaths;
    sum.openKills += m.openKills;
    sum.openDeaths += m.openDeaths;
    sum.openingAttempts += m.openingAttempts;
    sum.tradeKills += m.tradeKills;
    sum.tradedDeaths += m.tradedDeaths;
    sum.flashAssists += m.flashAssists;
    sum.utilDamage += m.utilDamage;
    sum.wRating += m.rating * m.rounds;
    sum.wAdr += m.adr * m.rounds;
    sum.wKast += m.kast * m.rounds;
  }
  if (sum.rounds <= 0) {
    return null;
  }
  return {
    rating: sum.wRating / sum.rounds,
    adr: sum.wAdr / sum.rounds,
    opening_attempts: (sum.openingAttempts / sum.rounds) * 100,
    opening:
      sum.openDeaths > 0
        ? sum.openKills / sum.openDeaths
        : sum.openKills > 0
          ? sum.openKills
          : 0,
    kpr: sum.kills / sum.rounds,
    trade_kills: sum.tradeKills / sum.rounds,
    kd: sum.deaths > 0 ? sum.kills / sum.deaths : sum.kills,
    traded: sum.tradedDeaths / sum.rounds,
    dpr: sum.deaths / sum.rounds,
    udr: sum.utilDamage / sum.rounds,
    flash_assists: sum.flashAssists / sum.rounds,
    kast: sum.wKast / sum.rounds,
  };
}

function filterRole(maps: MapRecord[]): MapRecord[] {
  if (roleFilter.value === "all") {
    return maps;
  }
  return maps.filter((m) => m.role === roleFilter.value);
}

const metricsA = computed(() => aggregate(filterRole(playerMaps.value)));
const metricsB = computed(() => aggregate(filterRole(compareMaps.value)));

const roleCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const m of playerMaps.value) {
    counts[m.role] = (counts[m.role] ?? 0) + 1;
  }
  return counts;
});

const rolePills = computed(() => [
  { key: "all" as RoleKey, label: t("role_radar.all"), count: playerMaps.value.length },
  ...ROLE_ORDER.map((role) => ({
    key: role as RoleKey,
    label: t(`match.roles.names.${role}`),
    count: roleCounts.value[role] ?? 0,
  })),
]);

const roleFilterOptions = computed(() =>
  rolePills.value.map((p) => ({
    key: p.key,
    label: p.label,
    count: p.count,
    disabled: p.key !== "all" && p.count === 0,
  })),
);

const activeAxes = computed(() =>
  axisDefs.filter((axis) => {
    const a = metricsA.value?.[axis.key];
    const b = metricsB.value?.[axis.key];
    return a != null || b != null;
  }),
);

function normalize(axis: AxisDef, value: number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, value / axis.max));
  return Math.round((axis.inverted ? 1 - clamped : clamped) * 100);
}

function displayValue(axis: AxisDef, value: number | null | undefined): string {
  if (value == null) {
    return "—";
  }
  if (axis.format) {
    return axis.format(value);
  }
  return value.toFixed(axis.decimals);
}

const compareName = computed(() => compareTarget.value?.name ?? null);
const playerName = computed(() => props.name ?? t("match.radar.player_a"));

const chartData = computed(() => {
  if (!activeAxes.value.length) {
    return null;
  }
  const datasets: any[] = [
    {
      label: playerName.value,
      data: activeAxes.value.map((a) => normalize(a, metricsA.value?.[a.key])),
      borderColor: COLOR_A_LINE,
      backgroundColor: COLOR_A_FILL,
      pointBackgroundColor: COLOR_A_LINE,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
    },
  ];
  if (metricsB.value) {
    datasets.push({
      label: compareName.value ?? t("match.radar.player_b"),
      data: activeAxes.value.map((a) => normalize(a, metricsB.value?.[a.key])),
      borderColor: COLOR_B_LINE,
      backgroundColor: COLOR_B_FILL,
      pointBackgroundColor: COLOR_B_LINE,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
    });
  }
  return { labels: activeAxes.value.map((a) => a.label), datasets };
});

const chartOptions = computed(() => {
  const self = activeAxes.value;
  const mA = metricsA.value;
  const mB = metricsB.value;
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          font: { size: 12, family: "'Oxanium', sans-serif" },
          usePointStyle: true,
          pointStyle: "rectRot",
          boxWidth: 10,
          boxHeight: 10,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: "rgba(20, 22, 28, 0.96)",
        borderColor: COLOR_A_LINE,
        borderWidth: 1,
        titleColor: "rgba(255, 255, 255, 0.9)",
        bodyColor: "rgba(255, 255, 255, 0.85)",
        padding: 10,
        cornerRadius: 2,
        callbacks: {
          label: (item: any) => {
            const axis = self[item.dataIndex];
            if (!axis) {
              return "";
            }
            const metrics = item.datasetIndex === 0 ? mA : mB;
            return `${item.dataset.label}: ${displayValue(axis, metrics?.[axis.key])}`;
          },
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        angleLines: { color: "rgba(255, 255, 255, 0.16)" },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
        ticks: { display: false, stepSize: 25 },
        pointLabels: {
          color: "rgba(255, 255, 255, 0.78)",
          font: { size: 11, family: "'Oxanium', sans-serif" },
        },
      },
    },
  };
});

function betterSide(axis: AxisDef): "a" | "b" | null {
  const a = metricsA.value?.[axis.key];
  const b = metricsB.value?.[axis.key];
  if (a == null || b == null) {
    return null;
  }
  if (a === b) {
    return null;
  }
  if (axis.inverted) {
    return a < b ? "a" : "b";
  }
  return a > b ? "a" : "b";
}

const hasData = computed(() => playerMaps.value.length > 0);
</script>

<template>
  <Card class="bg-card/20">
    <CardContent class="p-3 sm:p-4">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1">
            <span :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("role_radar.radar_title") }}
            </span>
            <span :class="tacticalSectionDescriptionClasses">
              {{ $t("role_radar.radar_description") }}
            </span>
          </div>
          <AnimatedFilters
            :model-value="roleFilter"
            :options="roleFilterOptions"
            @update:model-value="(v) => (roleFilter = v as RoleKey)"
          />
        </div>

        <FadeSwap>
        <div v-if="loading" key="skeleton" class="grid gap-4 lg:grid-cols-2">
          <div class="flex h-[360px] items-center justify-center sm:h-[440px]">
            <Skeleton class="aspect-square h-[280px] rounded-full sm:h-[340px]" />
          </div>
          <div class="flex flex-col gap-2 self-center">
            <Skeleton class="h-10 w-full" />
            <Skeleton
              v-for="i in 6"
              :key="i"
              class="h-9 w-full"
            />
          </div>
        </div>

        <div
          v-else-if="!hasData || !chartData"
          key="empty"
          class="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
        >
          {{ $t("role_radar.no_data") }}
        </div>

        <div v-else key="content" class="grid gap-4 lg:grid-cols-2">
          <div class="relative h-[360px] sm:h-[440px]">
            <Radar :data="chartData" :options="chartOptions" />
          </div>

          <Table class="min-w-full self-center [&_td]:px-2 [&_th]:px-2">
            <TableHeader class="[&_th]:h-10 bg-muted/20">
              <TableRow>
                <TableHead class="text-left">
                  {{ $t("match.radar.metric") }}
                </TableHead>
                <TableHead class="text-right whitespace-nowrap text-amber-400">
                  {{ playerName }}
                </TableHead>
                <TableHead
                  v-if="metricsB"
                  class="text-right whitespace-nowrap text-sky-400"
                >
                  {{ compareName || $t("match.radar.player_b") }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="axis of activeAxes" :key="axis.key">
                <TableCell class="text-left text-muted-foreground whitespace-nowrap">
                  {{ axis.label }}
                </TableCell>
                <TableCell
                  class="text-right font-mono tabular-nums"
                  :class="
                    betterSide(axis) === 'a'
                      ? 'font-bold text-amber-400'
                      : 'text-foreground'
                  "
                >
                  {{ displayValue(axis, metricsA?.[axis.key]) }}
                </TableCell>
                <TableCell
                  v-if="metricsB"
                  class="text-right font-mono tabular-nums"
                  :class="
                    betterSide(axis) === 'b'
                      ? 'font-bold text-sky-400'
                      : 'text-foreground'
                  "
                >
                  {{ displayValue(axis, metricsB?.[axis.key]) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        </FadeSwap>
      </div>
    </CardContent>
  </Card>
</template>
