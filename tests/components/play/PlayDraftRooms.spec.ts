import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayDraftRooms from "~/components/play/PlayDraftRooms.vue";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";

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

async function mountRooms(rooms: any[]) {
  const store = useDraftGamesStore();
  vi.spyOn(store, "subscribeToOpenDraftGames").mockResolvedValue(undefined);
  vi.spyOn(store, "unsubscribeFromOpenDraftGames").mockImplementation(() => {});
  const wrapper = await mountSuspended(PlayDraftRooms);
  store.openDraftGames = rooms;
  await flushPromises();
  return { wrapper, store };
}

const hostButtons = (wrapper: any) =>
  wrapper
    .findAll("button")
    .filter((b: any) => b.text().includes("Host draft room"));

describe("PlayDraftRooms", () => {
  it("says there are no rooms in one line, with the header's host button only", async () => {
    const { wrapper } = await mountRooms([]);
    expect(wrapper.text()).toContain("No open draft rooms right now.");
    expect(hostButtons(wrapper)).toHaveLength(1);
    // No filters for an empty list.
    expect(wrapper.text()).not.toContain("Filters");
  });

  it("renders a room's details as one plain meta line", async () => {
    const { wrapper } = await mountRooms([room("r1")]);
    const meta = wrapper.find("article p");
    expect(meta.text()).toBe(
      "Host assigns · Invite only · Avg 1,610 · Northside LAN",
    );
    // The title stands alone: no badges or chips beside it.
    expect(wrapper.find("article h3").findAll("span").length).toBe(0);
    expect(hostButtons(wrapper)).toHaveLength(1);
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
