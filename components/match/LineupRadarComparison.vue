<script lang="ts" setup>
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const props = defineProps<{
  match: any;
  lineup: any;
  combineWith?: any;
  selectedMapId?: string | null;
  // When true, the parent owns player selection (via v-model) and the
  // built-in A/B dropdowns are hidden — used by the Head to Head tab so the
  // radar mirrors the matchup picked in the matrix above.
  hideSelectors?: boolean;
}>();

const { t } = useI18n();

const RATING_MAX = 2.0;
const KAST_MAX = 100;
const ADR_MAX = 120;
const KPR_MAX = 1.2;
const DPR_MAX = 1.0;
const KD_MAX = 2.0;
const OPENING_MAX = 2.0;
const OPENING_ATTEMPTS_MAX = 12;
const TRADE_KILLS_MAX = 0.3;
const TRADED_MAX = 0.4;
const UDR_MAX = 15;
const FLASH_ASSISTS_MAX = 0.3;

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
  { key: "rating", label: t("match.radar.axes.rating"), max: RATING_MAX, decimals: 2 },
  { key: "adr", label: t("match.radar.axes.adr"), max: ADR_MAX, decimals: 1 },
  { key: "opening_attempts", label: t("match.radar.axes.opening_attempts"), max: OPENING_ATTEMPTS_MAX, decimals: 0 },
  { key: "opening", label: t("match.radar.axes.opening"), max: OPENING_MAX, decimals: 2 },
  { key: "kpr", label: t("match.radar.axes.kpr"), max: KPR_MAX, decimals: 2 },
  { key: "trade_kills", label: t("match.radar.axes.trade_kills"), max: TRADE_KILLS_MAX, decimals: 2 },
  { key: "kd", label: t("match.radar.axes.kd"), max: KD_MAX, decimals: 2 },
  { key: "traded", label: t("match.radar.axes.traded"), max: TRADED_MAX, decimals: 2 },
  { key: "dpr", label: t("match.radar.axes.dpr"), max: DPR_MAX, inverted: true, decimals: 2 },
  { key: "udr", label: t("match.radar.axes.udr"), max: UDR_MAX, decimals: 1 },
  { key: "flash_assists", label: t("match.radar.axes.flash_assists"), max: FLASH_ASSISTS_MAX, decimals: 2 },
  { key: "kast", label: t("match.radar.axes.kast"), max: KAST_MAX, decimals: 0, format: (v) => `${Math.round(v)}%` },
];

const allPlayers = computed(() => {
  const out: any[] = [];
  const seen = new Set<string>();
  const pools = [props.lineup, props.combineWith].filter(Boolean);
  for (const lp of pools) {
    for (const member of lp.lineup_players ?? []) {
      const sid = String(member.steam_id ?? member.player?.steam_id ?? "");
      if (!sid || seen.has(sid)) {
        continue;
      }
      seen.add(sid);
      out.push({ member, lineup: lp, steamId: sid });
    }
  }
  return out;
});

const selectedA = defineModel<string | null>("selectedA", { default: null });
const selectedB = defineModel<string | null>("selectedB", { default: null });

watch(
  allPlayers,
  (players) => {
    // When the parent drives selection, don't seed our own defaults.
    if (props.hideSelectors) return;
    if (!players.length) {
      selectedA.value = null;
      selectedB.value = null;
      return;
    }
    const ids = players.map((p) => p.steamId);
    if (!selectedA.value || !ids.includes(selectedA.value)) {
      selectedA.value = ids[0];
    }
    if (!selectedB.value || !ids.includes(selectedB.value)) {
      const combineFirst = props.combineWith?.lineup_players?.[0];
      const combineId = combineFirst
        ? String(combineFirst.steam_id ?? combineFirst.player?.steam_id ?? "")
        : null;
      selectedB.value =
        combineId && ids.includes(combineId) && combineId !== selectedA.value
          ? combineId
          : (ids.find((id) => id !== selectedA.value) ?? ids[0]);
    }
  },
  { immediate: true },
);

function entryFor(steamId: string | null) {
  if (!steamId) {
    return null;
  }
  return allPlayers.value.find((p) => p.steamId === steamId) ?? null;
}

