import MiniSearch from "minisearch";
import { defineStore, acceptHMRUpdate } from "pinia";
import { useMatchmakingStore } from "./MatchmakingStore";

export const useSearchStore = defineStore("searchStore", () => {
  const matchMakingStore = useMatchmakingStore();

  let miniSearch: MiniSearch;

  // Online now means online friends, so searching everyone is the default.
  const onlineOnly = ref<boolean>(
    localStorage.getItem("playerSearchOnlineOnly") === "true",
  );

  // Off by default: searching an unregistered Steam account is the point of
  // the search, this only narrows it to people who have signed in here.
  const registeredOnly = ref<boolean>(
    localStorage.getItem("playerSearchRegisteredOnly") === "true",
  );

  const onlinePlayers = computed(() => {
    const onlineIds = new Set(
      matchMakingStore.onlinePlayerSteamIds as string[],
    );

    return ((matchMakingStore.friends as any[]) || []).filter(
      (friend) => friend?.steam_id && onlineIds.has(String(friend.steam_id)),
    );
  });

  watch(
    onlinePlayers,
    (players) => {
      miniSearch = new MiniSearch({
        fields: ["name", "steam_id"],
        storeFields: [
          "steam_id",
          "name",
          "avatar_url",
          "country",
          "is_banned",
          "is_muted",
          "is_gagged",
          "role",
          "elo",
        ],
        searchOptions: {
          fuzzy: 0.2,
          prefix: true,
        },
      });

      miniSearch.addAll(
        players.map((player) => ({ id: player.steam_id, ...player })),
      );
    },
    { immediate: true },
  );

  return {
    onlineOnly,
    registeredOnly,
    // Returns every match; the caller windows it (PlayerSearch pages through
    // this list the same way it pages the Typesense results).
    search: (query: string, exclude: string[]) => {
      if (!query) {
        return onlinePlayers.value.filter(
          (player) => !exclude.includes(player.steam_id),
        );
      }

      const results = miniSearch.search(query, {
        filter: (result) => !exclude.includes(result.steam_id),
      });

      return results.map((result) => ({
        steam_id: result.steam_id,
        name: result.name,
        avatar_url: result.avatar_url,
        country: result.country,
        is_banned: result.is_banned,
        is_muted: result.is_muted,
        is_gagged: result.is_gagged,
        role: result.role,
        elo: result.elo,
      }));
    },
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSearchStore, import.meta.hot));
}
