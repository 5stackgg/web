import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";

export const useMatchLobbyStore = defineStore("matchLobby", {
    state: (): {
        lobbies: Array<Record<string, Map<string, unknown>>>;
    } => {
        return {
            lobbies: ref({}),
        };
    },
    actions: {
        add(matchId: string, user: {
            name,
            steam_id,
            avatar_url
        }) {
            if(!this.lobbies[matchId]) {
                this.lobbies[matchId] = new Map()
            }
            this.lobbies[matchId].set(user.steam_id, user);
        },
        set(matchId, users) {
            this.lobbies[matchId] = new Map()

            for(const user of users) {
                this.lobbies[matchId].set(user.steam_id, user);
            }
        },
        remove(matchId: string, user: {
            steam_id,
        }) {
            this.lobbies[matchId]?.delete(user.steam_id);
        },
    },
});


if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useMatchLobbyStore, import.meta.hot));
}
