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
import { fromActiveMatches } from "~/utilities/activeMatches";
import { generateSubscription } from "~/graphql/graphqlGen";
import { NOT_LEAGUE_TOURNAMENT } from "~/graphql/tournamentFilters";
import { FINISHED_TOURNAMENT_CHAT_MS } from "~/constants/chat";

const SCHEDULED_MATCH_LEAD_MS = 60 * 60 * 1000;

// The match that needs you first; within a status, the newest.
const CURRENT_MATCH_STATUSES: string[] = [
  e_match_status_enum.Live,
  e_match_status_enum.Veto,
  e_match_status_enum.WaitingForCheckIn,
  e_match_status_enum.WaitingForServer,
  e_match_status_enum.PickingPlayers,
  e_match_status_enum.Scheduled,
];

function currentMatchRank(match: any) {
  const rank = CURRENT_MATCH_STATUSES.indexOf(match.status);
  return rank === -1 ? CURRENT_MATCH_STATUSES.length : rank;
}

export const useMatchLobbyStore = defineStore("matchLobby", () => {
  const lobbyChat = ref<Record<string, Map<string, unknown>>>({});

  const myMatchRows = ref<any[]>([]);
  const myMatchesLoaded = ref(false);
  const managingMatchesCount = ref(0);
  const liveMatchesCount = ref(0);
  const liveTournamentsCount = ref(0);
  const openRegistrationTournamentsCount = ref(0);
  const chatTournamentRows = ref<any[]>([]);
  const now = ref(Date.now());
  let clock: ReturnType<typeof setInterval> | undefined;

  const startClock = () => {
    now.value = Date.now();
    clearInterval(clock);
    clock = setInterval(() => {
      now.value = Date.now();
    }, 60_000);
  };

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

  // A scheduled match is "upcoming" — keep it out of the lobby nav until it's
  // within an hour of kickoff, judged against the clock rather than when the
  // subscription last pushed. The clock ticks every minute, so the same
  // matches hand back the same array and watchers only hear real changes.
  const myMatches = computed({
    get: (previous?: any[]) => {
      const cutoff = now.value + SCHEDULED_MATCH_LEAD_MS;
      const matches = myMatchRows.value.filter((match: any) => {
        if (match.status !== e_match_status_enum.Scheduled) {
          return true;
        }
        return (
          !!match.scheduled_at &&
          new Date(match.scheduled_at).getTime() <= cutoff
        );
      });
      if (
        previous?.length === matches.length &&
        matches.every((match, index) => match === previous[index])
      ) {
        return previous;
      }
      return matches;
    },
    set: (rows: any[]) => {
      myMatchRows.value = rows;
    },
  });

  const currentMatch = computed(() =>
    [...myMatches.value]
      .sort(
        (a: any, b: any) =>
          currentMatchRank(a) - currentMatchRank(b) ||
          new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime(),
      )
      .at(0),
  );

  const subscribeToLiveMatches = async () => {
    const client = getGraphqlClient();
    const subscription = client.subscribe({
      query: await fromActiveMatches(
        client,
        generateSubscription({
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
      ),
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
    startClock();

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

    const client = getGraphqlClient();
    const subscription = client.subscribe({
      query: await fromActiveMatches(
        client,
        generateSubscription({
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
      ),
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

  const subscribeToMyMatches = async () => {
    const me = useAuthStore().me;
    if (!me?.steam_id) {
      return;
    }

    myMatchesLoaded.value = false;
    startClock();

    const client = getGraphqlClient();
    const subscription = client.subscribe({
      query: await fromActiveMatches(
        client,
        generateSubscription({
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
      ),
      variables: {
        steam_id: me.steam_id,
      },
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchLobby:myMatches",
      subscription.subscribe({
        next: ({ data }) => {
          myMatchRows.value = data?.matches ?? [];
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
    liveMatchesCount,
    liveTournamentsCount,
    openRegistrationTournamentsCount,
    chatTournaments,
    currentMatch,
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
    subscribeToLiveMatches,
    subscribeToLiveTournaments,
    subscribeToOpenRegistrationTournaments,
    subscribeToChatTournaments,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchLobbyStore, import.meta.hot));
}
