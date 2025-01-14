import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";

export const useTeamLobbyStore = defineStore("notifaicationStore", () => {
  const teamLobbies = ref([]);

  return {
    teamLobbies,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTeamLobbyStore, import.meta.hot));
}
