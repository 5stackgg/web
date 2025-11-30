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
  Legend
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
  },
  apollo: {
    v_player_map_wins: {
      query: generateQuery({
        v_player_map_wins: [
          {
            where: {
              steam_id: {
                _eq: $("steam_id", "bigint"),
              },
            },
          },
          {
            steam_id: true,
            map: {
              name: true,
              label: true,
            },
          },
        ],
      }),
      variables() {
        return {
          steam_id: this.steam_id || this.me?.steam_id,
        };
      },
    },
    v_player_map_losses: {
      query: generateQuery({
        v_player_map_losses: [
          {
            where: {
              steam_id: {
                _eq: $("steam_id", "bigint"),
              },
            },
          },
          {
            steam_id: true,
            map: {
              name: true,
              label: true,
            },
          },
        ],
      }),
      variables() {
        return {
          steam_id: this.steam_id || this.me?.steam_id,
        };
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

      const wins: Map<string, number> = new Map();
      const losses: Map<string, number> = new Map();

      for (const win of this.v_player_map_wins) {
        if (!win.map) {
          continue;
        }
        const mapName = cleanMapName(win.map.label || win.map.name);
        if (wins.has(mapName)) {
          wins.set(mapName, wins.get(mapName)! + 1);
          continue;
        }
        wins.set(mapName, 1);
      }

      for (const loss of this.v_player_map_losses) {
        if (!loss.map) {
          continue;
        }
        const mapName = cleanMapName(loss.map.label || loss.map.name);
        if (losses.has(mapName)) {
          losses.set(mapName, losses.get(mapName)! + 1);
          continue;
        }
        losses.set(mapName, 1);
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
                  label: "Wins",
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
                  label: "Losses",
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
