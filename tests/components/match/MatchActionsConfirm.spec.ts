import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchSelectWinner from "~/components/match/MatchSelectWinner.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

let mutate: ReturnType<typeof vi.fn>;
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

const sent = () => mutate.mock.calls.map(([{ mutation }]) => print(mutation));

function match(mapStatus = "Live") {
  return {
    id: "m-1",
    status: "Live",
    is_organizer: true,
    is_in_lineup: false,
    is_server_online: true,
    can_cancel: true,
    server_id: "server-1",
    server_plugin_runtime: null,
    options: { type: "Competitive" },
    match_maps: [{ id: "map-1", is_current_map: true, status: mapStatus }],
    streams: [],
    lineup_1: { id: "l-1", name: "Northwind", lineup_players: [] },
    lineup_2: { id: "l-2", name: "Ember Six", lineup_players: [] },
    winning_lineup_id: null,
  };
}

function signIn(role: e_player_roles_enum) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
}

async function mountActions(mapStatus = "Live") {
  wrapper = await mountSuspended(MatchActions, {
    props: { match: match(mapStatus) },
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper.vm as any;
}

beforeEach(() => {
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
  vi.restoreAllMocks();
});

describe("match actions confirm before acting", () => {
  it("asks before cancelling, and only cancels once confirmed", async () => {
    signIn(e_player_roles_enum.administrator);
    const actions = await mountActions();

    actions.confirmCancel();
    expect(actions.confirmOpen).toBe(true);
    expect(mutate).not.toHaveBeenCalled();

    await actions.runConfirm();
    expect(sent()[0]).toContain("cancelMatch");
    expect(actions.confirmOpen).toBe(false);
  });

  it("names the picked server and assigns it only once confirmed", async () => {
    signIn(e_player_roles_enum.administrator);
    const actions = await mountActions();

    actions.confirmServer({ value: "0:Dallas", label: "Dallas" });
    expect(actions.confirming.description).toContain("Dallas");
    expect(mutate).not.toHaveBeenCalled();

    await actions.runConfirm();
    expect(sent()[0]).toContain("update_matches_by_pk");
    expect(sent()[0]).toContain("Dallas");
  });

  it("leaves the winner picker to report the pick without saving it", async () => {
    signIn(e_player_roles_enum.administrator);
    const picker = await mountSuspended(MatchSelectWinner, {
      props: { match: match() },
      global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    });

    (picker.vm as any).pick("l-2");

    expect(picker.emitted("select")?.[0]).toEqual([
      { value: "l-2", label: "Ember Six" },
    ]);
    expect(mutate).not.toHaveBeenCalled();
    picker.unmount();
  });
});

describe("match actions force ready", () => {
  it("offers Force Ready to a moderator while the map warms up", async () => {
    signIn(e_player_roles_enum.moderator);
    const actions = await mountActions("Warmup");

    expect(actions.canForceReady).toBe(true);
  });

  it("hides Force Ready once the map is live", async () => {
    signIn(e_player_roles_enum.moderator);
    const actions = await mountActions("Live");

    expect(actions.canForceReady).toBe(false);
  });

  it("hides Force Ready from a non-staff organizer", async () => {
    signIn(e_player_roles_enum.user);
    const actions = await mountActions("Warmup");

    expect(actions.canForceReady).toBe(false);
  });
});
