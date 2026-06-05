<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "vue-chartjs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import cleanMapName from "~/utilities/cleanMapName";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const AMBER = "#fbbf24";
const CYAN = "#38bdf8";
const ECO_MAX = 5000;
const FULL_MIN = 20000;

const props = defineProps<{
  match: any;
  selectedMapId?: string | null;
}>();

const { t } = useI18n();

interface RoundEntry {
  round: number;
  lineup_1_money: number | null;
  lineup_2_money: number | null;
  winning_side: string | null;
  lineup_1_side: string | null;
  lineup_2_side: string | null;
}

const statsMaps = computed(() => {
  const maps = (props.match?.match_maps ?? []) as any[];
  return maps.filter((m) => (m.rounds ?? []).length > 0);
});

const localMapId = ref<string | null>(null);

watch(
  () => props.selectedMapId,
  (value) => {
    localMapId.value = value ?? null;
  },
  { immediate: true },
);

const activeMapId = computed<string | null>(() => {
  if (localMapId.value) {
    const exists = statsMaps.value.some((m) => m.id === localMapId.value);
    if (exists) {
      return localMapId.value;
    }
  }
  return statsMaps.value[0]?.id ?? null;
});

const activeMap = computed(() => {
  return statsMaps.value.find((m) => m.id === activeMapId.value) ?? null;
});

const lineup1Id = computed<string | null>(
  () => props.match?.lineup_1_id ?? null,
);

const lineup1Name = computed(
  () => props.match?.lineup_1?.name ?? t("match.economy.team_1"),
);

const lineup2Name = computed(
  () => props.match?.lineup_2?.name ?? t("match.economy.team_2"),
);

function normalizeSide(value: string | null | undefined): string | null {
  if (value === "T") {
    return "TERRORIST";
  }
  return value ?? null;
}

const rounds = computed<RoundEntry[]>(() => {
  const list = (activeMap.value?.rounds ?? []) as RoundEntry[];
  return [...list]
    .filter((r) => r.round > 0)
    .sort((a, b) => a.round - b.round);
});

function moneyOf(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const hasData = computed(() => {
  return rounds.value.some(
    (r) => moneyOf(r.lineup_1_money) !== null || moneyOf(r.lineup_2_money) !== null,
  );
});

function roundWinner(round: RoundEntry): 1 | 2 | null {
  const winning = normalizeSide(round.winning_side);
  if (!winning) {
    return null;
  }
  if (normalizeSide(round.lineup_1_side) === winning) {
    return 1;
  }
  if (normalizeSide(round.lineup_2_side) === winning) {
    return 2;
  }
  return null;
}

const chartData = computed(() => {
  const labels = rounds.value.map((r) => r.round);

  const pointColorsFor = (lineup: 1 | 2) => {
    const base = lineup === 1 ? AMBER : CYAN;
    return rounds.value.map((r) => {
      const winner = roundWinner(r);
      if (winner === lineup) {
        return base;
      }
      return "rgba(255, 255, 255, 0.25)";
    });
  };

  return {
    labels,
    datasets: [
      {
        label: lineup1Name.value,
        data: rounds.value.map((r) => moneyOf(r.lineup_1_money)),
        borderColor: AMBER,
        backgroundColor: "rgba(251, 191, 36, 0.08)",
        borderWidth: 2,
        tension: 0.3,
        spanGaps: true,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: pointColorsFor(1),
        pointBorderColor: AMBER,
        pointBorderWidth: 1.5,
      },
      {
        label: lineup2Name.value,
        data: rounds.value.map((r) => moneyOf(r.lineup_2_money)),
        borderColor: CYAN,
        backgroundColor: "rgba(56, 189, 248, 0.08)",
        borderWidth: 2,
        tension: 0.3,
        spanGaps: true,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: pointColorsFor(2),
        pointBorderColor: CYAN,
        pointBorderWidth: 1.5,
      },
    ],
  };
});

const chartOptions = computed(() => {
  const self = {
    rounds: rounds.value,
    l1: lineup1Name.value,
    l2: lineup2Name.value,
    winLabel: (winner: 1 | 2 | null) => {
      if (winner === 1) {
        return lineup1Name.value;
      }
      if (winner === 2) {
        return lineup2Name.value;
      }
      return t("match.economy.no_winner");
    },
  };

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          usePointStyle: true,
          pointStyle: "rectRounded",
          boxWidth: 10,
          boxHeight: 10,
          padding: 16,
          font: {
            size: 11,
            family: "'Oxanium', sans-serif",
          },
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(20, 22, 28, 0.96)",
        borderColor: AMBER,
        borderWidth: 1,
        titleColor: "rgba(255, 255, 255, 0.9)",
        titleFont: {
          size: 11,
          weight: "600",
          family: "'Oxanium', sans-serif",
        },
        bodyColor: "rgba(255, 255, 255, 0.85)",
        bodyFont: {
          size: 12,
          family: "'Oxanium', sans-serif",
        },
        padding: 10,
        cornerRadius: 2,
        callbacks: {
          title: (items: any[]) => {
            const round = items?.[0]?.label;
            return t("common.round", { number: round });
          },
          label: (item: any) => {
            const money =
              typeof item.parsed?.y === "number"
                ? `$${item.parsed.y.toLocaleString()}`
                : "—";
            return `${item.dataset.label}   ${money}`;
          },
          afterBody: (items: any[]) => {
            const index = items?.[0]?.dataIndex;
            const round = self.rounds[index];
            if (!round) {
              return "";
            }
            return t("match.economy.round_won_by", {
              team: self.winLabel(roundWinner(round)),
            });
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(255, 255, 255, 0.06)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          font: { size: 11 },
          padding: 8,
          callback: (value: any) => `$${Number(value).toLocaleString()}`,
        },
      },
      x: {
        grid: { display: false },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          font: { size: 11 },
          padding: 8,
          autoSkip: true,
          maxTicksLimit: 16,
        },
      },
    },
    layout: {
      padding: { right: 12, top: 6, bottom: 6, left: 6 },
    },
  };
});

