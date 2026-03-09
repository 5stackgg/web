const matchmakingMock = {
  matchInvites: [] as any[],
  lobbyInvites: [] as any[],
  friends: [] as any[],
};

const authMock = {
  me: { steam_id: "my-steam-id" } as any,
};

vi.mock("~/stores/MatchmakingStore", () => ({
  useMatchmakingStore: () => matchmakingMock,
}));

// useMatchmakingStore is auto-imported in Nuxt, provide global too
(globalThis as any).useMatchmakingStore = () => matchmakingMock;
(globalThis as any).useAuthStore = () => authMock;

import { useInvites } from "./useInvites";

describe("useInvites", () => {
  beforeEach(() => {
    matchmakingMock.matchInvites = [];
    matchmakingMock.lobbyInvites = [];
    matchmakingMock.friends = [];
    authMock.me = { steam_id: "my-steam-id" };
  });

  it("returns pendingFriends sorted by name", () => {
    matchmakingMock.friends = [
      { name: "Charlie", status: "Pending", invited_by_steam_id: "other" },
      { name: "Alice", status: "Pending", invited_by_steam_id: "other" },
      { name: "Bob", status: "Pending", invited_by_steam_id: "other" },
    ];

    const { pendingFriends } = useInvites();
    expect(pendingFriends.value.map((f: any) => f.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("filters pendingFriends: status Pending AND not invited by current user", () => {
    matchmakingMock.friends = [
      { name: "Pending-Other", status: "Pending", invited_by_steam_id: "other-id" },
      { name: "Pending-Me", status: "Pending", invited_by_steam_id: "my-steam-id" },
      { name: "Accepted", status: "Accepted", invited_by_steam_id: "other-id" },
    ];

    const { pendingFriends } = useInvites();
    expect(pendingFriends.value).toHaveLength(1);
    expect(pendingFriends.value[0].name).toBe("Pending-Other");
  });

  it("hasInvites true when matchInvites non-empty", () => {
    matchmakingMock.matchInvites = [{ id: "1" }];
    const { hasInvites } = useInvites();
    expect(hasInvites.value).toBe(true);
  });

  it("hasInvites true when lobbyInvites non-empty", () => {
    matchmakingMock.lobbyInvites = [{ id: "1" }];
    const { hasInvites } = useInvites();
    expect(hasInvites.value).toBe(true);
  });

  it("hasInvites true when pendingFriends non-empty", () => {
    matchmakingMock.friends = [
      { name: "Pending", status: "Pending", invited_by_steam_id: "other-id" },
    ];
    const { hasInvites } = useInvites();
    expect(hasInvites.value).toBe(true);
  });

  it("hasInvites false when all empty", () => {
    const { hasInvites } = useInvites();
    expect(hasInvites.value).toBe(false);
  });

  it("totalCount sums all three arrays", () => {
    matchmakingMock.matchInvites = [{ id: "1" }, { id: "2" }];
    matchmakingMock.lobbyInvites = [{ id: "3" }];
    matchmakingMock.friends = [
      { name: "Pending", status: "Pending", invited_by_steam_id: "other-id" },
    ];

    const { totalCount } = useInvites();
    expect(totalCount.value).toBe(4);
  });
});