function aggregateStats(entry: any) {
  const player = entry?.member?.player;
  if (!player) {
    return null;
  }
  const mapStats: any[] = player.match_map_stats ?? [];
  const filtered = props.selectedMapId
    ? mapStats.filter((s) => s.match_map_id === props.selectedMapId)
    : mapStats;

  if (filtered.length) {
    const sum: Record<string, number> = {};
    const keys = [
      "kills",
      "deaths",
      "assists",
      "damage",
      "he_damage",
      "molotov_damage",
      "flash_assists",
      "rounds_played",
      "trade_kill_successes",
      "traded_death_successes",
    ];
    for (const key of keys) {
      sum[key] = 0;
    }
    for (const row of filtered) {
      for (const key of keys) {
        sum[key] += Number(row[key] ?? 0);
      }
    }
    return sum;
  }

  const agg = player.match_stats?.[0];
  if (!agg) {
    return null;
  }
  return {
    kills: Number(agg.kills ?? 0),
    deaths: Number(agg.deaths ?? 0),
    assists: Number(agg.assists ?? 0),
    damage: Number(agg.damage ?? 0),
    he_damage: Number(agg.he_damage ?? 0),
    molotov_damage: Number(agg.molotov_damage ?? 0),
    flash_assists: Number(agg.flash_assists ?? 0),
    rounds_played: Number(agg.rounds_played ?? 0),
    trade_kill_successes: Number(agg.trade_kill_successes ?? 0),
    traded_death_successes: Number(agg.traded_death_successes ?? 0),
  };
}

const hasRoundEvents = computed(() => {
  const maps = props.match?.match_maps ?? [];
  return maps.some(
    (m: any) => Array.isArray(m.rounds) && m.rounds.some((r: any) => Array.isArray(r.kills)),
  );
});

function filteredMatchMaps() {
  const maps = props.match?.match_maps ?? [];
  if (!props.selectedMapId) {
    return maps;
  }
  return maps.filter((m: any) => m.id === props.selectedMapId);
}

// Rounds-weighted KAST from the canonical hltv view (player.match_map_hltv),
// no round-walking.
function kastPctFor(steamId: string | null): number | null {
  const entry = entryFor(steamId);
  const rows = entry?.member?.player?.match_map_hltv ?? [];
  let weighted = 0;
  let rounds = 0;
  for (const row of rows) {
    const rp = row.rounds_played ?? 0;
    weighted += (row.kast_pct ?? 0) * rp;
    rounds += rp;
  }
  return rounds > 0 ? weighted / rounds : null;
}

function openingFromRounds(steamId: string) {
  let success = 0;
  let deaths = 0;
  for (const match_map of filteredMatchMaps()) {
    const rounds = match_map?.rounds;
    if (!Array.isArray(rounds)) {
      continue;
    }
    for (const round of rounds) {
      const firstKill = (round.kills || []).find(
        (k: any) => k.player && k.player.steam_id !== k.attacked_player?.steam_id,
      );
      if (!firstKill) {
        continue;
      }
      if (String(firstKill.player?.steam_id) === steamId) {
        success++;
      } else if (String(firstKill.attacked_player?.steam_id) === steamId) {
        deaths++;
      }
    }
  }
  return { success, deaths };
}

function metricsFor(steamId: string | null) {
  const entry = entryFor(steamId);
  const stats = aggregateStats(entry);
  if (!stats || !stats.rounds_played) {
    return null;
  }
  const rounds = stats.rounds_played;
  const kpr = stats.kills / rounds;
  const dpr = stats.deaths / rounds;
  const apr = stats.assists / rounds;
  const adr = stats.damage / rounds;

  const kastPct = kastPctFor(steamId);

  const impact = 2.13 * kpr + 0.42 * apr - 0.41;
  const rating =
    0.0073 * (kastPct ?? 0) +
    0.3591 * kpr -
    0.5329 * dpr +
    0.2372 * impact +
    0.0032 * adr +
    0.1587;

  let opening: number | null = null;
  let openingAttempts: number | null = null;
  if (hasRoundEvents.value) {
    const od = openingFromRounds(steamId!);
    openingAttempts = od.success + od.deaths;
    if (od.deaths > 0) {
      opening = od.success / od.deaths;
    } else if (od.success > 0) {
      opening = od.success;
    } else {
      opening = 0;
    }
  }

  const kd = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills;
  const tradeKills = stats.trade_kill_successes / rounds;
  const traded = stats.traded_death_successes / rounds;
  const udr = (stats.he_damage + stats.molotov_damage) / rounds;
  const flashAssists = stats.flash_assists / rounds;

  return {
    rating,
    adr,
    opening_attempts: openingAttempts,
    opening,
    kpr,
    trade_kills: tradeKills,
    kd,
    traded,
    dpr,
    udr,
    flash_assists: flashAssists,
    kast: kastPct,
  } as Record<string, number | null>;
}

const metricsA = computed(() => metricsFor(selectedA.value));
const metricsB = computed(() => metricsFor(selectedB.value));

const playerA = computed(() => entryFor(selectedA.value)?.member?.player ?? null);
const playerB = computed(() => entryFor(selectedB.value)?.member?.player ?? null);

const activeAxes = computed(() =>
  axisDefs.filter((axis) => {
    const a = metricsA.value?.[axis.key];
    const b = metricsB.value?.[axis.key];
    return (a !== null && a !== undefined) || (b !== null && b !== undefined);
  }),
);

function normalize(axis: AxisDef, value: number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const ratio = value / axis.max;
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round((axis.inverted ? 1 - clamped : clamped) * 100);
}

