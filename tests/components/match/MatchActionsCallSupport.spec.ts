import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchActions from "~/components/match/MatchActions.vue";
import { useAuthStore } from "~/stores/AuthStore";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;
let refetchMatchStatic: ReturnType<typeof vi.fn>;

function match(overrides: Record<string, any> = {}) {
  return {
    id: "m-1",
    status: "Live",
    is_organizer: false,
    is_in_lineup: true,
    requested_organizer: true,
    is_server_online: true,
    can_cancel: false,
    can_start: false,
    server_id: "server-1",
    server_plugin_runtime: null,
    min_players_per_lineup: 5,
    options: { type: "Competitive", map_veto: false, best_of: 1 },
    match_maps: [{ id: "map-1", is_current_map: true, status: "Live" }],
    streams: [],
    lineup_1: { id: "l-1", name: "Northwind", lineup_players: [] },
    lineup_2: { id: "l-2", name: "Ember Six", lineup_players: [] },
    winning_lineup_id: null,
    ...overrides,
  };
}

async function openMenu(overrides: Record<string, any> = {}) {
  wrapper = await mountSuspended(MatchActions, {
    props: { match: match(overrides) },
    attachTo: document.body,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      provide: { refetchMatchStatic },
    },
  });
  await flushPromises();
  document
    .querySelector("button[aria-haspopup=menu]")!
    .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await flushPromises();
}

beforeEach(() => {
  refetchMatchStatic = vi.fn().mockResolvedValue(undefined);
  useAuthStore().me = { steam_id: "76561198000000001", role: "user" } as any;
  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "subscribe",
  ).mockImplementation(() => ({
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

describe("match actions call support", () => {
  it("checks again whether support was answered when the menu opens", async () => {
    await openMenu();

    expect(document.body.textContent).toContain("Call for Support");
    expect(refetchMatchStatic).toHaveBeenCalledTimes(1);
  });

  it("asks nothing when no call is waiting", async () => {
    await openMenu({ requested_organizer: false });

    expect(document.body.textContent).toContain("Call for Support");
    expect(refetchMatchStatic).not.toHaveBeenCalled();
  });
});
