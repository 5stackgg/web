<script lang="ts" setup>
import MatchMakingRegion from "./MatchMakingRegion.vue";
</script>

<template>
  <div>
    <MatchMakingRegion
      :region="region"
      v-for="region in regions"
    ></MatchMakingRegion>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  apollo: {
    $subscribe: {
      e_game_server_node_regions: {
        query: typedGql("subscription")({
          e_game_server_node_regions: [
            {
              where: {
                total_server_count: {
                  _gt: 0,
                },
              },
            },
            {
              value: true,
              description: true,
            },
          ],
        }),
        result({ data }) {
          this.regions = data.e_game_server_node_regions;
        },
      },
    },
  },
  data() {
    return {
      regions: undefined,
    };
  },
};
</script>