function displayValue(axis: AxisDef, value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (axis.format) {
    return axis.format(value);
  }
  return value.toFixed(axis.decimals);
}

const chartData = computed(() => {
  if (!activeAxes.value.length) {
    return null;
  }
  return {
    labels: activeAxes.value.map((a) => a.label),
    datasets: [
      {
        label: playerA.value?.name ?? t("match.radar.player_a"),
        data: activeAxes.value.map((a) => normalize(a, metricsA.value?.[a.key])),
        borderColor: COLOR_A_LINE,
        backgroundColor: COLOR_A_FILL,
        pointBackgroundColor: COLOR_A_LINE,
        pointBorderColor: COLOR_A_LINE,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: playerB.value?.name ?? t("match.radar.player_b"),
        data: activeAxes.value.map((a) => normalize(a, metricsB.value?.[a.key])),
        borderColor: COLOR_B_LINE,
        backgroundColor: COLOR_B_FILL,
        pointBackgroundColor: COLOR_B_LINE,
        pointBorderColor: COLOR_B_LINE,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };
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
        borderColor: "#fbbf24",
        borderWidth: 1,
        titleColor: "rgba(255, 255, 255, 0.9)",
        titleFont: { size: 11, weight: "600", family: "'Oxanium', sans-serif" },
        bodyColor: "rgba(255, 255, 255, 0.85)",
        bodyFont: { size: 12, family: "'Oxanium', sans-serif" },
        padding: 10,
        cornerRadius: 2,
        callbacks: {
          label: (item: any) => {
            const axis = self[item.dataIndex];
            if (!axis) {
              return "";
            }
            const metrics = item.datasetIndex === 0 ? mA : mB;
            const raw = metrics?.[axis.key];
            return `${item.dataset.label}: ${displayValue(axis, raw)}`;
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
        ticks: {
          display: false,
          stepSize: 25,
        },
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
  if (a === null || a === undefined || b === null || b === undefined) {
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
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <span :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("match.radar.title") }}
      </span>
    </div>

    <div v-if="!hideSelectors" class="grid gap-3 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <span
          class="font-mono text-[0.6rem] font-bold tracking-[0.24em] uppercase text-amber-400"
        >
          {{ $t("match.radar.player_a") }}
        </span>
        <Select v-model="selectedA">
          <SelectTrigger class="w-full">
            <SelectValue :placeholder="$t('match.radar.select_player')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="entry of allPlayers"
                :key="entry.steamId"
                :value="entry.steamId"
              >
                {{ entry.member.player?.name ?? entry.member.placeholder_name }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div class="flex flex-col gap-1.5">
        <span
          class="font-mono text-[0.6rem] font-bold tracking-[0.24em] uppercase text-sky-400"
        >
          {{ $t("match.radar.player_b") }}
        </span>
        <Select v-model="selectedB">
          <SelectTrigger class="w-full">
            <SelectValue :placeholder="$t('match.radar.select_player')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="entry of allPlayers"
                :key="entry.steamId"
                :value="entry.steamId"
              >
                {{ entry.member.player?.name ?? entry.member.placeholder_name }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div
      v-if="!chartData"
      class="flex items-center justify-center rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
    >
      {{ $t("match.radar.no_data") }}
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <Card class="bg-card/20">
        <CardHeader class="pb-2">
          <CardTitle class="flex items-center justify-between gap-4 text-sm">
            <PlayerDisplay
              v-if="playerA"
              :player="playerA"
              size="xs"
              :show-flag="false"
              :show-role="false"
              :linkable="true"
            />
            <span class="text-muted-foreground">{{ $t("match.radar.vs") }}</span>
            <PlayerDisplay
              v-if="playerB"
              :player="playerB"
              size="xs"
              :show-flag="false"
              :show-role="false"
              :linkable="true"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="relative h-[360px] sm:h-[420px]">
            <Radar :data="chartData" :options="chartOptions" />
          </div>
        </CardContent>
      </Card>

      <Card class="bg-card/20">
        <CardContent class="p-1 sm:p-2">
          <Table class="min-w-full [&_td]:px-2 [&_th]:px-2">
            <TableHeader class="[&_th]:h-10 bg-muted/20">
              <TableRow>
                <TableHead class="text-left whitespace-nowrap">
                  {{ $t("match.radar.metric") }}
                </TableHead>
                <TableHead class="text-right whitespace-nowrap text-amber-400">
                  {{ (playerA && playerA.name) || $t("match.radar.player_a") }}
                </TableHead>
                <TableHead class="text-right whitespace-nowrap text-sky-400">
                  {{ (playerB && playerB.name) || $t("match.radar.player_b") }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="axis of activeAxes" :key="axis.key">
                <TableCell class="text-left text-muted-foreground whitespace-nowrap">
                  <StatLabel :stat="axis.key" :label="axis.label" />
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
        </CardContent>
      </Card>
    </div>
  </div>
</template>
