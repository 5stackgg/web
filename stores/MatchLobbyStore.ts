import { ref, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import {
  $,
  e_match_status_enum,
  e_tournament_status_enum,
  order_by,
  e_player_roles_enum,
} from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { NOT_LEAGUE_TOURNAMENT } from "~/graphql/tournamentFilters";
import { FINISHED_TOURNAMENT_CHAT_MS } from "~/constants/chat";

export const useMatchLobbyStore = defineStore("matchLobby", () => {
  const lobbyChat = ref<Record<string, Map<string, unknown>>>({});

  const myMatches = ref([]);
  const myMatchesLoaded = ref(false);
  const managingMatchesCount = ref(0);
  const managingTournamentsCount = ref(0);
  const liveMatchesCount = ref(0);
  const liveTournamentsCount = ref(0);
  const openRegistrationTournamentsCount = ref(0);
  const chatTournamentRows = ref<any[]>([]);
  const now = ref(Date.now());
  let clock: ReturnType<typeof setInterval> | undefined;

  // The subscription's cutoff is fixed when it starts, so a finished
  // tournament's week is judged here, against a clock that keeps moving.
  const chatTournaments = computed({
    get: () =>
      chatTournamentRows.value.filter(
        (tournament) =>
          tournament.status !== e_tournament_status_enum.Finished ||
          (!!tournament.finished_at &&
            new Date(tournament.finished_at).getTime() +
              FINISHED_TOURNAMENT_CHAT_MS >
              now.value),
      ),
    set: (rows: any[]) => {
      chatTournamentRows.value = rows;
    },
  });

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

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchLobby:liveMatches",
      subscription.subscribe({
        next: ({ data }) => {
          liveMatchesCount.value =
            data?.matches_aggregate?.aggregate?.count || 0;
        },
        error: (error) => {
          console.error("Error in live matches subscription:", error);
        },
      }),
    );
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
              _and: [NOT_LEAGUE_TOURNAMENT],
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

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchLobby:liveTournaments",
      subscription.subscribe({
        next: ({ data }) => {
          liveTournamentsCount.value =
            data?.tournaments_aggregate?.aggregate?.count || 0;
        },
        error: (error) => {
          console.error("Error in live tournaments subscription:", error);
        },
      }),
    );
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
              _and: [NOT_LEAGUE_TOURNAMENT],
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

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchLobby:openRegistrationTournaments",
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
      }),
    );
  };

  const subscribeToChatTournaments = async () => {
    now.value = Date.now();
    clearInterval(clock);
    clock = setInterval(() => {
      now.value = Date.now();
    }, 60_000);

    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        tournaments: [
          {
            where: {
              _or: [
                { joined_tournament: { _eq: true } },
                { is_organizer: { _eq: true } },
              ],
              _and: [
                NOT_LEAGUE_TOURNAMENT,
                {
                  _or: [
                    {
                      status: {
                        _in: [
                          e_tournament_status_enum.Setup,
                          e_tournament_status_enum.RegistrationOpen,
                          e_tournament_status_enum.RegistrationClosed,
                          // A tournament held at the check-in cutoff is exactly
                          // when the organizer and the excluded teams need the
                          // chat.
                          e_tournament_status_enum.CheckInReview,
                          e_tournament_status_enum.Live,
                          e_tournament_status_enum.Paused,
                        ],
                      },
                    },
                    {
                      status: { _eq: e_tournament_status_enum.Finished },
                      finished_at: {
                        _gt: $("finishedAfter", "timestamptz!"),
                      },
                    },
                  ],
                },
              ],
            },
          },
          {
            id: true,
            name: true,
            status: true,
            finished_at: true,
            joined_tournament: true,
            is_organizer: true,
          },
        ],
      }),
      variables: {
        finishedAfter: new Date(
          now.value - FINISHED_TOURNAMENT_CHAT_MS,
        ).toISOString(),
      },
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchLobby:chatTournaments",
      subscription.subscribe({
        next: ({ data }) => {
          chatTournamentRows.value = data?.tournaments || [];
        },
        error: (error) => {
          console.error("Error in chat tournaments subscription:", error);
        },
      }),
    );
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

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchLobby:managingMatches",
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
      }),
    );
  };

  const subscribeToManagingTournaments = async () => {
    const me = useAuthStore().me;
    if (!me) {
      return;
    }

    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        tournaments_aggregate: [
          {
            where: {
              status: {
                _in: [
                  e_tournament_status_enum.Live,
                  e_tournament_status_enum.RegistrationClosed,
                  e_tournament_status_enum.RegistrationOpen,
                  e_tournament_status_enum.CheckInReview,
                  e_tournament_status_enum.Setup,
                ],
              },
              _and: [NOT_LEAGUE_TOURNAMENT],
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

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchLobby:managingTournaments",
      subscription.subscribe({
        next: ({ data }) => {
          if (data?.tournaments_aggregate?.aggregate?.count !== undefined) {
            managingTournamentsCount.value =
              data.tournaments_aggregate.aggregate.count;
          } else {
            managingTournamentsCount.value = 0;
          }
        },
        error: (error) => {
          console.error("Error in managing tournaments subscription:", error);
        },
      }),
    );
  };

  const subscribeToMyMatches = async () => {
    const me = useAuthStore().me;
    if (!me?.steam_id) {
      return;
    }

    myMatchesLoaded.value = false;

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
          {
            ...simpleMatchFields,
            can_check_in: true,
            map_veto_type: true,
            region: true,
            // /play schedule: the check-in deadline, Connect once live, and
            // whether check-in needs the camera (it can't happen inline).
            cancels_at: true,
            connection_link: true,
            options: {
              ...simpleMatchFields.options,
              region_veto: true,
              camera_required: true,
            },
            lineup_1: {
              ...simpleMatchFields.lineup_1,
              is_ready: true,
              can_pick_map_veto: true,
              can_pick_region_veto: true,
            },
            lineup_2: {
              ...simpleMatchFields.lineup_2,
              is_ready: true,
              can_pick_map_veto: true,
              can_pick_region_veto: true,
            },
            draft_games: [
              {},
              {
                id: true,
              },
            ],
          },
        ],
      }),
      variables: {
        steam_id: me.steam_id,
      },
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchLobby:myMatches",
      subscription.subscribe({
        next: ({ data }) => {
          // A scheduled match is "upcoming" — keep it out of the lobby nav until
          // it's within an hour of kickoff so it doesn't read as an active match.
          const cutoff = Date.now() + 60 * 60 * 1000;
          myMatches.value = (data?.matches ?? []).filter((match: any) => {
            if (match.status !== e_match_status_enum.Scheduled) {
              return true;
            }
            return (
              !!match.scheduled_at &&
              new Date(match.scheduled_at).getTime() <= cutoff
            );
          });
          myMatchesLoaded.value = true;
        },
        error: (err: any) => {
          // Surfaces silent schema drift — a bad field here kills the whole
          // subscription, leaving myMatches empty (e.g. the removed `invites`).
          console.error("[myMatches] subscription error:", err);
        },
      }),
    );
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
    const nextLobby = new Map<string, unknown>();

    for (const user of users) {
      nextLobby.set(user.steam_id, user);
    }

    lobbyChat.value[matchId] = nextLobby;
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
    myMatchesLoaded,
    managingMatchesCount,
    managingTournamentsCount,
    liveMatchesCount,
    liveTournamentsCount,
    openRegistrationTournamentsCount,
    chatTournaments,
    currentMatch: computed(() => {
      return myMatches.value.at(0);
    }),
    currentUserInGame: computed(() => {
      const steamId = useAuthStore().me?.steam_id;
      if (!steamId) return false;
      return Object.values(lobbyChat.value).some(
        (lobby) =>
          (lobby.get(steamId) as { inGame?: boolean } | undefined)?.inGame ===
          true,
      );
    }),
    add,
    set,
    remove,
    subscribeToMyMatches,
    subscribeToManagingMatches,
    subscribeToManagingTournaments,
    subscribeToLiveMatches,
    subscribeToLiveTournaments,
    subscribeToOpenRegistrationTournaments,
    subscribeToChatTournaments,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchLobbyStore, import.meta.hot));
}
