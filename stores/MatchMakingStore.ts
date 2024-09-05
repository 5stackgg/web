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

  return {
    regionStats,
    joinedMatchmakingQueues,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchMakingStore, import.meta.hot));
}
