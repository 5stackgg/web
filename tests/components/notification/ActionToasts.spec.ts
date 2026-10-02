import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import ActionToasts from "~/components/notification/ActionToasts.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useNotificationStore } from "~/stores/NotificationStore";
import { useCallInvites } from "~/composables/useVoiceAnnouncements";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const { navigateToMock, currentRoute } = vi.hoisted(() => ({
  navigateToMock: vi.fn(),
  currentRoute: { path: "/" },
}));

mockNuxtImport("navigateTo", () => navigateToMock);
mockNuxtImport("useRoute", () => () => currentRoute);

const ME = "76561198000000001";
const STORAGE_KEY = `5stack:dismissed-action-toasts:${ME}`;

const pendingFriend = (steamId: string, name: string) => ({
  steam_id: steamId,
  name,
  status: "Pending",
  invited_by_steam_id: steamId,
});

const stored = (): string[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

let unmount: (() => void) | undefined;

async function mountToasts() {
  const wrapper = await mountSuspended(ActionToasts, {
    global: { stubs: { VoiceRosterPreview: true } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountToasts>>;

async function dismissToast(wrapper: Wrapper, text: string) {
  const card = wrapper
    .findAll(".toast-card")
    .find((candidate) => candidate.text().includes(text));
  expect(card, `no toast showing "${text}"`).toBeDefined();
  await card!.find(".toast-dismiss").trigger("click");
  await flushPromises();
}

beforeEach(async () => {
  localStorage.clear();
  useAuthStore().me = { steam_id: ME, current_lobby_id: null } as any;
  await flushPromises();

  const matchmaking = useMatchmakingStore();
  matchmaking.friends = [] as any;
  matchmaking.lobbies = [] as any;
  matchmaking.friendsLoaded = false;
  matchmaking.lobbiesLoaded = false;

  const notifications = useNotificationStore();
  notifications.draft_invites = [];
  notifications.draftInvitesLoaded = false;
  notifications.team_invites = [];

  useCallInvites().invites.value = [];

  const matchLobby = useMatchLobbyStore();
  matchLobby.myMatches = [] as any;
  (matchLobby as any).myMatchesLoaded = false;
  navigateToMock.mockReset();
  currentRoute.path = "/";
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  localStorage.clear();
});

describe("ActionToasts dismissals", () => {
  it("keeps a dismissed toast hidden after a remount", async () => {
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    const wrapper = await mountToasts();
    expect(wrapper.text()).toContain("Dana");

    await dismissToast(wrapper, "Dana");
    expect(wrapper.text()).not.toContain("Dana");
    expect(stored()).toEqual(["friend:76561198000000002"]);

    unmount?.();
    const remounted = await mountToasts();
    expect(remounted.text()).not.toContain("Dana");
  });

  it("never stores a call invite dismissal", async () => {
    useCallInvites().invites.value = [
      {
        id: "voice:channel-1",
        channelId: "channel-1",
        channelLabel: "Lobby",
        channelKind: "lobby",
        who: "Rory",
        video: false,
      },
    ];
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    const wrapper = await mountToasts();
    await dismissToast(wrapper, "Rory");
    await dismissToast(wrapper, "Dana");

    expect(wrapper.text()).not.toContain("Rory");
    expect(stored()).toEqual(["friend:76561198000000002"]);

    unmount?.();
    const remounted = await mountToasts();
    expect(remounted.text()).toContain("Rory");
  });

  it("does not prune before a source has loaded", async () => {
    const seeded = [
      "friend:76561198000000003",
      "lobby:lobby-1",
      "draft:draft-1",
      "team:invite-1",
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));

    await mountToasts();
    expect(stored()).toEqual(seeded);

    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000005", "Sam")] as any;
    await flushPromises();
    expect(stored()).toEqual(seeded);

    matchmaking.lobbiesLoaded = true;
    await flushPromises();
    expect(stored()).toEqual([
      "friend:76561198000000003",
      "draft:draft-1",
      "team:invite-1",
    ]);
  });

  it("keeps a stored dismissal whose toast arrives with the first load", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["friend:76561198000000003"]),
    );

    const wrapper = await mountToasts();
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000003", "Kai")] as any;
    matchmaking.friendsLoaded = true;
    await flushPromises();

    expect(wrapper.text()).not.toContain("Kai");
    expect(stored()).toEqual(["friend:76561198000000003"]);
  });

  it("forgets a call invite dismissal once that call ends", async () => {
    const invite = {
      id: "voice:channel-1",
      channelId: "channel-1",
      channelLabel: "Lobby",
      channelKind: "lobby" as const,
      who: "Rory",
      video: false,
    };
    useCallInvites().invites.value = [invite];

    const wrapper = await mountToasts();
    await dismissToast(wrapper, "Rory");
    expect(wrapper.text()).not.toContain("Rory");

    useCallInvites().invites.value = [];
    await flushPromises();
    useCallInvites().invites.value = [{ ...invite, who: "Sky" }];
    await flushPromises();

    expect(wrapper.text()).toContain("Sky");
  });

  it("picks up a dismissal made in another tab", async () => {
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    const wrapper = await mountToasts();
    expect(wrapper.text()).toContain("Dana");

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["friend:76561198000000002"]),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    await flushPromises();

    expect(wrapper.text()).not.toContain("Dana");
  });

  it("keeps another tab's dismissal when this tab writes", async () => {
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    const wrapper = await mountToasts();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["team:invite-9"]));
    await dismissToast(wrapper, "Dana");

    expect(stored()).toEqual(["team:invite-9", "friend:76561198000000002"]);
  });

  it("switches to the new player's dismissals when the player changes", async () => {
    const OTHER = "76561198000000009";
    localStorage.setItem(
      `5stack:dismissed-action-toasts:${OTHER}`,
      JSON.stringify(["team:invite-1"]),
    );
    const notifications = useNotificationStore();
    notifications.team_invites = [
      { id: "invite-1", team: { id: "t", name: "Alpha" }, invited_by: null },
    ];

    const wrapper = await mountToasts();
    expect(wrapper.text()).toContain("Alpha");

    useAuthStore().me = { steam_id: OTHER, current_lobby_id: null } as any;
    await flushPromises();
    expect(wrapper.text()).not.toContain("Alpha");
  });

  it("prunes only the loaded sources' dismissals whose toast is gone", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        "friend:76561198000000003",
        "friend:76561198000000004",
        "lobby:lobby-1",
        "team:invite-1",
      ]),
    );
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000004", "Lee")] as any;

    const wrapper = await mountToasts();
    matchmaking.friendsLoaded = true;
    await flushPromises();

    expect(stored()).toEqual([
      "friend:76561198000000004",
      "lobby:lobby-1",
      "team:invite-1",
    ]);
    expect(wrapper.text()).not.toContain("Lee");

    matchmaking.friends = [pendingFriend("76561198000000003", "Kai")] as any;
    await flushPromises();
    expect(wrapper.text()).toContain("Kai");
    expect(stored()).toEqual(["lobby:lobby-1", "team:invite-1"]);
  });

  it("prunes a draft dismissal once draft invites load", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["draft:draft-1"]));

    await mountToasts();
    useNotificationStore().draftInvitesLoaded = true;
    await flushPromises();

    expect(stored()).toEqual([]);
  });

  it("keeps only the newest 200 stored dismissals", async () => {
    const seeded = Array.from(
      { length: 200 },
      (_, index) => `team:invite-${index}`,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    const wrapper = await mountToasts();
    await dismissToast(wrapper, "Dana");

    const ids = stored();
    expect(ids).toHaveLength(200);
    expect(ids[0]).toBe("team:invite-1");
    expect(ids.at(-1)).toBe("friend:76561198000000002");
  });

  it("shows toasts when storage is unavailable", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    try {
      const wrapper = await mountToasts();
      expect(wrapper.text()).toContain("Dana");
      await dismissToast(wrapper, "Dana");
      expect(wrapper.text()).not.toContain("Dana");
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

function myMatch(overrides: Record<string, any> = {}) {
  const { mine = {}, ...rest } = overrides;
  return {
    id: "match-1",
    status: "WaitingForCheckIn",
    is_in_lineup: true,
    can_check_in: true,
    map_veto_type: null,
    draft_games: [],
    lineup_1: {
      id: "lineup-1",
      name: "Iron Wolves",
      is_on_lineup: true,
      is_ready: false,
      can_pick_map_veto: false,
      can_pick_region_veto: false,
      lineup_players: [{ checked_in: false, player: { steam_id: ME } }],
      ...mine,
    },
    lineup_2: {
      id: "lineup-2",
      name: "Night Owls",
      is_on_lineup: false,
      is_ready: false,
      can_pick_map_veto: false,
      can_pick_region_veto: false,
      lineup_players: [
        { checked_in: false, player: { steam_id: "76561198000000003" } },
      ],
    },
    ...rest,
  };
}

function setMyMatches(matches: any[]) {
  const matchLobby = useMatchLobbyStore();
  matchLobby.myMatches = matches as any;
  (matchLobby as any).myMatchesLoaded = true;
}

function matchToast(wrapper: Wrapper) {
  return wrapper
    .findAll(".toast-card")
    .find((card) => card.text().includes("Iron Wolves vs Night Owls"));
}

describe("ActionToasts match actions", () => {
  it("asks a player to check in with a single Open Match action", async () => {
    setMyMatches([myMatch()]);

    const wrapper = await mountToasts();
    const card = matchToast(wrapper);

    expect(card, "check-in toast").toBeDefined();
    expect(card!.text()).toContain("Match Check-in");
    expect(card!.text()).toContain("Match check-in is open. Check in to play.");
    expect(card!.text()).toContain("Open Match");
    expect(
      card!.findAll("button").map((button) => button.text()),
    ).not.toContain("Decline");
    expect(card!.find(".toast-dismiss").exists()).toBe(true);
  });

  it("opens the match from the toast", async () => {
    setMyMatches([myMatch()]);

    const wrapper = await mountToasts();
    const open = matchToast(wrapper)!
      .findAll("button")
      .find((button) => button.text().includes("Open Match"));
    await open!.trigger("click");
    await flushPromises();

    expect(navigateToMock).toHaveBeenCalledWith("/matches/match-1");
  });

  it("tells the captain whose turn it is in each veto", async () => {
    setMyMatches([
      myMatch({ status: "Veto", mine: { can_pick_region_veto: true } }),
    ]);

    const wrapper = await mountToasts();
    expect(matchToast(wrapper)!.text()).toContain("Region Veto");
    expect(matchToast(wrapper)!.text()).toContain(
      "It's your turn to ban a region.",
    );

    setMyMatches([
      myMatch({
        status: "Veto",
        map_veto_type: "Side",
        mine: { can_pick_map_veto: true },
      }),
    ]);
    await flushPromises();

    expect(matchToast(wrapper)!.text()).toContain("Map Veto");
    expect(matchToast(wrapper)!.text()).toContain(
      "It's your turn in the map veto.",
    );
  });

  it("never shows to a spectator or an organizer who is not playing", async () => {
    setMyMatches([
      myMatch({
        is_in_lineup: false,
        can_check_in: false,
        mine: { is_on_lineup: false, can_pick_map_veto: true },
      }),
    ]);

    const wrapper = await mountToasts();

    expect(matchToast(wrapper)).toBeUndefined();
  });

  it("is hidden while the player is on that match's page", async () => {
    setMyMatches([myMatch()]);
    currentRoute.path = "/matches/match-1";

    const wrapper = await mountToasts();

    expect(matchToast(wrapper)).toBeUndefined();
  });

  it("clears when the server says the action is done", async () => {
    setMyMatches([myMatch()]);
    const wrapper = await mountToasts();
    expect(matchToast(wrapper)).toBeDefined();

    setMyMatches([myMatch({ mine: { is_ready: true } })]);
    await flushPromises();

    expect(matchToast(wrapper)).toBeUndefined();
  });

  it("comes back on the player's next veto turn after a dismissal", async () => {
    const myTurn = myMatch({
      status: "Veto",
      mine: { can_pick_region_veto: true },
    });
    setMyMatches([myTurn]);

    const wrapper = await mountToasts();
    await dismissToast(wrapper, "Iron Wolves vs Night Owls");
    expect(matchToast(wrapper)).toBeUndefined();
    expect(stored()).toEqual(["match-region_veto:match-1"]);

    setMyMatches([myMatch({ status: "Veto" })]);
    await flushPromises();
    expect(stored()).toEqual([]);

    setMyMatches([myTurn]);
    await flushPromises();
    expect(matchToast(wrapper)).toBeDefined();
  });

  it("keeps a match dismissal until the player's matches have loaded", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["match-region_veto:match-1"]),
    );

    await mountToasts();
    expect(stored()).toEqual(["match-region_veto:match-1"]);

    setMyMatches([
      myMatch({ status: "Veto", mine: { can_pick_region_veto: true } }),
    ]);
    await flushPromises();
    expect(stored()).toEqual(["match-region_veto:match-1"]);
  });

  it("shows match toasts on phones while invites stay desktop-only", async () => {
    setMyMatches([myMatch()]);
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    const wrapper = await mountToasts();
    const container = wrapper.find(".fixed");
    const entryOf = (text: string) =>
      wrapper
        .findAll(".toast-card")
        .find((card) => card.text().includes(text))!
        .element.closest(".grid-rows-\\[1fr\\]") as HTMLElement;

    expect(container.classes()).not.toContain("hidden");
    expect(entryOf("Iron Wolves vs Night Owls").classList).not.toContain(
      "hidden",
    );
    expect(entryOf("Dana").classList).toContain("hidden");
    expect(entryOf("Dana").classList).toContain("md:grid");
  });
});
