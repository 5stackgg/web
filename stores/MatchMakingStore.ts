import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import {
  e_game_server_node_regions_enum,
  e_match_types_enum,
} from "~/generated/zeus";
import { string } from "zod";

export const useMatchMakingStore = defineStore("match-making", () => {
  const joinedMatchmakingQueues = ref<{
    details?: {
      totalInQueue: number;
      type: e_match_types_enum;
      regions: Array<e_game_server_node_regions_enum>;
    };
    confirmation?: {
      matchId: string;
      isReady: boolean;
      expiresAt: string;
      confirmed: number;
      confirmationId: string;
      type: e_match_types_enum;
      region: e_game_server_node_regions_enum;
    };
  }>({
    details: undefined,
    confirmation: undefined,
  });

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
