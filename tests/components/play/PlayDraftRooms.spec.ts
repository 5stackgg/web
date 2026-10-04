import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayDraftRooms from "~/components/play/PlayDraftRooms.vue";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useAuthStore } from "~/stores/AuthStore";

const room = (id: string, overrides: Record<string, any> = {}) => ({
  id,
  type: "Competitive",
  mode: "Host",
  access: "Invite",
  status: "Open",
  capacity: 10,
  regions: ["Northside LAN"],
  require_approval: false,
  created_at: "2026-10-02T20:00:00Z",
  host_steam_id: "host",
  host: { steam_id: "host", name: "mxl0" },
  players: [
    {
      steam_id: "host",
      status: "Accepted",
      elo_snapshot: 1610,
      player: { steam_id: "host", name: "mxl0" },
    },
    {
      steam_id: "a",
      status: "Accepted",
      elo_snapshot: 1610,
      player: { steam_id: "a", name: "ahn" },
    },
  ],
  ...overrides,
});

async function mountRooms(
  rooms: any[],
  { hosted = true }: { hosted?: boolean } = {},
) {
  const store = useDraftGamesStore();
  vi.spyOn(store, "subscribeToOpenDraftGames").mockResolvedValue(undefined);
  vi.spyOn(store, "unsubscribeFromOpenDraftGames").mockImplementation(() => {});
  vi.spyOn(store, "hasHostedDraftGame").mockResolvedValue(hosted);
  const wrapper = await mountSuspended(PlayDraftRooms);
  store.openDraftGames = rooms;
  await flushPromises();
  return { wrapper, store };
}

function signIn() {
  const auth = useAuthStore();
  auth.hasCheckedSession = true;
  auth.me = { steam_id: "me", name: "me" } as any;
}

const button = (wrapper: any, text: string) =>
  wrapper.findAll("button").find((b: any) => b.text().includes(text));

const INTRO = "Run your own pick-up game.";

beforeEach(() => {
  localStorage.clear();
  const auth = useAuthStore();
  auth.hasCheckedSession = false;
  auth.me = undefined;
});

describe("PlayDraftRooms", () => {
  it("keeps the host bar when no rooms are open, with the empty line under it", async () => {
    signIn();
    const { wrapper } = await mountRooms([]);
    expect(wrapper.text()).toContain("No open draft rooms right now.");
    expect(button(wrapper, "Open 5v5 room")).toBeDefined();
    // No filters for an empty list.
    expect(wrapper.text()).not.toContain("Filters");
  });

  it("hosts from the bar with matchmaking defaults", async () => {
    signIn();
    const { wrapper, store } = await mountRooms([]);
    const create = vi.spyOn(store, "create").mockResolvedValue(undefined);
    await button(wrapper, "2v2")!.trigger("click");
    await button(wrapper, "Friends")!.trigger("click");
    await button(wrapper, "Open 2v2 room")!.trigger("click");
    await flushPromises();
    expect(create).toHaveBeenCalledWith({
      type: "Wingman",
      mode: "Captains",
      access: "Friends",
      regions: expect.any(Array),
      captain_selection: "TopEloTwo",
      draft_order: "Snake",
      require_approval: false,
      keep_lobby_together: false,
    });
  });

  it("only offers auto-split for a duel", async () => {
    signIn();
    const { wrapper } = await mountRooms([]);
    await button(wrapper, "1v1")!.trigger("click");
    expect(button(wrapper, "Captains draft")).toBeUndefined();
    expect(button(wrapper, "Auto-split")).toBeDefined();
  });

  it("shows the intro until the player has hosted a room", async () => {
    signIn();
    const { wrapper } = await mountRooms([], { hosted: false });
    expect(wrapper.text()).toContain(INTRO);

    const hosted = await mountRooms([], { hosted: true });
    expect(hosted.wrapper.text()).not.toContain(INTRO);
  });

  it("remembers a dismissed intro", async () => {
    useAuthStore().hasCheckedSession = true;
    const { wrapper } = await mountRooms([]);
    expect(wrapper.text()).toContain(INTRO);
    await wrapper.find('button[aria-label="Dismiss"]').trigger("click");
    expect(wrapper.text()).not.toContain(INTRO);

    const again = await mountRooms([]);
    expect(again.wrapper.text()).not.toContain(INTRO);
  });

  it("renders a room's details as one plain meta line", async () => {
    const { wrapper } = await mountRooms([room("r1")]);
    const meta = wrapper.find("article p");
    expect(meta.text()).toBe(
      "Host assigns · Invite only · Avg 1,610 · Northside LAN",
    );
    // The title stands alone: no badges or chips beside it.
    expect(wrapper.find("article h3").findAll("span").length).toBe(0);
  });

  it("offers clear filters when filtering hides every room", async () => {
    const { wrapper } = await mountRooms([room("r1")]);
    await wrapper.find("input").setValue("nobody");
    await flushPromises();
    expect(wrapper.text()).toContain("No rooms match these filters.");
    const clear = wrapper
      .findAll("button")
      .find((b) => b.text() === "Clear filters");
    expect(clear).toBeDefined();
    await clear!.trigger("click");
    await flushPromises();
    expect(wrapper.findAll("article")).toHaveLength(1);
  });
});
