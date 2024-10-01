import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { e_server_regions_enum, e_match_types_enum } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

export const useMatchMakingStore = defineStore("match-making", () => {
  const playersOnline = ref<number>;

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

  const regions = ref([]);
  const subscribeToRegions = async () => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        e_server_regions: [
          {
            where: {
              total_server_count: {
                _gt: 0,
              },
            },
          },
          {
            value: true,
            status: true,
            description: true,
          },
        ],
      }),
    });

    subscription.subscribe({
      next: ({ data }) => {
        regions.value = data.e_server_regions;
      },
    });
  };

  subscribeToRegions();

  return {
    regions,
    regionStats,
    joinedMatchmakingQueues,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchMakingStore, import.meta.hot));
}
