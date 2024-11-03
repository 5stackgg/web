import { ref, watch } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { e_server_regions_enum, e_match_types_enum, $ } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";

export const useMatchMakingStore = defineStore("match-making", () => {
  const playersOnline = ref([]);
  const onlinePlayerSteamIds = ref<string[]>([]);

  const joinedMatchmakingQueues = ref<{
    details?: {
      totalInQueue: number;
      type: e_match_types_enum;
      regions: Array<e_server_regions_enum>;
    };
    confirmation?: {
      matchId: string;
      isReady: boolean;
      expiresAt: string;
      confirmed: number;
      confirmationId: string;
      type: e_match_types_enum;
      region: e_server_regions_enum;
    };
  }>({
    details: undefined,
    confirmation: undefined,
  });

  const regionStats = ref<
    Partial<
      Record<e_server_regions_enum, Partial<Record<e_match_types_enum, number>>>
    >
  >({});

  const queryPlayers = async () => {
    const steamIds = onlinePlayerSteamIds.value;
    if (steamIds.length === 0) {
      return;
    }
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        players: [
          {
            where: {
              steam_id: {
                _in: $("steam_ids", "[bigint]!"),
              },
            },
          },
          {
            name: true,
            steam_id: true,
            avatar_url: true,
            country: true,
          },
        ],
      }),
      variables: {
        steam_ids: steamIds,
      },
    });

    playersOnline.value = data.players;
  };

  watch(onlinePlayerSteamIds, (newSteamIds, oldSteamIds) => {
    if (
      newSteamIds.length !== oldSteamIds.length ||
      !newSteamIds.every((id, index) => id === oldSteamIds[index])
    ) {
      queryPlayers();
    }
  });

  return {
    regionStats,
    playersOnline,
    onlinePlayerSteamIds,
    joinedMatchmakingQueues,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchMakingStore, import.meta.hot));
}
