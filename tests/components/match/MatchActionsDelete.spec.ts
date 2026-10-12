import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchActions from "~/components/match/MatchActions.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const BLOCKED = "Tournament matches can't be deleted from the match page.";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;
let mutate: ReturnType<typeof vi.fn>;

function match(overrides: Record<string, any> = {}) {
  return {
    id: "m-1",
    status: "Finished",
    is_organizer: true,
    is_in_lineup: false,
    is_server_online: true,
    can_cancel: true,
    can_start: false,
    server_id: "server-1",
    server_plugin_runtime: null,
    min_players_per_lineup: 0,
    options: { type: "Competitive", map_veto: false, best_of: 1 },
    match_maps: [{ id: "map-1", is_current_map: true, status: "Finished" }],
    streams: [],
    lineup_1: { id: "l-1", name: "Northwind", lineup_players: [] },
    lineup_2: { id: "l-2", name: "Ember Six", lineup_players: [] },
    winning_lineup_id: "l-1",
    tournament_brackets: [],
    ...overrides,
  };
}

const bracketMatch = {
  tournament_brackets: [
    {
      stage: {
        tournament: { id: "t-1", name: "Autumn Cup", organizers: [] },
      },
    },
  ],
};

async function mountActions(
  overrides: Record<string, any> = {},
  dock = false,
) {
  wrapper = await mountSuspended(MatchActions, {
    props: { match: match(overrides), dock },
    attachTo: document.body,
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper;
}

async function openMenu(overrides: Record<string, any> = {}) {
  await mountActions(overrides);
  document
    .querySelector("button[aria-haspopup=menu]")!
    .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await flushPromises();
}

const deleteItem = () =>
  Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((item) => item.textContent?.includes("Delete Match"));

const dockButtons = () =>
  wrapper!.findAll("button").map((button) => button.text().trim());

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role: e_player_roles_enum.administrator,
  } as any;
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(client, "mutate").mockImplementation(mutate);
  vi.spyOn(client, "subscribe").mockImplementation(() => ({
    subscribe: () => ({ unsubscribe() {}, closed: false }),
  }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  useAuthStore().me = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("match actions Delete on a tournament bracket match", () => {
  it("is blocked with a reason true of every stage type", async () => {
    await openMenu({ is_tournament_match: true });

    const item = deleteItem();
    expect(item, "Delete Match").toBeDefined();
    expect(item!.getAttribute("aria-disabled")).toBe("true");
    expect(
      item!.querySelector("[role='img'][aria-label]")?.getAttribute(
        "aria-label",
      ),
    ).toBe(BLOCKED);
  });

  it("is blocked from the live half's bracket before the static half loads", async () => {
    await openMenu(bracketMatch);

    expect(deleteItem()!.getAttribute("aria-disabled")).toBe("true");
  });

  it("does nothing when chosen", async () => {
    await openMenu({ is_tournament_match: true });

    deleteItem()!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();

    expect((wrapper!.vm as any).confirmOpen).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("leaves the admin bar without a Delete chip", async () => {
    await mountActions({ is_tournament_match: true }, true);

    expect(dockButtons()).toContain("Cancel Match");
    expect(dockButtons()).not.toContain("Delete Match");
  });
});

describe("match actions Delete on any other match", () => {
  it("stays a plain menu item that asks before deleting", async () => {
    await openMenu({ is_tournament_match: false });

    const item = deleteItem();
    expect(item, "Delete Match").toBeDefined();
    expect(item!.hasAttribute("aria-disabled")).toBe(false);
    expect(item!.querySelector("[role='img'][aria-label]")).toBeNull();

    item!.click();
    await flushPromises();

    expect((wrapper!.vm as any).confirmOpen).toBe(true);
  });

  it("keeps its Delete chip in the admin bar", async () => {
    await mountActions({ is_tournament_match: false }, true);

    expect(dockButtons()).toContain("Delete Match");
  });
});
