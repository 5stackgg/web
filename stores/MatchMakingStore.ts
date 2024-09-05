import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import {
  e_game_server_node_regions_enum,
  e_match_types_enum,
} from "~/generated/zeus";
import socket from "~/web-sockets/Socket";

export const useMatchMakingStore = defineStore("match-making", () => {
  const joinedMatchmakingQueues = ref<
    Array<{
      totalInQueue: number;
      type: e_match_types_enum;
      region: e_game_server_node_regions_enum;
    }>
  >([]);

  const regionStats = ref<
    Partial<
      Record<
        e_game_server_node_regions_enum,
        Partial<Record<e_match_types_enum, number>>
      >
    >
  >({});

  socket.listen("match-making:region-stats", (data) => {
    regionStats.value = data;
  });

  socket.listen(
    "match-making:joined",
    (
      data: Array<{
        totalInQueue: number;
        type: e_match_types_enum;
        region: e_game_server_node_regions_enum;
      }>,
    ) => {
      console.info("I AM DATA", data);
      joinedMatchmakingQueues.value = data;
    },
  );

  socket.listen("match-making:confirmation", (data) => {
    // You might want to update the queue status here if needed
  });

  socket.listen("match-making:match-created", (data) => {
    // Remove the queue from joinedMatchmakingQueues when a match is created
    // joinedMatchmakingQueues.value = joinedMatchmakingQueues.value.filter(queueId => queueId !== data.queueId);
    // this.$router.push(`/matches/${data.matchId}`)
  });

  return {
    regionStats,
    joinedMatchmakingQueues,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchMakingStore, import.meta.hot));
}
