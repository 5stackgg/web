import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import FriendListItem from "~/components/matchmaking-lobby/FriendListItem.vue";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const ME = "76561198000000001";
const FRIEND = "76561198000000002";

function draft(id: string, players: Array<string>) {
  return {
    id,
    status: "Open",
    access: "Open",
    host_steam_id: ME,
    is_organizer: true,
    match_id: null,
    capacity: 10,
    require_approval: false,
    players: players.map((steam_id) => ({ steam_id, status: "Joined" })),
  };
}

function friendIn(draftId: string | null) {
  return {
    steam_id: FRIEND,
    name: "Dana",
    avatar_url: null,
    player: {
      is_in_draft: !!draftId,
      is_in_lobby: false,
      draft_game_players: draftId
        ? [{ draft_game: draft(draftId, [FRIEND]) }]
        : [],
    },
  };
}

function mount(player: ReturnType<typeof friendIn>) {
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

const inviteButton = (wrapper: Wrapper, icon: "swords" | "tent") =>
  wrapper
    .findAll("button")
    .find((button) => button.find(`.lucide-${icon}`).exists());

describe("FriendListItem drafts", () => {
  beforeEach(() => {
    useAuthStore().me = { steam_id: ME, current_lobby_id: null } as any;
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [
      { steam_id: FRIEND, status: "Accepted", invited_by_steam_id: ME },
    ] as any;
    matchmaking.lobbies = [];
    matchmaking.onlinePlayerSteamIds = [FRIEND];
    useDraftGamesStore().myDraftGame = undefined;
  });

  it("offers to join a friend's draft", async () => {
    const wrapper = await mount(friendIn("their-draft"));

    expect(joinButton(wrapper)).toBeDefined();
  });

  it("does not offer to join a draft the viewer is already in", async () => {
    useDraftGamesStore().myDraftGame = draft("my-draft", [ME, FRIEND]);
    const wrapper = await mount(friendIn("my-draft"));

    expect(wrapper.text()).toContain("In draft lobby");
    expect(joinButton(wrapper)).toBeUndefined();
  });

  it("invites to the viewer's draft instead of the lobby while drafting", async () => {
    const drafts = useDraftGamesStore();
    drafts.myDraftGame = draft("my-draft", [ME]);
    const add = vi.spyOn(drafts, "add").mockResolvedValue({} as any);
    const wrapper = await mount(friendIn(null));

    expect(inviteButton(wrapper, "tent")).toBeUndefined();

    await inviteButton(wrapper, "swords")!.trigger("click");
    await flushPromises();

    expect(add).toHaveBeenCalledWith("my-draft", FRIEND);
  });

  it("offers no draft invite for a friend already in the viewer's draft", async () => {
    useDraftGamesStore().myDraftGame = draft("my-draft", [ME, FRIEND]);
    const wrapper = await mount(friendIn("my-draft"));

    expect(inviteButton(wrapper, "swords")).toBeUndefined();
  });

  it("keeps the lobby invite for a draft member who cannot add players", async () => {
    useDraftGamesStore().myDraftGame = {
      ...draft("their-draft", [ME]),
      host_steam_id: "76561198000000009",
      is_organizer: false,
    };
    const wrapper = await mount(friendIn(null));

    expect(inviteButton(wrapper, "swords")).toBeUndefined();
    expect(inviteButton(wrapper, "tent")).toBeDefined();
  });

  it("invites to the lobby when not drafting", async () => {
    const wrapper = await mount(friendIn(null));

    expect(inviteButton(wrapper, "tent")).toBeDefined();
    expect(inviteButton(wrapper, "swords")).toBeUndefined();
  });
});
