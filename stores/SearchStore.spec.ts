import { createPinia, setActivePinia } from "pinia";

const playersOnline = ref<any[]>([]);

vi.mock("~/stores/MatchmakingStore", () => ({
  useMatchmakingStore: () => ({
    playersOnline: playersOnline.value,
  }),
}));

import { useSearchStore } from "./SearchStore";

const makePlayers = (names: string[]) =>
  names.map((name, i) => ({
    steam_id: `steam-${i}`,
    name,
    avatar_url: "",
    country: "US",
    is_banned: false,
    is_muted: false,
    is_gagged: false,
  }));

describe("SearchStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    playersOnline.value = [];
    localStorage.removeItem("playerSearchOnlineOnly");
  });

  it("empty query returns first 10 players from playersOnline", () => {
    playersOnline.value = makePlayers(Array.from({ length: 15 }, (_, i) => `Player${i}`));
    const store = useSearchStore();
    const results = store.search("", []);
    expect(results).toHaveLength(10);
  });

  it("empty query excludes players in exclude list", () => {
    playersOnline.value = makePlayers(["Alice", "Bob", "Charlie"]);
    const store = useSearchStore();
    const results = store.search("", ["steam-1"]); // exclude Bob
    expect(results).toHaveLength(2);
    expect(results.find((r: any) => r.name === "Bob")).toBeUndefined();
  });

  it("search query returns fuzzy-matched results", () => {
    playersOnline.value = makePlayers(["Alice", "Bob", "Charlie"]);
    const store = useSearchStore();
    const results = store.search("Alice", []);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Alice");
  });

  it("search excludes players in exclude list", () => {
    playersOnline.value = makePlayers(["Alice", "Alicia", "Bob"]);
    const store = useSearchStore();
    const results = store.search("Ali", ["steam-0"]); // exclude Alice
    expect(results.find((r: any) => r.name === "Alice")).toBeUndefined();
  });

  it("onlineOnly defaults to true", () => {
    const store = useSearchStore();
    expect(store.onlineOnly).toBe(true);
  });

  it("onlineOnly reads from localStorage", () => {
    localStorage.setItem("playerSearchOnlineOnly", "false");
    const store = useSearchStore();
    expect(store.onlineOnly).toBe(false);
  });
});
