import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import RconCommander from "~/components/servers/RconCommander.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import UtilityPracticeServersPanel from "~/components/utility/UtilityPracticeServersPanel.vue";

function serverRow(extra: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    host_steam_id: "9",
    host: { steam_id: "9", name: "kairo", avatar_url: null },
    map_name: "de_mirage",
    region: "euw",
    status: "Ready",
    map_changing_at: null,
    created_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    connected_players: 3,
    max_players: 10,
    can_stop: true,
    server_id: "srv-1",
    match_id: "m-1",
    connection_string: "connect 203.0.113.24:27015",
    ...extra,
  };
}

const subscriptions: Array<{
  field: string;
  variables: any;
  next: (payload: any) => void;
  error: (error: unknown) => void;
}> = [];
const sent: Array<{ field: string; variables: unknown }> = [];
let failStop: Error | null = null;
let unsubscribed = 0;

function fieldOf(document: any) {
  return document?.definitions?.[0]?.selectionSet?.selections?.[0]?.name
    ?.value;
}

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: ({ query, variables }: any) => ({
      subscribe: ({ next, error }: any) => {
        subscriptions.push({ field: fieldOf(query), variables, next, error });
        return {
          unsubscribe() {
            unsubscribed++;
          },
        };
      },
    }),
    mutate: async ({ mutation, variables }: any) => {
      sent.push({ field: fieldOf(mutation), variables });
      if (failStop) {
        throw failStop;
      }
      return { data: { stopUtilityPractice: { success: true } } };
    },
  }),
}));

const auth = reactive({
  me: { steam_id: "7" } as Record<string, unknown> | null,
  staff: true,
  isAdmin: false,
  isRoleAbove(role: string) {
    return auth.staff && role !== "administrator";
  },
});
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

vi.mock("~/stores/ApplicationSettings", () => ({
  useApplicationSettingsStore: () => ({
    availableRegions: [
      { value: "euw", description: "EU West" },
      { value: "nae", description: "NA East" },
    ],
  }),
}));

const mounted: Array<{ unmount: () => void }> = [];

let wide = true;

