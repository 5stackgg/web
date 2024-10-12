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
  },
  apollo: {
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
            order_by: {
              name: "desc",
            },
          },
          {
            name: true,
          },
        ],
      }),
    },
  },
  data() {
    return {
      options: {
        events: [],
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: false,
          },
        },
        elements: {
          line: {
            borderWidth: 3,
          },
        },
        scales: {
          r: {
            suggestedMin: 0,
            suggestedMax: 10,
            beginAtZero: true,
            ticks: {
              display: false,
            },
            grid: {
              color: "rgba(255, 255, 255, 0.5)",
            },
            pointLabels: {
              font: {
                size: 14,
              },
            },
          },
        },
      },
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    data() {
      if (!this.v_player_map_losses) {
        return;
      }

      const losses: Map<string, number> = new Map();

      for (const loss of this.v_player_map_losses) {
        const mapName = cleanMapName(loss.map.name);
        if (losses.has(mapName)) {
          losses.set(mapName, losses.get(mapName)! + 1);
          continue;
        }
        losses.set(mapName, 1);
      }

      if (losses.size < 3) {
        if (!this.maps) {
          return;
        }

        for (const map of this.maps) {
          const mapName = cleanMapName(map.name);
          if (!losses.has(mapName)) {
            losses.set(mapName, 0);
          }
          if (losses.size === 7) {
            break;
          }
        }
      }

      const sortedlosses = Array.from(losses.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      return {
        labels: sortedlosses.map(([mapName]) => mapName),
        datasets: [
          {
            fill: true,
            backgroundColor: "rgba(248, 113, 113, 0.2)",
            borderColor: "rgb(248, 113, 113)",
            pointBackgroundColor: "rgb(248, 113, 113)",
            pointBorderColor: "#fff",
            data: sortedlosses.map(([, count]) => count),
          },
        ],
      };
    },
  },
};
</script>
