import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { generateQuery } from "~/graphql/graphqlGen";
import { meFields } from "~/graphql/meGraphql";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { e_player_roles_enum } from "~/generated/zeus";

export const useAuthStore = defineStore("auth", () => {
  const me = ref<typeof meFields>();

  // TODO - move the listens to the socket store ?
  // Initialize MatchMakingStore, this is required for sockets listens to get initialized
  useMatchMakingStore();
  useApplicationSettingsStore();

  async function getMe() {
    try {
      const response = await getGraphqlClient().query({
        query: generateQuery({
          me: meFields,
        }),
      });
      me.value = response.data.me;
      return me.value;
    } catch (error) {
      console.info("auth failure", error);
    }
  }

  const isAdmin = computed(
    () => me.value?.role === e_player_roles_enum.administrator,
  );
  const isTournamentOrganizer = computed(
    () => me.value?.role === e_player_roles_enum.tournament_organizer,
  );

  return {
    me,
    getMe,
    isAdmin,
    isTournamentOrganizer,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