beforeEach(() => {
  subscriptions.length = 0;
  sent.length = 0;
  failStop = null;
  unsubscribed = 0;
  auth.staff = true;
  auth.isAdmin = false;
  wide = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: wide,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const settle = async (ms = 20) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flushPromises();
};

async function mountPanel() {
  const wrapper = await mountSuspended(UtilityPracticeServersPanel, {
    attachTo: document.body,
    global: { stubs: { RconCommander: true, ServiceLogs: true } },
  });
  mounted.push(wrapper);
  await settle();
  return wrapper;
}

function push(rows: Array<ReturnType<typeof serverRow>>) {
  subscriptions.at(-1)!.next({ data: { utility_practice_sessions: rows } });
}

function buttonNamed(wrapper: any, label: string) {
  return wrapper
    .findAll("button")
    .find((button: any) => button.text().trim() === label);
}

const rows = (wrapper: any) => wrapper.findAll("[data-practice-server]");
const panel = (wrapper: any) => wrapper.find("[data-practice-server-panel]");
const rcon = (wrapper: any) => wrapper.findComponent(RconCommander);
const logs = (wrapper: any) => wrapper.findComponent(ServiceLogs);

describe("UtilityPracticeServersPanel for staff", () => {
  it("never subscribes for a player below moderator", async () => {
    auth.staff = false;
    const wrapper = await mountPanel();

    expect(subscriptions).toEqual([]);
    expect(wrapper.text()).not.toContain("Running practice servers");
  });

  it("subscribes once a moderator is signed in", async () => {
    auth.staff = false;
    await mountPanel();
    expect(subscriptions).toEqual([]);

    auth.staff = true;
    await settle();

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].field).toBe("utility_practice_sessions");
    expect(subscriptions[0].variables).toEqual({
      statuses: ["Starting", "Ready"],
    });
  });

  it("lets go of the subscription when the viewer stops being staff", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);
    expect(unsubscribed).toBe(0);

    auth.staff = false;
    await settle();

    expect(unsubscribed).toBe(1);
    expect(wrapper.text()).not.toContain("Running practice servers");

    auth.staff = true;
    await settle();

    expect(subscriptions).toHaveLength(2);
    expect(wrapper.findAll("[data-practice-server-skeleton]")).toHaveLength(3);
    expect(rows(wrapper)).toHaveLength(0);
  });

  it("lets go of the subscription when it unmounts", async () => {
    const wrapper = await mountPanel();

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(unsubscribed).toBe(1);
  });

  it("holds grey rows until the first answer", async () => {
    const wrapper = await mountPanel();

    expect(wrapper.text()).toContain("Running practice servers");
    expect(wrapper.findAll("[data-practice-server-skeleton]")).toHaveLength(3);
    expect(rows(wrapper)).toHaveLength(0);
  });

  it("says so in one line when nothing is running", async () => {
    const wrapper = await mountPanel();
    push([]);
    await settle(300);

    expect(wrapper.text()).toContain("No practice servers are running.");
    expect(wrapper.findAll("[data-practice-server-skeleton]")).toHaveLength(0);
  });

  it("names the host, map, region and state, with players out of the api's maximum", async () => {
    const wrapper = await mountPanel();
    push([
      serverRow(),
      serverRow({
        id: "s-2",
        host: { steam_id: "8", name: "vexx", avatar_url: null },
        map_name: "de_inferno",
        region: "nae",
        status: "Starting",
        connected_players: 0,
      }),
      serverRow({
        id: "s-3",
        host: { steam_id: "6", name: "tjorn", avatar_url: null },
        map_name: "de_nuke",
        region: "mystery",
        map_changing_at: new Date().toISOString(),
        connected_players: 1,
      }),
    ]);
    await settle(300);

    const [first, second, third] = rows(wrapper);
    expect(rows(wrapper)).toHaveLength(3);

    expect(first.text()).toContain("kairo");
    expect(first.text()).toContain("Mirage");
    expect(first.text()).toContain("EU West");
    expect(first.text()).toContain("Ready");
    expect(first.text()).toContain("3/10");
    expect(panel(wrapper).find("a[href='/players/9']").exists()).toBe(true);

    expect(second.text()).toContain("NA East");
    expect(second.text()).toContain("Starting");
    expect(second.text()).toContain("0/10");

    expect(third.text()).toContain("mystery");
    expect(third.text()).toContain("Switching");
    expect(third.text()).not.toContain("Ready");
  });

  it("offers Stop only where the api says the viewer can", async () => {
    const wrapper = await mountPanel();
    push([serverRow(), serverRow({ id: "s-2", can_stop: false })]);
    await settle(300);

    expect(buttonNamed(panel(wrapper), "Stop")).toBeTruthy();

    await rows(wrapper)[1].trigger("click");
    await settle(300);

    expect(buttonNamed(panel(wrapper), "Stop")).toBeUndefined();
  });
});

describe("UtilityPracticeServersPanel stop", () => {
  it("asks in the panel before stopping, and Cancel puts it back", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(panel(wrapper), "Stop").trigger("click");
    await settle(300);

    const row = panel(wrapper);
    expect(sent).toEqual([]);
    expect(row.text()).toContain("Stop kairo's server?");
    expect(row.text()).toContain("The 3 players on it are dropped.");
    expect(buttonNamed(row, "Stop")).toBeUndefined();

    await buttonNamed(row, "Cancel").trigger("click");
    await settle(300);

    expect(sent).toEqual([]);
    expect(panel(wrapper).text()).not.toContain("Stop kairo's server?");
    expect(buttonNamed(panel(wrapper), "Stop")).toBeTruthy();
  });

  it("puts the panel back on a click elsewhere", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(panel(wrapper), "Stop").trigger("click");
    await settle(300);
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(300);

    expect(panel(wrapper).text()).not.toContain("Stop kairo's server?");
  });

  it("says nobody is on it when the server is empty", async () => {
    const wrapper = await mountPanel();
    push([serverRow({ connected_players: 0 })]);
    await settle(300);

    await buttonNamed(panel(wrapper), "Stop").trigger("click");
    await settle(300);

    expect(panel(wrapper).text()).toContain("Nobody is on it.");
  });

  it("stops the session the panel is open on once confirmed", async () => {
    const wrapper = await mountPanel();
    push([serverRow(), serverRow({ id: "s-2" })]);
    await settle(300);

    await rows(wrapper)[1].trigger("click");
    await settle(300);
    await buttonNamed(panel(wrapper), "Stop").trigger("click");
    await settle(300);
    await buttonNamed(panel(wrapper), "Stop Server").trigger("click");
    await settle();

    expect(sent).toEqual([
      { field: "stopUtilityPractice", variables: { session_id: "s-2" } },
    ]);
  });

  it("says why in the panel when the stop fails, and lets it be tried again", async () => {
    failStop = new Error("not allowed");
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(panel(wrapper), "Stop").trigger("click");
    await settle(300);
    await buttonNamed(panel(wrapper), "Stop Server").trigger("click");
    await settle(300);

    const row = panel(wrapper);
    expect(row.text()).toContain("Could not stop the practice server");
    expect(row.text()).toContain("not allowed");
    expect(buttonNamed(row, "Stop Server")).toBeTruthy();

    failStop = null;
    await settle(2000);
    await buttonNamed(row, "Stop Server").trigger("click");
    await settle();

    expect(sent).toHaveLength(2);
  });
});

