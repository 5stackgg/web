import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import {
  $,
  e_match_status_enum,
  e_lobby_access_enum,
  order_by,
} from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";

export const useMatchLobbyStore = defineStore("matchLobby", () => {
  const lobbies = ref(new Map<string, { players: any[]; match: any }>());
  const lobbyChat = ref<Record<string, Map<string, unknown>>>({});
  const upcomingMatches = ref([]);
  const viewMatchLobby = ref();

  const subscribeToMyMatches = async () => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        matches: [
          {
            where: {
              _or: [
                {
                  organizer_steam_id: {
                    _eq: $("steam_id", "bigint!"),
                  },
                  status: {
                    _in: [e_match_status_enum.PickingPlayers],
                  },
                },
                {
                  is_in_lineup: {
                    _eq: true,
                  },
                  _or: [
                    {
                      options: {
                        lobby_access: {
                          _neq: e_lobby_access_enum.Private,
                        },
                      },
                      status: {
                        _in: [e_match_status_enum.PickingPlayers],
                      },
                    },
                    {
                      status: {
                        _in: $("statuses", "[e_match_status_enum!]!"),
                      },
                    },
                  ],
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
        statuses: [
          e_match_status_enum.Live,
          e_match_status_enum.Veto,
          e_match_status_enum.Scheduled,
          e_match_status_enum.WaitingForCheckIn,
        ],
      },
    });

    subscription.subscribe({
      next: ({ data }) => {
        if (data?.matches) {
          upcomingMatches.value = data.matches;

          const _matches = data.matches.filter((match) => {
            return [
              e_match_status_enum.Live,
              e_match_status_enum.Veto,
              e_match_status_enum.WaitingForCheckIn,
              e_match_status_enum.WaitingForServer,
              e_match_status_enum.Scheduled,
            ].includes(match.status);
          });

          // Create a set of match IDs from the new data
          const newMatchIds = new Set(_matches.map((match) => match.id));

          // Remove matches that are no longer in data.matches
          for (const [matchId, lobby] of lobbies.value.entries()) {
            if (!newMatchIds.has(matchId)) {
              lobbies.value.delete(matchId);
            }
          }

          // Update or add matches
          for (const match of _matches) {
            lobbies.value.set(match.id, { players: [], match });
          }
        }
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
    lobbyChat.value[matchId] = new Map();

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
    lobbies,
    lobbyChat,
    upcomingMatches,
    viewMatchLobby,
    add,
    set,
    remove,
    subscribeToMyMatches,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchLobbyStore, import.meta.hot));
}
