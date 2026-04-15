import { computed, ref, type ComputedRef, type Ref } from "vue";
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
  isMatchOrganizer: ComputedRef<boolean>;
  isTournamentOrganizer: ComputedRef<boolean>;
  isAdmin: ComputedRef<boolean>;
  hasDiscordLinked: Ref<boolean>;
  hasCheckedSession: Ref<boolean>;
  isRoleAbove: (role: e_player_roles_enum) => boolean;
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

  useSearchStore();
  useMatchmakingStore();
  useNotificationStore();
  useApplicationSettingsStore();

  const roleOrder = [
    e_player_roles_enum.user,
    e_player_roles_enum.verified_user,
    e_player_roles_enum.streamer,
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

    const nextSnapshot = JSON.stringify(nextMe);
    if (nextSnapshot === meSnapshot) {
      return false;
    }

    meSnapshot = nextSnapshot;
    me.value = nextMe;
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

    if (
      !shouldStartBaseSubscriptions &&
      !shouldStartManagingMatches &&
      !shouldStartManagingTournaments
    ) {
      return;
    }

    if (shouldStartBaseSubscriptions) {
      postAuthSubscriptionsStarted = true;
      useMatchLobbyStore().subscribeToMyMatches();
      useMatchLobbyStore().subscribeToLiveMatches();
      useMatchLobbyStore().subscribeToLiveTournaments();
      useMatchLobbyStore().subscribeToOpenRegistrationTournaments();
      useMatchLobbyStore().subscribeToOpenMatches();
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

  async function getMe(): Promise<boolean> {
    if (me.value?.steam_id) {
      hasCheckedSession.value = true;
      return true;
    }

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

  const isUser = computed(() => me.value?.role === e_player_roles_enum.user);

  const isVerifiedUser = computed(
    () => me.value?.role === e_player_roles_enum.verified_user,
  );

  const isStreamer = computed(
    () => me.value?.role === e_player_roles_enum.streamer,
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

  return {
    me,
    getMe,
    isUser,
    isVerifiedUser,
    isStreamer,
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