describe("UtilityPracticeServersPanel spacing", () => {
  it("keeps the gap under the last row inside every state, so the swap lands where it rests", async () => {
    const wrapper = await mountPanel();
    const shell = wrapper.find("[data-practice-servers-body]");

    expect(shell.classes()).toContain("-mb-2");
    expect(
      wrapper.find("[data-practice-server-skeleton]").element.parentElement!
        .classList,
    ).toContain("pb-2");

    push([serverRow()]);
    await settle(300);

    const list = wrapper.find("[data-practice-servers-list]");
    expect(list.classes()).not.toContain("-mb-2");
    expect(list.find("li > div").classes()).toContain("pb-2");
  });
});

describe("UtilityPracticeServersPanel stop, from the keyboard", () => {
  const cancelButton = (wrapper: any) =>
    buttonNamed(panel(wrapper), "Cancel");

  it("moves focus into the confirm and labels it with the prompt", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    const stop = buttonNamed(panel(wrapper), "Stop");
    (stop.element as HTMLElement).focus();
    await stop.trigger("click");
    await settle(300);

    expect(document.activeElement).toBe(cancelButton(wrapper).element);

    const group = panel(wrapper).find("[role='group']");
    const label = document.getElementById(
      group.attributes("aria-labelledby")!,
    );
    expect(label?.textContent).toContain("Stop kairo's server?");
    expect(label?.textContent).toContain("The 3 players on it are dropped.");
  });

  it("cancels on Escape, puts focus back on Stop, and keeps the key from the hub", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(panel(wrapper), "Stop").trigger("click");
    await settle(300);

    const seen: boolean[] = [];
    const hub = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    document.addEventListener("keydown", hub);

    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle(300);
    document.removeEventListener("keydown", hub);

    expect(panel(wrapper).text()).not.toContain("Stop kairo's server?");
    expect(document.activeElement).toBe(
      buttonNamed(panel(wrapper), "Stop").element,
    );
    expect(seen).toEqual([true]);
    expect(sent).toEqual([]);
  });

  it("still cancels on Escape when focus has fallen to the page", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(panel(wrapper), "Stop").trigger("click");
    await settle(300);
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    const seen: boolean[] = [];
    const hub = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    document.addEventListener("keydown", hub);

    document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle(300);
    document.removeEventListener("keydown", hub);

    expect(panel(wrapper).text()).not.toContain("Stop kairo's server?");
    expect(seen).toEqual([true]);
  });

  it("puts focus back on Stop after Cancel", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(panel(wrapper), "Stop").trigger("click");
    await settle(300);
    await cancelButton(wrapper).trigger("click");
    await settle(300);

    expect(document.activeElement).toBe(
      buttonNamed(panel(wrapper), "Stop").element,
    );
  });

  it("leaves Escape alone when nothing is being confirmed", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    const seen: boolean[] = [];
    const hub = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    document.addEventListener("keydown", hub);

    document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    document.removeEventListener("keydown", hub);

    expect(seen).toEqual([false]);
    expect(buttonNamed(panel(wrapper), "Stop")).toBeTruthy();
  });

  it("announces a failed stop", async () => {
    failStop = new Error("not allowed");
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(panel(wrapper), "Stop").trigger("click");
    await settle(300);
    await buttonNamed(panel(wrapper), "Stop Server").trigger("click");
    await settle(300);

    const live = panel(wrapper).find("[aria-live='polite']");
    expect(live.text()).toContain("Could not stop the practice server");
  });
});

