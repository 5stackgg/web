import MiniSearch from "minisearch";
import { defineStore, acceptHMRUpdate } from "pinia";
import { useMatchmakingStore } from "./MatchmakingStore";

export const useSearchStore = defineStore("searchStore", () => {
  const matchMakingStore = useMatchmakingStore();

  let miniSearch: MiniSearch;

  const onlineOnly = ref<boolean>(
    localStorage.getItem("playerSearchOnlineOnly") !== "false",
  );

  const onlinePlayers = computed(() => {
    const onlineIds = new Set(
      matchMakingStore.onlinePlayerSteamIds as string[],
    );
    const merged = new Map<string, any>();

    for (const player of matchMakingStore.playersOnline as any[]) {
      if (player?.steam_id && onlineIds.has(player.steam_id)) {
        merged.set(player.steam_id, player);
      }
    }

    for (const friend of (matchMakingStore.friends as any[]) || []) {
      if (
        friend?.steam_id &&
        onlineIds.has(friend.steam_id) &&
        !merged.has(friend.steam_id)
      ) {
        merged.set(friend.steam_id, friend);
      }
    }

    return Array.from(merged.values());
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
    search: (query: string, exclude: string[]) => {
      if (!query) {
        return onlinePlayers.value
          .slice(0, 10)
          .filter((player) => !exclude.includes(player.steam_id));
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
