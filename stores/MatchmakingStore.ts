import { ref, shallowRef, watch, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { e_match_types_enum, order_by, $ } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  MY_FRIENDS_ROW_STATE_SUBSCRIPTION,
  MY_FRIENDS_SUBSCRIPTION,
} from "~/graphql/myFriends";
import { schemaHasField } from "~/utilities/schemaHasType";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";
import debounce from "~/utilities/debounce";
import { isInCs2 } from "~/utilities/cs2Presence";
import type { RegionStats } from "~/utilities/matchmakingPartySize";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { setActiveHub } from "~/composables/useHubState";
import socket from "~/web-sockets/Socket";

const REGION_LATENCY_PREFIX = "5stack_region_latency_";
const MAX_LATENCY_KEY = "5stack_max_acceptable_latency";
const PREFERRED_REGIONS_KEY = "5stack_preferred_regions";
const PLAY_WHERE_KEY = "5stack_play_where";

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
  // Who among my friends is online, plus me. The api no longer sends who else
  // is: a roster of everyone online sent to every tab doesn't scale.
  const onlinePlayerSteamIds = ref<string[]>([]);
  const onlineCount = ref(0);

  // Whether presence has landed at least once. Before it does, an empty list
  // is indistinguishable from nobody being online, and callers that filter on
  // presence have to tell those two apart.
  const presenceLoaded = ref(false);

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

  const regionStats = ref<RegionStats>({});

  // An api from before friends presence only sends the roster of everyone
  // online; until it sends anything newer, that roster is used as before.
  let friendsPresenceFromApi = false;
  const FRIENDS_RESYNC_MS = 5 * 60 * 1000;
  let friendsResync: ReturnType<typeof setTimeout> | undefined;

  const sendFriendsOnlineRequest = shallowRef(() => {
    socket.event("friends-online", {});
  });

  const withMe = (steamIds: Array<string>) => {
    const me = useAuthStore().me?.steam_id;
    const ids = steamIds.map(String);
    return me && !ids.includes(String(me)) ? [...ids, String(me)] : ids;
  };

  const setFriendsOnline = (steamIds: Array<string>) => {
    friendsPresenceFromApi = true;
    onlinePlayerSteamIds.value = withMe(steamIds);
    presenceLoaded.value = true;

    clearTimeout(friendsResync);
    friendsResync = setTimeout(() => {
      const steamId = useAuthStore().me?.steam_id;
      if (steamId) {
        sendFriendsOnlineRequest.value();
        if (myTeamsFor === String(steamId)) {
          void loadMyTeams(steamId);
        }
      }
    }, FRIENDS_RESYNC_MS);
  };

  const setFriendPresence = ({
    steam_id,
    online,
  }: {
    steam_id: string;
    online: boolean;
  }) => {
    friendsPresenceFromApi = true;
    const steamId = String(steam_id);
    const present = onlinePlayerSteamIds.value.includes(steamId);

    if (online && !present) {
      onlinePlayerSteamIds.value = [...onlinePlayerSteamIds.value, steamId];
    } else if (!online && present) {
      onlinePlayerSteamIds.value = onlinePlayerSteamIds.value.filter(
        (id) => id !== steamId,
      );
    }
  };

  const setOnlineCount = (count: number) => {
    friendsPresenceFromApi = true;
    onlineCount.value = Number(count) || 0;
  };

  // Everyone online at the LAN this tab is on, which the api sends only to tabs
  // on that LAN. A player who leaves stays a moment, greyed, before dropping.
  const LAN_LEFT_LINGER_MS = 30_000;
  const lanRegion = ref<string | null>(null);
  const lanPlayers = ref<Array<any>>([]);
  const lanArrivals = ref<Array<string>>([]);
  const lanLeft = ref<Array<string>>([]);
  const lanLeaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const forgetLanLeaver = (steamId: string) => {
    clearTimeout(lanLeaveTimers.get(steamId));
    lanLeaveTimers.delete(steamId);
    lanLeft.value = lanLeft.value.filter((id) => id !== steamId);
  };

  const clearLan = () => {
    for (const steamId of lanLeaveTimers.keys()) {
      forgetLanLeaver(steamId);
    }
    lanRegion.value = null;
    lanPlayers.value = [];
    lanArrivals.value = [];
  };

  const setLanRoster = ({
    region,
    players,
  }: {
    region: string | null;
    players: Array<any>;
  }) => {
    friendsPresenceFromApi = true;
    clearLan();
    lanRegion.value = region ?? null;
    lanPlayers.value = region
      ? (players ?? []).map((player) => ({
          ...player,
          steam_id: String(player.steam_id),
        }))
      : [];
    lanArrivals.value = [];
  };

  const applyLanPresence = ({
    region,
    joined,
    left,
  }: {
    region: string | null;
    joined?: Array<any>;
    left?: Array<string>;
  }) => {
    if (!region || region !== lanRegion.value) {
      return;
    }

    for (const player of joined ?? []) {
      const steamId = String(player.steam_id);
      forgetLanLeaver(steamId);
      lanPlayers.value = [
        ...lanPlayers.value.filter((row) => row.steam_id !== steamId),
        { ...player, steam_id: steamId },
      ];
      lanArrivals.value = [
        steamId,
        ...lanArrivals.value.filter((id) => id !== steamId),
      ];
    }

    for (const id of left ?? []) {
      const steamId = String(id);
      if (
        !lanPlayers.value.some((row) => row.steam_id === steamId) ||
        lanLeft.value.includes(steamId)
      ) {
        continue;
      }
      lanLeft.value = [...lanLeft.value, steamId];
      lanLeaveTimers.set(
        steamId,
        setTimeout(() => {
          forgetLanLeaver(steamId);
          lanPlayers.value = lanPlayers.value.filter(
            (row) => row.steam_id !== steamId,
          );
          lanArrivals.value = lanArrivals.value.filter((id) => id !== steamId);
        }, LAN_LEFT_LINGER_MS),
      );
    }
  };

  // Which of a page of players are online, for search results. The api answers
  // by request id, so a reply for an older page is dropped.
  const onlineChecks = new Map<string, (online: Array<string>) => void>();
  let onlineCheckId = 0;

  const sendOnlineCheck = shallowRef(
    (requestId: string, steamIds: Array<string>) => {
      socket.event("players-online:check", { requestId, steamIds });
    },
  );

  const checkOnline = (steamIds: Array<string>) => {
    const requestId = String(++onlineCheckId);
    const ids = [...new Set(steamIds.map(String))].slice(0, 50);

    return new Promise<{ requestId: string; online: Set<string> }>(
      (resolve) => {
        onlineChecks.set(requestId, (online) =>
          resolve({ requestId, online: new Set(online.map(String)) }),
        );
        // An api from before the check never answers.
        setTimeout(() => onlineChecks.delete(requestId), 10_000);
        sendOnlineCheck.value(requestId, ids);
      },
    );
  };

  const setOnlineCheck = ({
    requestId,
    online,
  }: {
    requestId: string;
    online: Array<string>;
  }) => {
    const resolve = onlineChecks.get(String(requestId));
    onlineChecks.delete(String(requestId));
    resolve?.(online ?? []);
  };

  const setLegacyRoster = (steamIds: Array<string>) => {
    if (friendsPresenceFromApi) {
      return;
    }
    onlinePlayerSteamIds.value = steamIds.map(String);
    onlineCount.value = steamIds.length;
    presenceLoaded.value = true;
  };

  // Every team I am on with its roster, shown beside my friends. Their online
  // status comes with my friends' from the api. Loaded once the friends list
  // is shown, not for every tab.
  const myTeams = ref<Array<any>>([]);
  let myTeamsFor: string | undefined;

  const ensureMyTeams = () => {
    const steamId = useAuthStore().me?.steam_id;
    if (steamId && myTeamsFor !== String(steamId)) {
      myTeamsFor = String(steamId);
      void loadMyTeams(steamId);
    }
  };

  const loadMyTeams = async (steamId: bigint | string) => {
    try {
      const { data } = await getGraphqlClient().query({
        query: generateQuery({
          teams: [
            {
              where: {
                roster: { player_steam_id: { _eq: $("steamId", "bigint!") } },
              },
              order_by: [{ name: order_by.asc }],
            },
            {
              id: true,
              name: true,
              short_name: true,
              roster: [{}, { player: playerFields }],
            },
          ],
        }),
        variables: { steamId },
        fetchPolicy: "network-only",
      });
      if (String(useAuthStore().me?.steam_id) === String(steamId)) {
        myTeams.value = data?.teams ?? [];
      }
    } catch (error) {
      console.error("[matchmaking] unable to load my teams", error);
    }
  };

  const friends = ref([]);
  const lobbies = ref([]);
  const friendsLoaded = ref(false);
  const lobbiesLoaded = ref(false);

  const viewingMatchId = ref<string | undefined>();
  const subscribeToFriends = async (mySteamId: bigint) => {
    const client = getGraphqlClient();
    const rowState = await schemaHasField(
      client,
      "my_friends",
      "is_in_another_match",
    );
    if (useAuthStore().me?.steam_id !== mySteamId) {
      return;
    }
    const subscription = client.subscribe({
      query: rowState
        ? MY_FRIENDS_ROW_STATE_SUBSCRIPTION
        : MY_FRIENDS_SUBSCRIPTION,
      variables: {
        mySteamId,
      },
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "matchmaking:friends",
      subscription.subscribe({
        next: ({ data }) => {
          // Read where it always was, on the friend's player.
          friends.value = rowState
            ? data.my_friends.map((friend: any) => ({
                ...friend,
                player: friend.player && {
                  ...friend.player,
                  is_in_another_match: friend.is_in_another_match,
                },
              }))
            : data.my_friends;
          friendsLoaded.value = true;
        },
      }),
    );
  };

  // Online = truly present: connected to 5stack web, or in CS2 (via the friend
  // bot). Being merely assigned to a live match lineup does NOT count — a roster
  // slot isn't presence, the player may not actually be around.
  const isActiveFriend = (friend: any) =>
    onlinePlayerSteamIds.value.includes(friend.steam_id) ||
    isInCs2(friend.last_presence_state);

  // Steam friends who have never signed in here still land in the list, since
  // being Steam friends is enough to be added. Off by default so nobody
  // silently loses people they expect to see.
  //
  // Deliberately NOT applied to onlineFriends/offlineFriends below: those feed
  // the right-hub badge and the social panel, neither of which offers this
  // toggle, so filtering there made a count drop with nothing on screen to
  // explain it. The lobby list that owns the toggle applies it itself.
  const registeredFriendsOnly = ref(false);

  const isRegisteredFriend = (friend: any) =>
    friend.player?.is_registered !== false;

  const isListedFriend = (friend: any) => friend.status !== "Pending";

  const onlineFriends = computed(() => {
    return friends.value?.filter(
      (friend: any) => isListedFriend(friend) && isActiveFriend(friend),
    );
  });

  const offlineFriends = computed(() => {
    return friends.value?.filter(
      (friend: any) => isListedFriend(friend) && !isActiveFriend(friend),
    );
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
          lobbiesLoaded.value = true;
        },
      }),
    );
  };

  // A new friend, or one removed, changes who the api would count as online
  // for me. Not on the first load: the api sends that when the socket opens.
  let friendSteamIds: string | undefined;

  watch(
    () => useAuthStore().me?.steam_id,
    (steamId) => {
      friendsLoaded.value = false;
      lobbiesLoaded.value = false;
      friendSteamIds = undefined;
      if (steamId) {
        subscribeToFriends(steamId);
        subscribeToLobbies(steamId);
      } else {
        onlinePlayerSteamIds.value = [];
        presenceLoaded.value = false;
        myTeams.value = [];
        myTeamsFor = undefined;
        clearLan();
        clearTimeout(friendsResync);
        const { unsubscribe } = useSubscriptionManager();
        unsubscribe("matchmaking:friends");
        unsubscribe("matchmaking:lobbies");
      }
    },
    { immediate: true },
  );

  const requestFriendsOnline = debounce(() => {
    sendFriendsOnlineRequest.value();
  }, 500);
  watch(friends, (rows: Array<any>) => {
    const next = (rows ?? [])
      .map((friend) => String(friend.steam_id))
      .sort()
      .join(",");

    if (friendSteamIds !== undefined && next !== friendSteamIds) {
      requestFriendsOnline();
    }
    friendSteamIds = next;
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
  // Per-region probe state so each row can show its own progress instead of a
  // single global spinner — a region resolves the moment its probe answers.
  const probeStates = ref(new Map<string, "measuring" | "unreachable">());

  async function refreshLatencies() {
    if (isRefreshing.value) {
      return;
    }
    isRefreshing.value = true;
    const regions = useApplicationSettingsStore().availableRegions;
    // Previous readings stay on screen until a new one lands, so the table
    // never flashes empty mid-refresh.
    regions.forEach((region) => {
      probeStates.value.set(region.value, "measuring");
    });
    await Promise.all(regions.map((region) => getLatency(region.value)));
    isRefreshing.value = false;
  }

  // The api checks a LAN region against this session's own probe and forgets
  // it an hour after it ran, so a reading stored on this device can't stand
  // in. The LAN is probed once a page load, again before the hour is up while
  // on it, and sooner once a probe has lost it.
  const LAN_REPROBE_MS = 45 * 60 * 1000;
  const LAN_RETRY_MS = 5 * 60 * 1000;
  let lanProbeStarted = false;
  let lanSeen = false;
  let lanReprobe: ReturnType<typeof setTimeout> | undefined;

  function scheduleLanProbe(delay: number) {
    clearTimeout(lanReprobe);
    lanReprobe = setTimeout(probeLan, delay);
  }

  async function probeLan() {
    await Promise.all(
      useApplicationSettingsStore()
        .availableRegions.filter((region) => region.is_lan)
        .map((region) => getLatency(region.value)),
    );
    lanSeen ||= onLan.value;
    if (lanSeen) {
      scheduleLanProbe(onLan.value ? LAN_REPROBE_MS : LAN_RETRY_MS);
    }
  }

  function checkLatenies() {
    // Guests can't matchmake; don't open WebRTC peer connections for them.
    if (!useAuthStore().me?.steam_id) {
      return;
    }
    if (latencies.value.size === 0) {
      refreshLatencies();
    }
    if (
      !lanProbeStarted &&
      useApplicationSettingsStore().availableRegions.some(
        (region) => region.is_lan,
      )
    ) {
      lanProbeStarted = true;
      probeLan();
    }
  }

  async function getLatency(region: string) {
    probeStates.value.set(region, "measuring");

    return new Promise(async (resolve) => {
      let settled = false;
      const settle = (reachable: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        if (reachable) {
          probeStates.value.delete(region);
        } else {
          // Drop the stale reading so we never show a number for a region we
          // could not reach on this pass.
          probeStates.value.set(region, "unreachable");
          latencies.value.delete(region);
          localStorage.removeItem(REGION_LATENCY_PREFIX + region);
        }
        resolve(undefined);
      };

      // Reaching the timeout means this pass never answered. Deliberately not
      // conditioned on `latencies` holding a value: readings survive a refresh
      // now, so a region that was reachable last week would settle as healthy
      // forever on a stale number.
      setTimeout(() => {
        settle(false);
      }, 5000);

      try {
        const buffer = new Uint8Array([0x01]).buffer;

        // Imported here rather than at module scope: this is the only thing in
        // the store that touches WebRTC, and a static import pulls simple-peer
        // (96KB) into the entry chunk for every visitor -- including the ones
        // who never open matchmaking. AuthStore constructs this store eagerly.
        const { webrtc } = await import("~/web-sockets/Webrtc");

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
            settle(true);
          }
        });

        datachannel.send("latency-test");
      } catch (error) {
        console.error(`Failed to get latency for ${region}`, error);
        settle(false);
      }
    });
  }

  // Regions a player can be matched into: node-backed, and a LAN region only
  // when the probe says you are on that LAN.
  function isMatchmakingRegion(region: {
    value: string;
    is_lan: boolean;
    has_node: boolean;
  }) {
    return (
      region.has_node &&
      (!region.is_lan || !!getRegionlatencyResult(region.value)?.isLan)
    );
  }

  function getRegionProbeState(region: string) {
    return probeStates.value.get(region);
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

  // The regions you can reach on a LAN you are actually on.
  const lanRegions = computed(() =>
    useApplicationSettingsStore().availableRegions.filter(
      (region) =>
        region.is_lan && !!getRegionlatencyResult(region.value)?.isLan,
    ),
  );
  const onLan = computed(() => lanRegions.value.length > 0);

  // Any probe can lose the LAN, a full refresh as much as the LAN's own, and
  // waiting out the 45 minutes would hide it that long.
  watch(onLan, (on) => {
    if (on) {
      lanSeen = true;
    } else if (lanSeen) {
      scheduleLanProbe(LAN_RETRY_MS);
    }
  });

  // On a LAN you play there or online, never both. Asked the first time you
  // queue or host this session; switchable from the region line.
  const playWhere = ref<"lan" | "online" | null>(
    (() => {
      try {
        const value = sessionStorage.getItem(PLAY_WHERE_KEY);
        return value === "lan" || value === "online" ? value : null;
      } catch {
        return null;
      }
    })(),
  );

  function setPlayWhere(where: "lan" | "online") {
    playWhere.value = where;
    try {
      sessionStorage.setItem(PLAY_WHERE_KEY, where);
    } catch {}
  }

  const playWherePrompt = ref<{
    kind: "queue" | "room";
    anchor: HTMLElement | null;
    resolve: (where: "lan" | "online" | null) => void;
  } | null>(null);

  // Resolves true once it is settled where to play: straight away off a LAN or
  // when already chosen, otherwise after the player picks in the prompt.
  function ensurePlayWhere(
    kind: "queue" | "room",
    anchor: HTMLElement | null = null,
  ): Promise<boolean> {
    if (!onLan.value || playWhere.value) {
      return Promise.resolve(true);
    }
    playWherePrompt.value?.resolve(null);
    return new Promise((resolve) => {
      playWherePrompt.value = {
        kind,
        anchor,
        resolve: (where) => {
          playWherePrompt.value = null;
          if (where) {
            setPlayWhere(where);
          }
          resolve(!!where);
        },
      };
    });
  }

  const onlineRegions = computed(() => {
    const availableRegions =
      useApplicationSettingsStore().availableRegions.filter((region) => {
        if (region.is_lan) {
          return false;
        }

        const regionLatency = getRegionlatencyResult(region.value);

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
      .sort(
        (a, b) =>
          Number(getRegionlatencyResult(a.value)?.latency) -
          Number(getRegionlatencyResult(b.value)?.latency),
      );
  });

  const preferredRegions = computed(() =>
    onLan.value && playWhere.value === "lan"
      ? lanRegions.value
      : onlineRegions.value,
  );

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
    friendsLoaded,
    onlineFriends,
    offlineFriends,
    registeredFriendsOnly,
    isRegisteredFriend,
    lobbies,
    lobbiesLoaded,
    currentLobby,
    regionStats,
    onlinePlayerSteamIds,
    onlineCount,
    presenceLoaded,
    setFriendsOnline,
    setFriendPresence,
    setOnlineCount,
    setLegacyRoster,
    sendFriendsOnlineRequest,
    lanRegion,
    lanPlayers,
    lanArrivals,
    lanLeft,
    setLanRoster,
    applyLanPresence,
    checkOnline,
    setOnlineCheck,
    sendOnlineCheck,
    myTeams,
    loadMyTeams,
    ensureMyTeams,
    joinedMatchmakingQueues,

    checkLatenies,
    refreshLatencies,
    isRefreshing,
    getRegionlatencyResult,
    getRegionProbeState,
    isMatchmakingRegion,
    togglePreferredRegion,
    updateMaxAcceptableLatency,

    latencies,
    storedRegions,
    preferredRegions,
    onlineRegions,
    lanRegions,
    onLan,
    playWhere,
    setPlayWhere,
    playWherePrompt,
    ensurePlayWhere,
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