describe("UtilityPracticeServersPanel when live updates stop", () => {
  it("says the list could not be loaded when the first answer is an error", async () => {
    const wrapper = await mountPanel();

    subscriptions.at(-1)!.error(new Error("socket closed"));
    await settle(300);

    expect(wrapper.text()).not.toContain("No practice servers are running.");
    expect(wrapper.text()).toContain(
      "Could not load the running practice servers.",
    );
    expect(
      wrapper.find("[aria-label^='Live updates stopped']").exists(),
    ).toBe(true);
    expect(wrapper.findAll("[data-practice-server-skeleton]")).toHaveLength(0);
  });

  it("keeps the last rows, dimmed, behind an amber warning", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    expect(
      wrapper.find("[aria-label^='Live updates stopped']").exists(),
    ).toBe(false);

    subscriptions.at(-1)!.error(new Error("socket closed"));
    await settle();

    expect(rows(wrapper)).toHaveLength(1);
    expect(
      wrapper.find("[aria-label^='Live updates stopped']").exists(),
    ).toBe(true);
    expect(wrapper.find("[data-practice-servers-list]").classes()).toContain(
      "opacity-60",
    );
  });
});

describe("UtilityPracticeServersPanel console panel", () => {
  it("opens the first server beside the list on a wide screen", async () => {
    const wrapper = await mountPanel();
    push([serverRow(), serverRow({ id: "s-2" })]);
    await settle(300);

    expect(rows(wrapper)[0].attributes("aria-current")).toBe("true");
    expect(rows(wrapper)[1].attributes("aria-current")).toBeUndefined();
    expect(panel(wrapper).text()).toContain("kairo");
    expect(panel(wrapper).find("[data-practice-server-back]").exists()).toBe(
      false,
    );
  });

  it("opens the row that is picked", async () => {
    const wrapper = await mountPanel();
    push([
      serverRow(),
      serverRow({
        id: "s-2",
        host: { steam_id: "8", name: "vexx", avatar_url: null },
        server_id: "srv-2",
      }),
    ]);
    await settle(300);

    await rows(wrapper)[1].trigger("click");
    await settle(300);

    expect(rows(wrapper)[1].attributes("aria-current")).toBe("true");
    expect(panel(wrapper).text()).toContain("vexx");
    expect(rcon(wrapper).props("serverId")).toBe("srv-2");
  });

  it("on a phone, opens nothing until a row is picked, then swaps the list for the panel and back", async () => {
    wide = false;
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    expect(panel(wrapper).exists()).toBe(false);

    await rows(wrapper)[0].trigger("click");
    await settle(300);

    expect(panel(wrapper).exists()).toBe(true);
    expect(rows(wrapper)[0].isVisible()).toBe(false);

    await panel(wrapper).find("[data-practice-server-back]").trigger("click");
    await settle(300);

    expect(panel(wrapper).exists()).toBe(false);
    expect(rows(wrapper)[0].isVisible()).toBe(true);
  });

  it("hands the console the server and match the api gave, and offers the connect string", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    expect(rcon(wrapper).props()).toMatchObject({
      serverId: "srv-1",
      matchId: "m-1",
      online: true,
    });
    expect(panel(wrapper).text()).toContain("connect 203.0.113.24:27015");
  });

  it("keeps Logs to administrators, and streams them only once the tab is opened", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    expect(panel(wrapper).findAll("[role='tab']")).toHaveLength(0);

    auth.isAdmin = true;
    await settle(300);

    const tabs = panel(wrapper).findAll("[role='tab']");
    expect(tabs.map((tab: any) => tab.text())).toEqual(["Console", "Logs"]);
    expect(logs(wrapper).exists()).toBe(false);

    await tabs[1].trigger("mousedown", { button: 0 });
    await settle(300);

    expect(logs(wrapper).props("service")).toBe("u-m-1");
  });

  it("says why when a moderator cannot reach another player's console", async () => {
    const wrapper = await mountPanel();
    push([serverRow({ server_id: null })]);
    await settle(300);

    expect(rcon(wrapper).exists()).toBe(false);
    expect(panel(wrapper).text()).toContain(
      "Only administrators can open the console of another player's server.",
    );
  });

  it("says nothing of the console on the moderator's own server while it has none", async () => {
    const wrapper = await mountPanel();
    push([
      serverRow({
        server_id: null,
        host_steam_id: "7",
        host: { steam_id: "7", name: "me", avatar_url: null },
      }),
    ]);
    await settle(300);

    expect(panel(wrapper).text()).not.toContain("Only administrators");
  });
});