const buyBandPlugin = {
  id: "economyBuyBands",
  beforeDatasetsDraw: (chart: any) => {
    const yScale = chart.scales?.y;
    const area = chart.chartArea;
    if (!yScale || !area) {
      return;
    }
    const ctx = chart.ctx;
    ctx.save();

    const ecoTop = yScale.getPixelForValue(ECO_MAX);
    if (ecoTop < area.bottom) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.06)";
      ctx.fillRect(
        area.left,
        Math.max(ecoTop, area.top),
        area.right - area.left,
        area.bottom - Math.max(ecoTop, area.top),
      );
    }

    const fullTop = yScale.getPixelForValue(FULL_MIN);
    if (fullTop > area.top) {
      ctx.fillStyle = "rgba(34, 197, 94, 0.06)";
      ctx.fillRect(
        area.left,
        area.top,
        area.right - area.left,
        Math.min(fullTop, area.bottom) - area.top,
      );
    }

    ctx.restore();
  },
};

const plugins = [buyBandPlugin];

function onMapSelect(value: string) {
  localMapId.value = value;
}
</script>

<template>
  <Card class="bg-card/20">
    <CardHeader class="pb-2">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle
            :class="[tacticalSectionLabelClasses, 'mb-0 flex items-center']"
          >
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("match.economy.section") }}
          </CardTitle>
          <div :class="tacticalSectionDescriptionClasses">
            {{ $t("match.economy.description") }}
          </div>
        </div>
        <Select
          v-if="statsMaps.length > 1"
          :model-value="activeMapId ?? undefined"
          @update:model-value="onMapSelect"
        >
          <SelectTrigger class="w-[180px]">
            <SelectValue :placeholder="$t('match.economy.select_map')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="m of statsMaps" :key="m.id" :value="m.id">
              {{ cleanMapName(m.map.name) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </CardHeader>
    <CardContent>
      <Empty v-if="!hasData" class="min-h-[200px]">
        <EmptyTitle>{{ $t("match.economy.empty_title") }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("match.economy.empty_description") }}
        </EmptyDescription>
      </Empty>
      <div v-else class="h-[320px]">
        <Line :data="chartData" :options="chartOptions" :plugins="plugins" />
      </div>
    </CardContent>
  </Card>
</template>
