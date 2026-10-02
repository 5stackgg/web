import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchTabs from "~/components/match/MatchTabs.vue";
import MatchAdminBottomBar from "~/components/match/MatchAdminBottomBar.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchServerRebootControl from "~/components/match/MatchServerRebootControl.vue";
import RconCommander from "~/components/servers/RconCommander.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const MODERATORS_ONLY = "RCON is for moderators";
const ASK_A_MODERATOR =
  "Ask a moderator if this server needs a console command.";

function match(status = "Live") {
  return {
    id: "m-1",
    status,
    is_organizer: true,
    is_in_lineup: false,
    is_server_online: true,
    server_id: "server-1",
    server_type: "On Demand",
    server_plugin_runtime: null,
    min_players_per_lineup: 5,
    options: { type: "Competitive" },
    match_maps: [],
    streams: [],
    lineup_1: { id: "l-1", lineup_players: [] },
    lineup_2: { id: "l-2", lineup_players: [] },
  };
}

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

function signIn(role: e_player_roles_enum) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
}

const global = () => ({
  mixins: (useNuxtApp().vueApp as any)._context.mixins,
  stubs: { RconCommander: true, ServiceLogs: true },
});

async function mountAdminTab(status = "Live") {
  wrapper = await mountSuspended(MatchTabs, {
    route: "/?tab=server",
    props: { match: match(status) },
    global: global(),
  });
  await flushPromises();
  return wrapper;
}

async function mountBottomBar(status = "Live") {
  wrapper = await mountSuspended(MatchAdminBottomBar, {
    props: { match: match(status) },
    global: global(),
  });
  await flushPromises();
  return wrapper;
}

async function mountMatchActions() {
  wrapper = await mountSuspended(MatchActions, {
    props: {
      match: {
        ...match("Live"),
        match_maps: [{ id: "map-1", is_current_map: true, status: "Live" }],
      },
    },
    global: global(),
  });
  await flushPromises();
  return wrapper;
}

const dockText = () =>
  document.getElementById("main-bottom-dock")?.textContent ?? "";

const rebootVariants = () =>
  wrapper!
    .findAllComponents(MatchServerRebootControl)
    .map((control) => control.props("variant"));

beforeEach(() => {
  const dock = document.createElement("div");
  dock.id = "main-bottom-dock";
  document.body.appendChild(dock);

  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation(() => ({
    subscribe: () => ({ unsubscribe() {}, closed: false }),
  }));
  vi.spyOn(client, "query").mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.getElementById("main-bottom-dock")?.remove();
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("match Admin tab RCON", () => {
  it("gives a non-staff organizer the moderators note and the reboot card instead of the console", async () => {
    signIn(e_player_roles_enum.user);
    const tab = await mountAdminTab();

    expect((tab.vm as any).availableMatchTabs).toContain("server");
    expect(tab.findComponent(RconCommander).exists()).toBe(false);
    expect(tab.text()).toContain(MODERATORS_ONLY);
    expect(tab.text()).toContain(ASK_A_MODERATOR);
    expect(rebootVariants()).toContain("card");
  });

  it("keeps the console for a moderator", async () => {
    signIn(e_player_roles_enum.moderator);
    const tab = await mountAdminTab();

    expect(tab.findComponent(RconCommander).exists()).toBe(true);
    expect(tab.text()).not.toContain(MODERATORS_ONLY);
    expect(rebootVariants()).not.toContain("card");
  });

  it("swaps the note for the console when the organizer becomes a moderator", async () => {
    signIn(e_player_roles_enum.user);
    const tab = await mountAdminTab();

    signIn(e_player_roles_enum.moderator);
    await flushPromises();

    expect(tab.findComponent(RconCommander).exists()).toBe(true);
    expect(tab.text()).not.toContain(MODERATORS_ONLY);
  });
});

describe("match admin bottom bar RCON", () => {
  it("gives a non-staff organizer the moderators note, the reboot card and veto override", async () => {
    signIn(e_player_roles_enum.user);
    const bar = await mountBottomBar("Veto");

    expect(bar.findComponent(RconCommander).exists()).toBe(false);
    expect(dockText()).toContain(MODERATORS_ONLY);
    expect(dockText()).toContain(ASK_A_MODERATOR);
    expect(dockText()).toContain("Veto Override");
    expect(rebootVariants()).toContain("card");
  });

  it("keeps the console for a moderator", async () => {
    signIn(e_player_roles_enum.moderator);
    const bar = await mountBottomBar("Veto");

    expect(bar.findComponent(RconCommander).exists()).toBe(true);
    expect(dockText()).not.toContain(MODERATORS_ONLY);
    expect(dockText()).toContain("Veto Override");
  });

  it("still says RCON is unavailable once the match can't be controlled", async () => {
    signIn(e_player_roles_enum.user);
    await mountBottomBar("Finished");

    expect(dockText()).toContain("RCON unavailable");
    expect(dockText()).not.toContain(MODERATORS_ONLY);
  });
});

describe("match actions pause control", () => {
  it("hides Pause Match from a non-staff organizer", async () => {
    signIn(e_player_roles_enum.user);
    const actions = await mountMatchActions();

    expect(actions.text()).not.toContain("Pause Match");
  });

  it("keeps Pause Match for a moderator", async () => {
    signIn(e_player_roles_enum.moderator);
    const actions = await mountMatchActions();

    expect(actions.text()).toContain("Pause Match");
  });
});
