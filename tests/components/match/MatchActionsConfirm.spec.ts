import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchSelectMapWinner from "~/components/match/MatchSelectMapWinner.vue";
import MatchSelectServer from "~/components/match/MatchSelectServer.vue";
import MatchSelectWinner from "~/components/match/MatchSelectWinner.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

let mutate: ReturnType<typeof vi.fn>;
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

const sent = () => mutate.mock.calls.map(([{ mutation }]) => print(mutation));

function match(mapStatus = "Live", overrides: Record<string, any> = {}) {
  return {
    id: "m-1",
    status: "Live",
    is_organizer: true,
    is_in_lineup: false,
    is_server_online: true,
    can_cancel: true,
    can_start: false,
    server_id: "server-1",
    server_plugin_runtime: null,
    min_players_per_lineup: 0,
    options: { type: "Competitive", map_veto: false, best_of: 1 },
    match_maps: [{ id: "map-1", is_current_map: true, status: mapStatus }],
    streams: [],
    lineup_1: { id: "l-1", name: "Northwind", lineup_players: [] },
    lineup_2: { id: "l-2", name: "Ember Six", lineup_players: [] },
    winning_lineup_id: null,
    ...overrides,
  };
}

function signIn(role: e_player_roles_enum) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
}

async function mountActions(
  mapStatus = "Live",
  { dock = false, ...overrides }: Record<string, any> = {},
) {
  wrapper = await mountSuspended(MatchActions, {
    props: { match: match(mapStatus, overrides), dock },
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

  it("assigns a server as soon as one is picked, without a dialog", async () => {
    signIn(e_player_roles_enum.administrator);
    const picker = await mountSuspended(MatchSelectServer, {
      props: { match: match() },
      global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    });

    (picker.vm as any).form.setValues({ server_id: "0:Dallas" });
    await (picker.vm as any).updateMatchServer();

    expect(sent()[0]).toContain("update_matches_by_pk");
    expect(sent()[0]).toContain("Dallas");
    picker.unmount();
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

describe("map winner confirms before saving", () => {
  const series = (overrides: Record<string, any> = {}) =>
    match("Live", {
      options: { type: "Competitive", map_veto: false, best_of: 3 },
      match_maps: [
        { id: "map-1", status: "Finished", winning_lineup_id: "l-1" },
        { id: "map-2", status: "Live", winning_lineup_id: null },
        { id: "map-3", status: "Scheduled", winning_lineup_id: null },
      ],
      ...overrides,
    });

  async function mountMapWinner(props: Record<string, any>) {
    wrapper = await mountSuspended(MatchSelectMapWinner, {
      props,
      global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    });
    return wrapper.vm as any;
  }

  it("opens the confirm on a pick and only saves once confirmed", async () => {
    const data = series();
    const picker = await mountMapWinner({
      match: data,
      matchMap: data.match_maps[2],
    });

    picker.ask("l-2");
    expect(picker.open).toBe(true);
    expect(mutate).not.toHaveBeenCalled();

    await picker.confirm();
    expect(sent()[0]).toContain("setMapWinner");
    expect(sent()[0]).toContain("l-2");
    expect(picker.open).toBe(false);
  });

  it("says when the pick also decides the match", async () => {
    const data = series();
    const picker = await mountMapWinner({
      match: data,
      matchMap: data.match_maps[1],
    });

    picker.ask("l-1");
    expect(picker.matchWinnerNote).toContain("Northwind");

    picker.picked = "l-2";
    expect(picker.matchWinnerNote).toBeNull();
  });

  it("says when the pick takes the match winner away", async () => {
    const data = series({ winning_lineup_id: "l-1" });
    data.match_maps[1].winning_lineup_id = "l-1";
    const picker = await mountMapWinner({
      match: data,
      matchMap: data.match_maps[1],
    });

    picker.ask("l-1");
    expect(picker.matchWinnerNote).toBeNull();

    picker.picked = "l-2";
    expect(picker.matchWinnerNote).toBe(
      "This also clears the match winner.",
    );
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

describe("admin dock main action", () => {
  it("offers Skip Check In before the match starts", async () => {
    signIn(e_player_roles_enum.user);
    const actions = await mountActions("Scheduled", {
      dock: true,
      status: "WaitingForCheckIn",
      can_start: true,
    });

    expect(actions.primaryAction).toBe("start");
    expect(actions.showStartItem).toBe(false);
  });

  it("offers Force Ready in warmup to a moderator", async () => {
    signIn(e_player_roles_enum.moderator);
    const actions = await mountActions("Warmup", { dock: true });

    expect(actions.primaryAction).toBe("force_ready");
  });

  it("shows no main action when the role can never use it", async () => {
    signIn(e_player_roles_enum.user);
    const actions = await mountActions("Warmup", { dock: true });

    expect(actions.primaryAction).toBeNull();
    expect(actions.upcoming.map((action: any) => action.key)).not.toContain(
      "pause",
    );
  });

  it("offers Skip Knife during the knife round", async () => {
    signIn(e_player_roles_enum.moderator);
    const actions = await mountActions("Knife", { dock: true });

    expect(actions.primaryAction).toBe("skip_knife");
    expect(actions.showSkipKnifeItem).toBe(false);
  });

  it("keeps Skip Knife from a non-staff organizer", async () => {
    signIn(e_player_roles_enum.user);
    const actions = await mountActions("Knife", { dock: true });

    expect(actions.primaryAction).toBeNull();
  });

  it("offers Pause while a map is live", async () => {
    signIn(e_player_roles_enum.moderator);
    const actions = await mountActions("Live", { dock: true });

    expect(actions.primaryAction).toBe("pause");
  });

  it("keeps the header menu free of a main action", async () => {
    signIn(e_player_roles_enum.moderator);
    const actions = await mountActions("Warmup");

    expect(actions.primaryAction).toBeNull();
    expect(actions.showForceReadyItem).toBe(true);
  });

  it("lists Skip Knife in the header menu during the knife round", async () => {
    signIn(e_player_roles_enum.moderator);
    const actions = await mountActions("Knife");

    expect(actions.showSkipKnifeItem).toBe(true);
    expect(actions.showForceReadyItem).toBe(false);
  });
});
