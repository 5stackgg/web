import { ref } from "vue";
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

export const useAuthStore = defineStore("auth", () => {
  const me = ref<InputType<GraphQLTypes["players"], typeof meFields>>();
  const hasDiscordLinked = ref<boolean>(false);

  useSearchStore();
  useMatchmakingStore();
  useNotificationStore();
  useApplicationSettingsStore();

  async function getMe(): Promise<boolean> {
    function subscribeToMe(steam_id: string, callback: () => void) {
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
          me.value = data?.players_by_pk;
          callback();
        },
      });
    }

    return await new Promise(async (resolve) => {
      try {
        const response = await getGraphqlClient().query({
          query: generateQuery({
            me: {
              steam_id: true,
              discord_id: true,
            },
          }),
          fetchPolicy: "network-only", // Disable cache
        });

        if (!response.data.me) {
          resolve(false);
          return;
        }

        socket.connect();

        hasDiscordLinked.value = !!response.data.me.discord_id;

        subscribeToMe(response.data.me.steam_id, () => {
          useMatchLobbyStore().subscribeToMyMatches();
          resolve(true);
        });
      } catch (error) {
        console.warn("auth failure", error);
        resolve(false);
      }
    });
  }

  const isUser = computed(() => me.value?.role === e_player_roles_enum.user);

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
    isAdmin,
    hasDiscordLinked,
    isMatchOrganizer,
    isTournamentOrganizer,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
