import { computed, nextTick, ref, type ComputedRef, type Ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { meFields } from "~/graphql/meGraphql";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  e_player_roles_enum,
  type GraphQLTypes,
  type InputType,
} from "~/generated/zeus";
import socket from "~/web-sockets/Socket";

type AuthMe = InputType<GraphQLTypes["players"], typeof meFields>;

type AuthStoreSetup = {
  me: Ref<AuthMe | undefined>;
  getMe: () => Promise<boolean>;
  isUser: ComputedRef<boolean>;
  isVerifiedUser: ComputedRef<boolean>;
  isStreamer: ComputedRef<boolean>;
  isModerator: ComputedRef<boolean>;
  isMatchOrganizer: ComputedRef<boolean>;
  isTournamentOrganizer: ComputedRef<boolean>;
  isAdmin: ComputedRef<boolean>;
  hasDiscordLinked: Ref<boolean>;
  hasCheckedSession: Ref<boolean>;
  isRoleAbove: (role: e_player_roles_enum) => boolean;
  clearMe: () => void;
};

export const useAuthStore = defineStore("auth", (): AuthStoreSetup => {
  const me = ref<AuthMe>();
  const hasDiscordLinked = ref<boolean>(false);
  const hasCheckedSession = ref(false);
  let meSnapshot = "";
  let getMePromise: Promise<boolean> | null = null;
  let meSubscriptionStarted = false;
  let postAuthSubscriptionsStarted = false;
  let managingMatchesSubscriptionStarted = false;
  let managingTournamentsSubscriptionStarted = false;
  let activeStreamingMatchesSubscriptionStarted = false;
  let gpuPoolSubscriptionStarted = false;
  let renderQueueSubscriptionStarted = false;

  const ME_CACHE_KEY = "5stack:me";

  function loadCachedMe(): AuthMe | undefined {
    try {
      const cached = localStorage.getItem(ME_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    return undefined;
  }

  function clearMe() {
    me.value = undefined;
    meSnapshot = "";
    hasDiscordLinked.value = false;
    try {
      localStorage.removeItem(ME_CACHE_KEY);
    } catch {}
  }

  useSearchStore();
  useMatchmakingStore();
  useNotificationStore();
  useApplicationSettingsStore();

  const roleOrder = [
    e_player_roles_enum.user,
    e_player_roles_enum.verified_user,
    e_player_roles_enum.streamer,
    e_player_roles_enum.moderator,
    e_player_roles_enum.match_organizer,
    e_player_roles_enum.tournament_organizer,
    e_player_roles_enum.administrator,
  ];

  function isRoleAbove(role: e_player_roles_enum) {
    if (!me.value) {
      return false;
    }

    const meRoleIndex = roleOrder.indexOf(me.value.role);
    const roleIndex = roleOrder.indexOf(role);

    return meRoleIndex >= roleIndex;
  }

  function setMe(nextMe?: AuthMe | null) {
    if (!nextMe) {
      return false;
    }

    const previousRole = me.value?.role;
    const previousSteamId = me.value?.steam_id;
    const nextSnapshot = JSON.stringify(nextMe);
    if (nextSnapshot === meSnapshot) {
      return false;
    }

    meSnapshot = nextSnapshot;
    me.value = nextMe;

    try {
      localStorage.setItem(ME_CACHE_KEY, nextSnapshot);
    } catch {}

    if (
      previousSteamId === nextMe.steam_id &&
      previousRole &&
      previousRole !== nextMe.role
    ) {
      void nextTick(() => {
        socket.rejoinAll();
      });
    }

    return true;
  }

  function startPostAuthSubscriptions() {
    if (!me.value) {
      return;
    }

    const shouldStartBaseSubscriptions = !postAuthSubscriptionsStarted;
    const shouldStartManagingMatches =
      isRoleAbove(e_player_roles_enum.match_organizer) &&
      !managingMatchesSubscriptionStarted;
    const shouldStartManagingTournaments =
      isRoleAbove(e_player_roles_enum.tournament_organizer) &&
      !managingTournamentsSubscriptionStarted;
    const shouldStartActiveStreamingMatches =
      isRoleAbove(e_player_roles_enum.streamer) &&
      !activeStreamingMatchesSubscriptionStarted;
    const shouldStartGpuPool =
      isRoleAbove(e_player_roles_enum.streamer) && !gpuPoolSubscriptionStarted;
    const shouldStartRenderQueue =
      isRoleAbove(e_player_roles_enum.administrator) &&
      !renderQueueSubscriptionStarted;

    if (
      !shouldStartBaseSubscriptions &&
      !shouldStartManagingMatches &&
      !shouldStartManagingTournaments &&
      !shouldStartActiveStreamingMatches &&
      !shouldStartGpuPool &&
      !shouldStartRenderQueue
    ) {
      return;
    }

    if (shouldStartBaseSubscriptions) {
      postAuthSubscriptionsStarted = true;
      useDraftGamesStore().subscribeToMyDraftGame(me.value.steam_id);
      useMatchLobbyStore().subscribeToMyMatches();
      useMatchLobbyStore().subscribeToLiveMatches();
      useMatchLobbyStore().subscribeToLiveTournaments();
      useMatchLobbyStore().subscribeToOpenRegistrationTournaments();
      // Chat-scoped tournaments (live & joined, or organizer)
      useMatchLobbyStore().subscribeToChatTournaments();
    }

    if (shouldStartManagingMatches) {
      managingMatchesSubscriptionStarted = true;
      useMatchLobbyStore().subscribeToManagingMatches();
    }

    if (shouldStartManagingTournaments) {
      managingTournamentsSubscriptionStarted = true;
      useMatchLobbyStore().subscribeToManagingTournaments();
    }

    if (shouldStartActiveStreamingMatches) {
      activeStreamingMatchesSubscriptionStarted = true;
      useStreamerStore().subscribeToLiveStreams();
    }

    if (shouldStartGpuPool) {
      gpuPoolSubscriptionStarted = true;
      useGpuPoolStatusStore().subscribeToPool();
    }

    if (shouldStartRenderQueue) {
      renderQueueSubscriptionStarted = true;
      useRenderQueueStatusStore().subscribeToInFlight();
    }
  }

  function subscribeToMe(steam_id: string) {
    if (meSubscriptionStarted) {
      return;
    }

    meSubscriptionStarted = true;
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        players_by_pk: [
          {
            steam_id,
          },
          meFields,
        ],
      }),
    });

    subscription.subscribe({
      next: ({ data }) => {
        setMe(data?.players_by_pk);
        startPostAuthSubscriptions();
      },
      error: (error) => {
        meSubscriptionStarted = false;
        console.error("Error in me subscription:", error);
      },
    });
  }

  function startRealtimeAuth(steamId: string) {
    try {
      socket.connect();

      subscribeToMe(steamId);
      startPostAuthSubscriptions();
    } catch (error) {
      console.error("auth realtime startup failure", error);
    }
  }

  function fetchMe(): Promise<boolean> {
    if (getMePromise) {
      return getMePromise;
    }

    getMePromise = (async () => {
      try {
        const response = await getGraphqlClient().query({
          query: generateQuery({
            me: {
              steam_id: true,
              role: true,
              discord_id: true,
              player: meFields,
            },
          }),
          fetchPolicy: "network-only", // Disable cache
        });
        const initialMe = response.data.me?.player;

        if (!initialMe) {
          clearMe();
          return false;
        }

        setMe(initialMe);
        hasDiscordLinked.value = !!response.data.me.discord_id;
        startRealtimeAuth(initialMe.steam_id);

        return true;
      } catch (error) {
        console.warn("auth failure", error);
        return false;
      } finally {
        hasCheckedSession.value = true;
        getMePromise = null;
      }
    })();

    return getMePromise;
  }

  async function getMe(): Promise<boolean> {
    if (me.value?.steam_id) {
      hasCheckedSession.value = true;
      return true;
    }

    return fetchMe();
  }

  const isUser = computed(() => me.value?.role === e_player_roles_enum.user);

  const isVerifiedUser = computed(
    () => me.value?.role === e_player_roles_enum.verified_user,
  );

  const isStreamer = computed(
    () => me.value?.role === e_player_roles_enum.streamer,
  );

  const isModerator = computed(
    () => me.value?.role === e_player_roles_enum.moderator,
  );

  const isAdmin = computed(
    () => me.value?.role === e_player_roles_enum.administrator,
  );

  const isMatchOrganizer = computed(
    () => me.value?.role === e_player_roles_enum.match_organizer,
  );

  const isTournamentOrganizer = computed(
    () => me.value?.role === e_player_roles_enum.tournament_organizer,
  );

  const cachedMe = loadCachedMe();
  if (cachedMe?.steam_id) {
    me.value = cachedMe;
    meSnapshot = JSON.stringify(cachedMe);
    hasCheckedSession.value = true;
    void fetchMe();
  }

  return {
    me,
    getMe,
    clearMe,
    isUser,
    isVerifiedUser,
    isStreamer,
    isModerator,
    isMatchOrganizer,
    isTournamentOrganizer,
    isAdmin,
    hasDiscordLinked,
    hasCheckedSession,
    isRoleAbove,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
