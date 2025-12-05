import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import {
  $,
  e_match_status_enum,
  order_by,
  e_player_roles_enum,
} from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

export const useMatchLobbyStore = defineStore("matchLobby", () => {
  const lobbyChat = ref<Record<string, Map<string, unknown>>>({});

  const myMatches = ref([]);
  const managingMatchesCount = ref(0);

  const subscribeToManagingMatches = async () => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        matches_aggregate: [
          {
            where: {
              status: {
                _in: [
                  e_match_status_enum.Live,
                  e_match_status_enum.Veto,
                  e_match_status_enum.WaitingForCheckIn,
                  e_match_status_enum.WaitingForServer,
                  e_match_status_enum.Scheduled,
                  e_match_status_enum.PickingPlayers,
                ],
              },
            },
          },
          {
            aggregate: {
              count: true,
            },
          },
        ],
      }),
    });

    subscription.subscribe({
      next: ({ data }) => {
        managingMatchesCount.value = data.matches_aggregate.aggregate.count;
      },
    });
  };

  const subscribeToMyMatches = async () => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        matches: [
          {
            where: {
              _or: [
                {
                  is_in_lineup: {
                    _eq: true,
                  },
                  status: {
                    _in: [
                      e_match_status_enum.Live,
                      e_match_status_enum.Veto,
                      e_match_status_enum.WaitingForCheckIn,
                      e_match_status_enum.WaitingForServer,
                      e_match_status_enum.Scheduled,
                    ],
                  },
                },
                {
                  organizer_steam_id: {
                    _eq: $("steam_id", "bigint!"),
                  },
                  ...(useAuthStore().isRoleAbove(
                    e_player_roles_enum.match_organizer,
                  ) === true
                    ? {
                        is_in_lineup: {
                          _eq: true,
                        },
                      }
                    : {}),
                  status: {
                    _in: [
                      e_match_status_enum.Live,
                      e_match_status_enum.Veto,
                      e_match_status_enum.WaitingForCheckIn,
                      e_match_status_enum.WaitingForServer,
                      e_match_status_enum.Scheduled,
                      e_match_status_enum.PickingPlayers,
                    ],
                  },
                },
              ],
            },
            order_by: [
              {
                created_at: order_by.desc,
              },
            ],
          },
          simpleMatchFields,
        ],
      }),
      variables: {
        steam_id: useAuthStore().me?.steam_id,
      },
    });

    subscription.subscribe({
      next: ({ data }) => {
        myMatches.value = data?.matches;
      },
    });
  };

  const add = (
    matchId: string,
    user: {
      name: string;
      steam_id: string;
      avatar_url: string;
      inGame: boolean;
    },
  ) => {
    if (!lobbyChat.value[matchId]) {
      lobbyChat.value[matchId] = new Map();
    }
    lobbyChat.value[matchId].set(user.steam_id, user);
  };

  const set = (
    matchId: string,
    users: Array<{ steam_id: string; name: string; avatar_url: string }>,
  ) => {
    if (!lobbyChat.value[matchId]) {
      lobbyChat.value[matchId] = new Map();
    }

    for (const user of users) {
      lobbyChat.value[matchId].set(user.steam_id, user);
    }
  };

  const remove = (
    matchId: string,
    user: {
      steam_id: string;
    },
  ) => {
    lobbyChat.value[matchId]?.delete(user.steam_id);
  };

  return {
    lobbyChat,
    myMatches,
    managingMatchesCount,
    currentMatch: computed(() => {
      return myMatches.value.at(0);
    }),
    add,
    set,
    remove,
    subscribeToMyMatches,
    subscribeToManagingMatches,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchLobbyStore, import.meta.hot));
}
