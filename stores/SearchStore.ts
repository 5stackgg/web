import MiniSearch from "minisearch";
import { defineStore, acceptHMRUpdate } from "pinia";
import { useMatchMakingStore } from "./MatchMakingStore";

export const useSearchStore = defineStore("searchStore", () => {
  const matchMakingStore = useMatchMakingStore();

  let miniSearch: MiniSearch;

  watch(
    () => matchMakingStore.playersOnline,
    (
      players: Array<{
        steam_id: string;
        name: string;
        avatar_url: string;
        country: string;
      }>,
    ) => {
      miniSearch = new MiniSearch({
        fields: ["name", "steam_id"],
        storeFields: ["steam_id", "name", "avatar_url", "country"],
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
        };
      });
    },
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSearchStore, import.meta.hot));
}