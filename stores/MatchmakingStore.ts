import { ref, watch, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import {
  e_match_types_enum,
  $,
  e_lobby_access_enum,
  e_draft_game_status_enum,
  e_match_status_enum,
  order_by,
} from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { webrtc } from "~/web-sockets/Webrtc";
import { setActiveHub } from "~/composables/useHubState";

const REGION_LATENCY_PREFIX = "5stack_region_latency_";
const MAX_LATENCY_KEY = "5stack_max_acceptable_latency";
const PREFERRED_REGIONS_KEY = "5stack_preferred_regions";

function safeParseLocalStorage<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export const useMatchmakingStore = defineStore("matchmaking", () => {
  const playersOnline = ref([]);
  const onlinePlayerSteamIds = ref<string[]>([]);

  const joinedMatchmakingQueues = ref<{
    details?: {
      totalInQueue: number;
      type: e_match_types_enum;
      regions: Array<string>;
    };
    confirmation?: {
      matchId: string;
      isReady: boolean;
      expiresAt: string;
      confirmed: number;
      confirmationId: string;
      type: e_match_types_enum;
      region: string;
      players: number;
    };
  }>({
    details: undefined,
    confirmation: undefined,
  });

  const regionStats = ref<
    Partial<Record<string, Partial<Record<e_match_types_enum, number[]>>>>
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
          playerFields,
        ],
      }),
      variables: {
        steam_ids: steamIds,
      },
    });

    playersOnline.value = data.players;
  };

  const friends = ref([]);
  const lobbies = ref([]);

  const viewingMatchId = ref<string | undefined>();
  const subscribeToFriends = async (mySteamId: bigint) => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        my_friends: [
          {},
          {
            elo: true,
            name: true,
            role: true,
            country: true,
            steam_id: true,
            avatar_url: true,
            status: true,
            invited_by_steam_id: true,
            player: {
              steam_id: true,
              is_in_lobby: true,
              is_in_another_match: true,
              is_in_draft: true,
              // Friend's current live match — drives the inline score preview.
              player_lineup: [
                {
                  limit: 1,
                  where: {
                    lineup: {
                      match: { status: { _eq: e_match_status_enum.Live } },
                    },
                  },
                },
                {
                  lineup: {
                    id: true,
                    match: {
                      id: true,
                      status: true,
                      started_at: true,
                      lineup_1_id: true,
                      lineup_2_id: true,
                      options: { type: true, best_of: true },
                      lineup_1: { id: true, name: true },
                      lineup_2: { id: true, name: true },
                      match_maps: [
                        { order_by: [{ order: order_by.asc }] },
                        {
                          id: true,
                          order: true,
                          status: true,
                          is_current_map: true,
                          map: { name: true, label: true },
                          lineup_1_score: true,
                          lineup_2_score: true,
                          winning_lineup_id: true,
                        },
                      ],
                    },
                  },
                },
              ],
              draft_game_players: [
                {
                  limit: 1,
                  where: {
                    draft_game: {
                      match_id: { _is_null: true },
                      status: { _eq: e_draft_game_status_enum.Open },
                      access: {
                        _in: [
                          e_lobby_access_enum.Friends,
                          e_lobby_access_enum.Open,
                        ],
                      },
                    },
                  },
                },
                {
                  draft_game_id: true,
                  draft_game: {
                    id: true,
                    access: true,
                    status: true,
                    capacity: true,
                    type: true,
                    mode: true,
                    require_approval: true,
                    players: [
                      { where: { status: { _neq: "Waitlist" } } },
                      { steam_id: true, status: true },
                    ],
                  },
                },
              ],
              lobby_players: [
                {
                  limit: 1,
                  where: {
                    lobby: {
                      _not: {
                        players: {
                          steam_id: {
                            _eq: $("mySteamId", "bigint!"),
                          },
                        },
                      },
                      access: {
                        _in: [
                          e_lobby_access_enum.Friends,
                          e_lobby_access_enum.Open,
                        ],
                      },
                    },
                  },
                },
                {
                  lobby_id: true,
                  lobby: {
                    id: true,
                    players: [
                      {},
                      {
                        player: {
                          name: true,
                          country: true,
                          steam_id: true,
                          avatar_url: true,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      }),
      variables: {
        mySteamId,
      },
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchmaking:friends",
      subscription.subscribe({
        next: ({ data }) => {
          friends.value = data.my_friends;
        },
      }),
    );
  };

  const onlineFriends = computed(() => {
    return friends.value?.filter((friend: any) => {
      if (friend.status === "Pending") {
        return false;
      }

      return onlinePlayerSteamIds.value.includes(friend.steam_id);
    });
  });

  const offlineFriends = computed(() => {
    return friends.value?.filter((friend: any) => {
      if (friend.status === "Pending") {
        return false;
      }
      return !onlinePlayerSteamIds.value.includes(friend.steam_id);
    });
  });

  const subscribeToLobbies = async (steam_id: bigint) => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        lobbies: [
          {
            where: {
              players: {
                steam_id: {
                  _eq: $("steam_id", "bigint!"),
                },
              },
            },
          },
          {
            id: true,
            access: true,
            players: [
              {},
              {
                status: true,
                captain: true,
                player: playerFields,
              },
            ],
          },
        ],
      }),
      variables: {
        steam_id,
      },
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchmaking:lobbies",
      subscription.subscribe({
        next: ({ data }) => {
          lobbies.value = data.lobbies;
        },
      }),
    );
  };

  watch(
    () => useAuthStore().me?.steam_id,
    (steamId) => {
      if (steamId) {
        subscribeToFriends(steamId);
        subscribeToLobbies(steamId);
      } else {
        const { unsubscribe } = useSubscriptionManager();
        unsubscribe("matchmaking:friends");
        unsubscribe("matchmaking:lobbies");
      }
    },
    { immediate: true },
  );

  watch(onlinePlayerSteamIds, (newSteamIds, oldSteamIds) => {
    if (
      newSteamIds.length !== oldSteamIds.length ||
      !newSteamIds.every((id, index) => id === oldSteamIds[index])
    ) {
      queryPlayers();
    }
  });

  const creatingLobby = ref(false);

  const createLobby = async () => {
    if (creatingLobby.value) {
      return;
    }
    creatingLobby.value = true;

    try {
      const { data } = await getGraphqlClient().mutate({
        mutation: typedGql("mutation")({
          insert_lobbies_one: [
            {
              object: {},
            },
            {
              id: true,
            },
          ],
        }),
      });
      const newLobbyId = data.insert_lobbies_one.id;

      if ((currentLobby.value as any)?.id !== newLobbyId) {
        await new Promise<void>((resolve) => {
          let stop: (() => void) | undefined;
          const timeout = setTimeout(() => {
            stop?.();
            resolve();
          }, 5000);
          stop = watch(currentLobby, (lobby: any) => {
            if (lobby?.id === newLobbyId) {
              clearTimeout(timeout);
              stop?.();
              resolve();
            }
          });
        });
      }

      setActiveHub("lobby");
      return newLobbyId;
    } finally {
      creatingLobby.value = false;
    }
  };

  const inviteToLobby = async (steam_id: string) => {
    const me = useAuthStore().me;

    let lobby_id = me?.current_lobby_id;

    if (!lobby_id) {
      lobby_id = await createLobby();
    }

    await getGraphqlClient().mutate({
      mutation: typedGql("mutation")({
        insert_lobby_players_one: [
          {
            object: {
              steam_id,
              lobby_id,
            },
          },
          {
            __typename: true,
          },
        ],
      }),
    });
  };

  const storedRegions = ref<string[]>(
    safeParseLocalStorage<string[]>(PREFERRED_REGIONS_KEY) ?? [],
  );

  const latencies = ref(new Map<string, number[]>());

  // Load existing latencies from localStorage for each region
  useApplicationSettingsStore().availableRegions.forEach((region) => {
    const key = REGION_LATENCY_PREFIX + region.value;
    const parsed = safeParseLocalStorage<number[]>(key);
    if (parsed) {
      latencies.value.set(region.value, parsed);
    }
  });

  const savedMaxLatency = localStorage.getItem(MAX_LATENCY_KEY);
  const playerMaxAcceptableLatency = ref(
    savedMaxLatency ? parseInt(savedMaxLatency) : 75,
  );

  const isRefreshing = ref(false);
  async function refreshLatencies() {
    if (isRefreshing.value) {
      return;
    }
    isRefreshing.value = true;
    resetLatencies();
    await Promise.all(
      useApplicationSettingsStore().availableRegions.map((region) =>
        getLatency(region.value),
      ),
    );
    isRefreshing.value = false;
  }

  function checkLatenies() {
    // Guests can't matchmake; don't open WebRTC peer connections for them.
    if (!useAuthStore().me?.steam_id) {
      return;
    }
    if (latencies.value.size === 0) {
      refreshLatencies();
    }
  }

  async function getLatency(region: string) {
    return new Promise(async (resolve) => {
      setTimeout(() => {
        resolve(undefined);
      }, 5000);
      try {
        const buffer = new Uint8Array([0x01]).buffer;

        const datachannel = await webrtc.connect(region, (data) => {
          if (data === "") {
            datachannel.send(buffer);
            return;
          }

          const event = JSON.parse(data) as {
            type: string;
            data: Record<string, unknown>;
          };

          if (event.type === "latency-results") {
            datachannel.close();
            latencies.value.set(region, event.data);
          }
        });

        datachannel.send("latency-test");
      } catch (error) {
        console.error(`Failed to get latency for ${region}`, error);
        resolve(undefined);
      }
    });
  }

  function togglePreferredRegion(region: string) {
    const index = storedRegions.value.indexOf(region);
    if (index !== -1) {
      storedRegions.value.splice(index, 1);
    } else {
      storedRegions.value.push(region);
    }
    localStorage.setItem(
      PREFERRED_REGIONS_KEY,
      JSON.stringify(storedRegions.value.filter(Boolean)),
    );
  }

  function updateMaxAcceptableLatency(latency: number) {
    playerMaxAcceptableLatency.value = latency;
    localStorage.setItem(MAX_LATENCY_KEY, latency.toString());
  }

  function resetLatencies() {
    latencies.value.clear();
    useApplicationSettingsStore().availableRegions.forEach((region) => {
      localStorage.removeItem(REGION_LATENCY_PREFIX + region.value);
    });
  }

  function getRegionlatencyResult(region: string):
    | {
        isLan: boolean;
        latency: string;
      }
    | undefined {
    const regionLatencies = latencies.value.get(region);
    if (!regionLatencies) {
      return;
    }
    return {
      isLan: regionLatencies.isLan,
      latency: Number(regionLatencies.latency).toFixed(2),
    };
  }

  const preferredRegions = computed(() => {
    const availableRegions =
      useApplicationSettingsStore().availableRegions.filter((region) => {
        const regionLatency = getRegionlatencyResult(region.value);

        if (regionLatency && region.is_lan && regionLatency.isLan) {
          return true;
        }

        if (
          regionLatency &&
          parseFloat(regionLatency?.latency) >
            parseFloat(
              useApplicationSettingsStore().maxAcceptableLatency || "75",
            )
        ) {
          return false;
        }

        return true;
      });

    if (isRefreshing.value) {
      return availableRegions;
    }

    if (storedRegions.value.length > 0) {
      const _preferredRegions = availableRegions.filter((region) => {
        return storedRegions.value.includes(region.value);
      });
      if (_preferredRegions.length > 0) {
        return _preferredRegions;
      }
    }

    return availableRegions
      .filter((region) => {
        const regionResult = getRegionlatencyResult(region.value);

        if (!regionResult) {
          return true;
        }

        return (
          !isNaN(Number(regionResult.latency)) &&
          Number(regionResult.latency) <= playerMaxAcceptableLatency.value
        );
      })
      .sort((a, b) => {
        if (a.is_lan && !b.is_lan) {
          return -1;
        }
        if (!a.is_lan && b.is_lan) {
          return 1;
        }

        // For non-LAN regions, sort by latency
        return (
          Number(getRegionlatencyResult(a.value)?.latency) -
          Number(getRegionlatencyResult(b.value)?.latency)
        );
      });
  });

  // Classify lobbies by MY membership status within the `lobbies` subscription
  // itself, NOT by comparing against `me.current_lobby_id`. That field arrives
  // on a separate subscription (AuthStore.subscribeToMe) and lags behind this
  // one, so cross-referencing it makes a lobby briefly flip between "invite"
  // and "joined" while creating/joining/leaving (invite toast flashes, etc).
  const myLobbyStatus = (lobby: any) => {
    const meSteamId = String(useAuthStore().me?.steam_id ?? "");
    return lobby?.players?.find(
      (p: any) => String(p.player?.steam_id) === meSteamId,
    )?.status;
  };

  const lobbyInvites = computed(() => {
    if (!lobbies.value) return [];
    return lobbies.value.filter(
      (lobby: any) => myLobbyStatus(lobby) === "Invited",
    );
  });

  const currentLobby = computed(() => {
    return lobbies.value.find(
      (lobby: any) => myLobbyStatus(lobby) === "Accepted",
    );
  });

  return {
    friends,
    onlineFriends,
    offlineFriends,
    lobbies,
    currentLobby,
    regionStats,
    playersOnline,
    onlinePlayerSteamIds,
    joinedMatchmakingQueues,

    checkLatenies,
    refreshLatencies,
    isRefreshing,
    getRegionlatencyResult,
    togglePreferredRegion,
    updateMaxAcceptableLatency,

    latencies,
    storedRegions,
    preferredRegions,
    playerMaxAcceptableLatency,
    lobbyInvites,

    createLobby,
    creatingLobby,
    inviteToLobby,
    viewingMatchId,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchmakingStore, import.meta.hot));
}
