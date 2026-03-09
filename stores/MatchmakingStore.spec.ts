import { createPinia, setActivePinia } from "pinia";

const authMock = {
  me: null as any,
};

const appSettingsMock = {
  availableRegions: [] as any[],
  maxAcceptableLatency: "75" as string | undefined,
};

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: () => ({ subscribe: vi.fn() }),
    query: vi.fn().mockResolvedValue({ data: { players: [] } }),
  }),
}));
vi.mock("~/graphql/graphqlGen", () => ({
  generateQuery: vi.fn(),
  generateSubscription: vi.fn(),
}));
vi.mock("~/graphql/playerFields", () => ({
  playerFields: {},
}));
vi.mock("~/generated/zeus/typedDocumentNode", () => ({
  typedGql: vi.fn(() => ({})),
}));
vi.mock("~/web-sockets/Webrtc", () => ({
  webrtc: { connect: vi.fn() },
}));

(globalThis as any).useAuthStore = () => authMock;
(globalThis as any).useApplicationSettingsStore = () => appSettingsMock;

import { useMatchmakingStore } from "./MatchmakingStore";

describe("MatchmakingStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    authMock.me = null;
    appSettingsMock.availableRegions = [];
    appSettingsMock.maxAcceptableLatency = "75";
    localStorage.removeItem("5stack_preferred_regions");
    localStorage.removeItem("5stack_max_acceptable_latency");
  });

  describe("onlineFriends", () => {
    it("filters out Pending friends", () => {
      const store = useMatchmakingStore();
      store.friends = [
        { steam_id: "1", status: "Accepted" },
        { steam_id: "2", status: "Pending" },
      ] as any;
      store.onlinePlayerSteamIds = ["1", "2"];
      expect(store.onlineFriends).toHaveLength(1);
      expect(store.onlineFriends[0].steam_id).toBe("1");
    });

    it("includes only friends in onlinePlayerSteamIds", () => {
      const store = useMatchmakingStore();
      store.friends = [
        { steam_id: "1", status: "Accepted" },
        { steam_id: "2", status: "Accepted" },
      ] as any;
      store.onlinePlayerSteamIds = ["1"];
      expect(store.onlineFriends).toHaveLength(1);
      expect(store.onlineFriends[0].steam_id).toBe("1");
    });
  });

  describe("offlineFriends", () => {
    it("filters out Pending friends", () => {
      const store = useMatchmakingStore();
      store.friends = [
        { steam_id: "1", status: "Accepted" },
        { steam_id: "2", status: "Pending" },
      ] as any;
      store.onlinePlayerSteamIds = [];
      expect(store.offlineFriends).toHaveLength(1);
      expect(store.offlineFriends[0].steam_id).toBe("1");
    });

    it("includes only friends NOT in onlinePlayerSteamIds", () => {
      const store = useMatchmakingStore();
      store.friends = [
        { steam_id: "1", status: "Accepted" },
        { steam_id: "2", status: "Accepted" },
      ] as any;
      store.onlinePlayerSteamIds = ["1"];
      expect(store.offlineFriends).toHaveLength(1);
      expect(store.offlineFriends[0].steam_id).toBe("2");
    });
  });

  describe("lobbyInvites", () => {
    it("filters out lobby matching me.current_lobby_id", () => {
      authMock.me = { current_lobby_id: "lobby-1" };
      const store = useMatchmakingStore();
      store.lobbies = [
        { id: "lobby-1" },
        { id: "lobby-2" },
      ] as any;
      expect(store.lobbyInvites).toHaveLength(1);
      expect(store.lobbyInvites[0].id).toBe("lobby-2");
    });

    it("returns empty when lobbies is empty", () => {
      const store = useMatchmakingStore();
      store.lobbies = [] as any;
      expect(store.lobbyInvites).toHaveLength(0);
    });
  });

  describe("currentLobby", () => {
    it("finds lobby matching me.current_lobby_id", () => {
      authMock.me = { current_lobby_id: "lobby-1" };
      const store = useMatchmakingStore();
      store.lobbies = [
        { id: "lobby-1", access: "Friends" },
        { id: "lobby-2", access: "Open" },
      ] as any;
      expect(store.currentLobby).toEqual({ id: "lobby-1", access: "Friends" });
    });

    it("returns undefined when no match", () => {
      authMock.me = { current_lobby_id: "lobby-999" };
      const store = useMatchmakingStore();
      store.lobbies = [{ id: "lobby-1" }] as any;
      expect(store.currentLobby).toBeUndefined();
    });
  });

  describe("getRegionlatencyResult", () => {
    it("returns undefined when no latency data", () => {
      const store = useMatchmakingStore();
      expect(store.getRegionlatencyResult("us-east")).toBeUndefined();
    });

    it("returns formatted latency and isLan", () => {
      const store = useMatchmakingStore();
      store.latencies.set("us-east", { latency: 12.345, isLan: false } as any);
      const result = store.getRegionlatencyResult("us-east");
      expect(result).toEqual({ latency: "12.35", isLan: false });
    });
  });

  describe("togglePreferredRegion", () => {
    it("adds region", () => {
      const store = useMatchmakingStore();
      store.togglePreferredRegion("us-east");
      expect(store.storedRegions).toContain("us-east");
      expect(JSON.parse(localStorage.getItem("5stack_preferred_regions")!)).toContain("us-east");
    });

    it("removes existing region", () => {
      const store = useMatchmakingStore();
      store.togglePreferredRegion("us-east");
      store.togglePreferredRegion("us-east");
      expect(store.storedRegions).not.toContain("us-east");
    });
  });

  describe("updateMaxAcceptableLatency", () => {
    it("updates ref and persists to localStorage", () => {
      const store = useMatchmakingStore();
      store.updateMaxAcceptableLatency(100);
      expect(store.playerMaxAcceptableLatency).toBe(100);
      expect(localStorage.getItem("5stack_max_acceptable_latency")).toBe("100");
    });
  });
});
