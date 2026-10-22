import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import FriendListItem from "~/components/matchmaking-lobby/FriendListItem.vue";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

mockNuxtImport("navigateTo", () => navigate);

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const ME = "76561198000000001";
const FRIEND = "76561198000000002";

function practice(extra: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    map_name: "de_mirage",
    access: "Friends",
    status: "Ready",
    invite_code: "abc123",
    seated_players: 3,
    max_players: 5,
    is_full: false,
    ...extra,
  };
}

function friend(
  options: {
    status?: string;
    sessions?: Array<ReturnType<typeof practice>>;
    inCs2?: boolean;
    liveMatch?: boolean;
    inLobby?: boolean;
    inDraft?: boolean;
  } = {},
) {
  return {
    steam_id: FRIEND,
    name: "kairo",
    avatar_url: null,
    status: options.status ?? "Accepted",
    last_presence_state: options.inCs2
      ? { inCs2: true, inGame: true, map: "de_mirage" }
      : null,
    player: {
      is_in_draft: !!options.inDraft,
      is_in_lobby: !!options.inLobby,
      draft_game_players: options.inDraft
        ? [
            {
              draft_game: {
                id: "their-draft",
                status: "Open",
                access: "Open",
                capacity: 10,
                require_approval: false,
                players: [{ steam_id: FRIEND, status: "Joined" }],
              },
            },
          ]
        : [],
      live_lineup: options.liveMatch
        ? [
            {
              lineup: {
                id: "l-1",
                match: {
                  id: "m-1",
                  status: "Live",
                  lineup_1_id: "l-1",
                  lineup_2_id: "l-2",
                  options: { type: "Competitive", best_of: 1 },
                  lineup_1: { id: "l-1", name: "Northwind" },
                  lineup_2: { id: "l-2", name: "Iron Lotus" },
                  streams: [],
                  match_maps: [],
                },
              },
            },
          ]
        : [],
      hosted_practice_sessions: options.sessions ?? [practice()],
    },
  };
}

function mount(player: ReturnType<typeof friend>) {
  return mountSuspended(
    defineComponent({
      setup: () => () =>
        h(TooltipProvider, null, () => h(FriendListItem, { player })),
    }),
  );
}

type Wrapper = Awaited<ReturnType<typeof mount>>;

const joinButton = (wrapper: Wrapper) =>
  wrapper.findAll("button").find((button) => button.text() === "Join");

describe("FriendListItem practice servers", () => {
  beforeEach(() => {
    navigate.mockReset();
    useAuthStore().me = { steam_id: ME, current_lobby_id: null } as any;
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [
      { steam_id: FRIEND, status: "Accepted", invited_by_steam_id: ME },
    ] as any;
    matchmaking.lobbies = [];
    matchmaking.onlinePlayerSteamIds = [FRIEND];
    useDraftGamesStore().myDraftGame = undefined;
  });

  it("offers to join a friend's practice server that has room", async () => {
    const wrapper = await mount(friend());

    expect(wrapper.text()).toContain("In practice · Mirage");
    expect(joinButton(wrapper)).toBeDefined();
  });

  it("opens the map page with the server in the practice panel, as an invite link does", async () => {
    const wrapper = await mount(friend());

    await joinButton(wrapper)!.trigger("click");
    await flushPromises();

    expect(navigate).toHaveBeenCalledWith("/utility/de_mirage?practice=abc123");
  });

  it("says the server is full instead of offering Join", async () => {
    const wrapper = await mount(
      friend({
        sessions: [practice({ seated_players: 5, is_full: true })],
      }),
    );

    expect(wrapper.text()).toContain("In practice · Mirage");
    expect(wrapper.text()).toContain("Full · 5/5");
    expect(joinButton(wrapper)).toBeUndefined();
  });

  it("shows the practice server ahead of Playing Counter-Strike 2", async () => {
    const wrapper = await mount(friend({ inCs2: true }));

    expect(wrapper.text()).toContain("In practice · Mirage");
    expect(wrapper.text()).not.toContain("Playing Counter-Strike 2");
    expect(joinButton(wrapper)).toBeDefined();
  });

  it("still shows Playing Counter-Strike 2 for a friend with no server", async () => {
    const wrapper = await mount(friend({ inCs2: true, sessions: [] }));

    expect(wrapper.text()).toContain("Playing Counter-Strike 2");
    expect(wrapper.text()).not.toContain("In practice");
  });

  it("shows the practice server ahead of being in a lobby", async () => {
    const wrapper = await mount(friend({ inLobby: true }));

    expect(wrapper.text()).toContain("In practice · Mirage");
    expect(wrapper.text()).not.toContain("In a lobby");
  });

  it("lets a draft lobby, which has its own Join, win over the practice server", async () => {
    const wrapper = await mount(friend({ inDraft: true }));

    expect(wrapper.text()).toContain("In draft lobby");
    expect(wrapper.text()).not.toContain("In practice");
  });

  it("lets a live match win over the practice server", async () => {
    const wrapper = await mount(friend({ liveMatch: true }));

    expect(wrapper.find("a[href='/matches/m-1']").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("In practice");
  });

  it("shows nothing for a friend who is not hosting", async () => {
    const wrapper = await mount(friend({ sessions: [] }));

    expect(wrapper.text()).not.toContain("In practice");
    expect(joinButton(wrapper)).toBeUndefined();
  });

  it("shows nothing on a pending request's row", async () => {
    useMatchmakingStore().friends = [
      { steam_id: FRIEND, status: "Pending", invited_by_steam_id: FRIEND },
    ] as any;
    const wrapper = await mount(friend({ status: "Pending" }));

    expect(wrapper.text()).not.toContain("In practice");
    expect(joinButton(wrapper)).toBeUndefined();
  });

  it("shows nothing on a row whose my_friends status is not Accepted", async () => {
    const wrapper = await mount(friend({ status: "Pending" }));

    expect(wrapper.text()).not.toContain("In practice");
  });
});
