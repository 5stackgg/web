<script setup lang="ts">
import { e_game_server_node_statuses_enum } from "~/generated/zeus";
</script>

<template>
  <div class="flex gap-2 items-center">
    <div
      class="h-2 w-2 rounded-full relative"
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
      <span
        class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        :class="{
          ['bg-red-400']:
            gameServerNode.status === e_game_server_node_statuses_enum.Offline,
          ['bg-yellow-400']:
            gameServerNode.status === e_game_server_node_statuses_enum.Setup ||
            gameServerNode.status ===
              e_game_server_node_statuses_enum.NotAcceptingNewMatches,
        }"
        v-if="gameServerNode.status !== e_game_server_node_statuses_enum.Online"
      ></span>
    </div>
    <span class="truncate">
      {{ gameServerNode.id || gameServerNode?.e_region?.description }}
    </span>
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
