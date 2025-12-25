import { ref, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import {
  $,
  e_match_status_enum,
  e_tournament_status_enum,
  e_lobby_access_enum,
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
  const liveMatchesCount = ref(0);
  const liveTournamentsCount = ref(0);
  const openRegistrationTournamentsCount = ref(0);
  const openMatchesCount = ref(0);

  const subscribeToLiveMatches = async () => {
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
        liveMatchesCount.value = data?.matches_aggregate?.aggregate?.count || 0;
      },
      error: (error) => {
        console.error("Error in live matches subscription:", error);
      },
    });
  };

  const subscribeToLiveTournaments = async () => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        tournaments_aggregate: [
          {
            where: {
              status: {
                _eq: e_tournament_status_enum.Live,
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
        liveTournamentsCount.value =
          data?.tournaments_aggregate?.aggregate?.count || 0;
      },
      error: (error) => {
        console.error("Error in live tournaments subscription:", error);
      },
    });
  };

  const subscribeToOpenRegistrationTournaments = async () => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        tournaments_aggregate: [
          {
            where: {
              status: {
                _eq: e_tournament_status_enum.RegistrationOpen,
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
        openRegistrationTournamentsCount.value =
          data?.tournaments_aggregate?.aggregate?.count || 0;
      },
      error: (error) => {
        console.error(
          "Error in open registration tournaments subscription:",
          error,
        );
      },
    });
  };

  const subscribeToOpenMatches = async () => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        matches_aggregate: [
          {
            where: {
              status: {
                _eq: e_match_status_enum.PickingPlayers,
              },
              options: {
                lobby_access: {
                  _eq: e_lobby_access_enum.Open,
                },
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
        openMatchesCount.value = data?.matches_aggregate?.aggregate?.count || 0;
      },
      error: (error) => {
        console.error("Error in open matches subscription:", error);
      },
    });
  };

  const subscribeToManagingMatches = async () => {
    const me = useAuthStore().me;
    if (!me) {
      return;
    }

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
        if (data?.matches_aggregate?.aggregate?.count !== undefined) {
          managingMatchesCount.value = data.matches_aggregate.aggregate.count;
        } else {
          managingMatchesCount.value = 0;
        }
      },
      error: (error) => {
        console.error("Error in managing matches subscription:", error);
      },
    });
  };

  const subscribeToMyMatches = async () => {
    const me = useAuthStore().me;
    if (!me?.steam_id) {
      return;
    }

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
        steam_id: me.steam_id,
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
    liveMatchesCount,
    liveTournamentsCount,
    openRegistrationTournamentsCount,
    openMatchesCount,
    currentMatch: computed(() => {
      return myMatches.value.at(0);
    }),
    add,
    set,
    remove,
    subscribeToMyMatches,
    subscribeToManagingMatches,
    subscribeToLiveMatches,
    subscribeToLiveTournaments,
    subscribeToOpenRegistrationTournaments,
    subscribeToOpenMatches,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchLobbyStore, import.meta.hot));
}
