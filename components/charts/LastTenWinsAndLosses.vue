<script lang="ts" setup>
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

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);
</script>

<template>
  <Radar :data="data" :options="options" v-if="data" />
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $, e_map_pool_types_enum } from "~/generated/zeus";
import cleanMapName from "~/utilities/cleanMapName";

export default {
  props: {
    steam_id: {
      type: String,
      required: false,
    },
    match_type: {
      type: String as () =>
        "Competitive" | "Wingman" | "Duel" | "Premier" | null,
      required: false,
      default: null,
    },
    // Active time window (ISO strings) — keeps the radar in sync with the
    // page range bar so it shows the same window as the other graphs.
    // Match source scope: "5stack", "external" (everything but 5stack), or
    // null for all sources.
    source: {
      type: String as () => "5stack" | "external" | null,
      required: false,
      default: null,
    },
  },
  apollo: {
    v_player_map_wins: {
      query: generateQuery({
        v_player_map_wins: [
          {
            where: $("where", "v_player_map_wins_bool_exp"),
            order_by: [{ started_at: "desc" }],
          },
          {
            steam_id: true,
            match_id: true,
            started_at: true,
            map: {
              name: true,
              label: true,
            },
          },
        ],
      }),
      variables() {
        return { where: this.mapStatsWhere };
      },
    },
    v_player_map_losses: {
      query: generateQuery({
        v_player_map_losses: [
          {
            where: $("where", "v_player_map_losses_bool_exp"),
            order_by: [{ started_at: "desc" }],
          },
          {
            steam_id: true,
            match_id: true,
            started_at: true,
            map: {
              name: true,
              label: true,
            },
          },
        ],
      }),
      variables() {
        return { where: this.mapStatsWhere };
      },
    },
    maps: {
      query: generateQuery({
        maps: [
          {
            where: {
              active_pool: {
                _eq: true,
              },
              type: {
                _eq: e_map_pool_types_enum.Competitive,
              },
            },
            order_by: [
              {
                label: "desc",
              },
              {
                name: "desc",
              },
            ],
          },
          {
            name: true,
            label: true,
          },
        ],
      }),
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    // Shared where for the win/loss views — scoped to the player, the active
    // mode (match type) and source. The radar is always the player's last 10
    // matches (most recent), independent of the page time range.
    mapStatsWhere() {
      const match: Record<string, any> = {
        options: {
          type: {
            _in: this.match_type
              ? [this.match_type]
              : ["Competitive", "Wingman", "Duel"],
          },
        },
      };
      if (this.source === "5stack") {
        match.source = { _eq: "5stack" };
      } else if (this.source === "external") {
        match.source = { _neq: "5stack" };
      }
      return {
        steam_id: { _eq: this.steam_id || this.me?.steam_id },
        match,
      };
    },
    options() {
      let maxValue = 5;

      if (this.data && this.data.datasets) {
        const allValues: number[] = [];
        this.data.datasets.forEach((dataset) => {
          if (dataset.data) {
            allValues.push(...(dataset.data as number[]));
          }
        });
        if (allValues.length > 0) {
          const calculatedMax = Math.max(...allValues);
          maxValue = Math.max(calculatedMax, 4);
        }
      }

      return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            callbacks: {
              title: (tooltipItems: any[]) => {
                if (tooltipItems.length > 0) {
                  return tooltipItems[0].label;
                }
                return "";
              },
              label: (context: any) => {
                return `${context.dataset.label}: ${context.parsed.r}`;
              },
            },
          },
        },
        elements: {
          line: {
            borderWidth: 2,
          },
          point: {
            radius: (context: any) => {
              return context.parsed.r === 0 ? 0 : 4;
            },
          },
        },
        scales: {
          r: {
            suggestedMin: -1,
            suggestedMax: maxValue,
            ticks: {
              display: false,
              stepSize: 1,
              precision: 0,
            },
            grid: {
              color: "rgba(255, 255, 255, 0.2)",
            },
            pointLabels: {
              color: "rgba(255, 255, 255, 0.9)",
              font: {
                size: 14,
              },
            },
          },
        },
      };
    },
    data() {
      if (!this.v_player_map_wins || !this.v_player_map_losses) {
        return;
      }

      // Combine both result sets, keep only the 10 most recent matches, then
      // tally wins/losses per map across those matches.
      type Row = {
        key: string;
        startedAt: string;
        mapName: string;
        result: "win" | "loss";
      };
      const rows: Row[] = [];
      const collect = (list: any[], result: "win" | "loss") => {
        for (const r of list) {
          if (!r.map) continue;
          rows.push({
            key: r.match_id ?? r.started_at,
            startedAt: r.started_at,
            mapName: cleanMapName(r.map.label || r.map.name),
            result,
          });
        }
      };
      collect(this.v_player_map_wins, "win");
      collect(this.v_player_map_losses, "loss");
      rows.sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );

      const recentMatches = new Set<string>();
      for (const r of rows) {
        if (recentMatches.size >= 10 && !recentMatches.has(r.key)) continue;
        recentMatches.add(r.key);
      }

      const wins: Map<string, number> = new Map();
      const losses: Map<string, number> = new Map();
      for (const r of rows) {
        if (!recentMatches.has(r.key)) continue;
        const bucket = r.result === "win" ? wins : losses;
        bucket.set(r.mapName, (bucket.get(r.mapName) || 0) + 1);
      }

      const allMaps = new Set<string>();
      wins.forEach((_, mapName) => allMaps.add(mapName));
      losses.forEach((_, mapName) => allMaps.add(mapName));

      // If we have fewer than 3 maps, fill with active maps
      if (allMaps.size < 3) {
        if (!this.maps) {
          return;
        }

        for (const map of this.maps) {
          const mapName = cleanMapName(map.name);
          allMaps.add(mapName);
          if (!wins.has(mapName)) {
            wins.set(mapName, 0);
          }
          if (!losses.has(mapName)) {
            losses.set(mapName, 0);
          }
          if (allMaps.size === 7) {
            break;
          }
        }
      }

      const sortedMaps = Array.from(allMaps)
        .map((mapName) => ({
          mapName,
          wins: wins.get(mapName) || 0,
          losses: losses.get(mapName) || 0,
          total: (wins.get(mapName) || 0) + (losses.get(mapName) || 0),
        }))
        .sort((a, b) => a.mapName.localeCompare(b.mapName));

      const totalWins = sortedMaps.reduce((acc, map) => acc + map.wins, 0);
      const totalLosses = sortedMaps.reduce((acc, map) => acc + map.losses, 0);

      return {
        labels: sortedMaps.map(({ mapName }) => mapName),
        datasets: [
          ...(totalWins > 0
            ? [
                {
                  label: this.$t("common.stats.wins"),
                  backgroundColor: "rgba(74, 222, 128, .5)",
                  borderColor: "rgb(74, 222, 128)",
                  pointBackgroundColor: "rgb(74, 222, 128)",
                  pointBorderColor: "#fff",
                  data: sortedMaps.map(({ wins }) => wins),
                },
              ]
            : []),
          ...(totalLosses > 0
            ? [
                {
                  label: this.$t("common.stats.losses"),
                  backgroundColor: "rgba(239, 68, 68, 0.3)",
                  borderColor: "rgb(239, 68, 68)",
                  pointBackgroundColor: "rgb(239, 68, 68)",
                  pointBorderColor: "#fff",
                  data: sortedMaps.map(({ losses }) => losses),
                },
              ]
            : []),
        ],
      };
    },
  },
};
</script>
