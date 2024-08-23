<script setup lang="ts">
import { e_game_server_node_statuses_enum } from "~/generated/zeus";
</script>

<template>
  <div>
    <span
      class="ml-1 inline-block h-2 w-2 rounded-full"
      :class="{
        ['bg-red-600']:
          gameServerNode.status === e_game_server_node_statuses_enum.Offline,
        ['bg-green-600']:
          gameServerNode.status === e_game_server_node_statuses_enum.Online,
        ['bg-yellow-600']:
          gameServerNode.status === e_game_server_node_statuses_enum.Setup ||
          gameServerNode.status ===
            e_game_server_node_statuses_enum.NotAcceptingNewMatches,
      }"
    >
    </span>
    {{ gameServerNode.id || gameServerNode.e_region.description }}
  </div>
</template>

<script lang="ts">
export default {
  props: {
    gameServerNode: {
      type: Object,
      required: true,
    },
  },
};
</script>
