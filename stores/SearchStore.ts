import MiniSearch from "minisearch";
import { defineStore, acceptHMRUpdate } from "pinia";
import { useMatchmakingStore } from "./MatchmakingStore";

export const useSearchStore = defineStore("searchStore", () => {
  const matchMakingStore = useMatchmakingStore();

  let miniSearch: MiniSearch;

  const onlineOnly = ref<boolean>(
    localStorage.getItem("playerSearchOnlineOnly") !== "false",
  );

  watch(
    () => matchMakingStore.playersOnline,
    (
      players: Array<{
        steam_id: string;
        name: string;
        avatar_url: string;
        country: string;
        is_banned: boolean;
        is_muted: boolean;
        is_gagged: boolean;
      }>,
    ) => {
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
        ],
        searchOptions: {
          fuzzy: 0.2,
          prefix: true,
        },
      });

      miniSearch.addAll(
        players.map((player) => {
          const _player = Object.assign(
            {
              id: player.steam_id,
            },
            player,
          );
          return _player;
        }),
      );
    },
    { immediate: true },
  );

  return {
    onlineOnly,
    search: (query: string, exclude: [string]) => {
      if (!query) {
        return matchMakingStore.playersOnline
          .slice(0, 10)
          .filter((player) => !exclude.includes(player.steam_id));
      }

      const results = miniSearch.search(
        query,
        exclude
          ? {
              filter: (result) => {
                return !exclude.includes(result.steam_id);
              },
            }
          : undefined,
      );

      return results.map((result) => {
        return {
          steam_id: result.steam_id,
          name: result.name,
          avatar_url: result.avatar_url,
          country: result.country,
          is_banned: result.is_banned,
          is_muted: result.is_muted,
          is_gagged: result.is_gagged,
        };
      });
    },
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSearchStore, import.meta.hot));
}
