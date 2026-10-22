import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayDraftRooms from "~/components/play/PlayDraftRooms.vue";
import PlayDraftHostBar from "~/components/play/PlayDraftHostBar.vue";
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
  wrapper.findAll("button").find((b: any) => b.text().trim() === text);
const choicesToggle = (wrapper: any) =>
  wrapper.find('button[aria-label="Room choices"]');

const quickHost = (type: string, mode: string, access: string) => ({
  type,
  mode,
  access,
  regions: expect.any(Array),
  captain_selection: "TopEloTwo",
  draft_order: "Snake",
  require_approval: false,
  keep_lobby_together: false,
});

const INTRO = "Run your own pick-up game.";

beforeEach(() => {
  localStorage.clear();
  const auth = useAuthStore();
  auth.hasCheckedSession = false;
  auth.me = undefined;
});

describe("PlayDraftRooms", () => {
  it("keeps Host a room when no rooms are open, with the empty line under it", async () => {
    signIn();
    const { wrapper } = await mountRooms([]);
    expect(wrapper.text()).toContain("No open draft rooms right now.");
    expect(button(wrapper, "Host a room")).toBeDefined();
    // No filters for an empty list.
    expect(wrapper.text()).not.toContain("Filters");
  });

  it("hosts straight away with the remembered choices", async () => {
    signIn();
    localStorage.setItem(
      "draft-games:rehost",
      JSON.stringify({
        mode: "Pug",
        access: "Friends",
        payload: { type: "Wingman" },
      }),
    );
    const { wrapper, store } = await mountRooms([]);
    const create = vi.spyOn(store, "create").mockResolvedValue(undefined);
    // The choices stay folded away until asked for.
    expect(wrapper.text()).not.toContain("Who can join");
    await button(wrapper, "Host a room")!.trigger("click");
    await flushPromises();
    expect(create).toHaveBeenCalledWith(quickHost("Wingman", "Pug", "Friends"));
  });

  it("folds the choices open under the header and remembers a change", async () => {
    signIn();
    const { wrapper, store } = await mountRooms([]);
    const create = vi.spyOn(store, "create").mockResolvedValue(undefined);
    const toggle = choicesToggle(wrapper);
    expect(toggle.attributes("aria-expanded")).toBe("false");
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(wrapper.text()).toContain("Who can join");

    await button(wrapper, "2v2")!.trigger("click");
    await button(wrapper, "Friends")!.trigger("click");
    await flushPromises();
    expect(
      JSON.parse(localStorage.getItem("draft-games:rehost") || "null"),
    ).toMatchObject({
      mode: "Captains",
      access: "Friends",
      payload: { type: "Wingman" },
    });

    await button(wrapper, "Host a room")!.trigger("click");
    await flushPromises();
    expect(create).toHaveBeenCalledWith(
      quickHost("Wingman", "Captains", "Friends"),
    );
  });

  it("forces auto-split for a duel", async () => {
    signIn();
    const { wrapper } = await mountRooms([]);
    await choicesToggle(wrapper).trigger("click");
    await button(wrapper, "1v1")!.trigger("click");
    expect(button(wrapper, "Captains draft")!.attributes()).toHaveProperty(
      "disabled",
    );
    expect(button(wrapper, "Auto-split")!.attributes("aria-pressed")).toBe(
      "true",
    );
    expect(wrapper.text()).toContain(
      "1v1 has nobody to draft, so it auto-splits",
    );
  });

  it("asks a guest to sign in, with no choices to open", async () => {
    useAuthStore().hasCheckedSession = true;
    const { wrapper } = await mountRooms([]);
    expect(button(wrapper, "Sign in to host")).toBeDefined();
    expect(button(wrapper, "Host a room")).toBeUndefined();
    expect(choicesToggle(wrapper).exists()).toBe(false);
  });

  it("locks hosting to the party leader", async () => {
    signIn();
    const wrapper = await mountSuspended(PlayDraftHostBar, {
      props: { locked: true },
    });
    expect(wrapper.text()).toContain(
      "Only the party leader can create a match.",
    );
    expect(button(wrapper, "Host a room")).toBeUndefined();
    expect(choicesToggle(wrapper).exists()).toBe(false);
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
