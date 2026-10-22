import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
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

beforeEach(() => {
  subscriptions.length = 0;
  sent.length = 0;
  failStop = null;
  unsubscribed = 0;
  auth.staff = true;
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

const settle = async (ms = 20) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flushPromises();
};

async function mountPanel() {
  const wrapper = await mountSuspended(UtilityPracticeServersPanel, {
    attachTo: document.body,
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
    expect(first.find("a[href='/players/9']").exists()).toBe(true);

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

    const [first, second] = rows(wrapper);
    expect(buttonNamed(first, "Stop")).toBeTruthy();
    expect(buttonNamed(second, "Stop")).toBeUndefined();
  });
});

describe("UtilityPracticeServersPanel stop", () => {
  it("asks in the row before stopping, and Cancel puts the row back", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(rows(wrapper)[0], "Stop").trigger("click");
    await settle(300);

    const row = rows(wrapper)[0];
    expect(sent).toEqual([]);
    expect(row.text()).toContain("Stop kairo's server?");
    expect(row.text()).toContain("The 3 players on it are dropped.");
    expect(buttonNamed(row, "Stop")).toBeUndefined();

    await buttonNamed(row, "Cancel").trigger("click");
    await settle(300);

    expect(sent).toEqual([]);
    expect(rows(wrapper)[0].text()).not.toContain("Stop kairo's server?");
    expect(buttonNamed(rows(wrapper)[0], "Stop")).toBeTruthy();
  });

  it("puts the row back on a click elsewhere", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(rows(wrapper)[0], "Stop").trigger("click");
    await settle(300);
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(300);

    expect(rows(wrapper)[0].text()).not.toContain("Stop kairo's server?");
  });

  it("says nobody is on it when the server is empty", async () => {
    const wrapper = await mountPanel();
    push([serverRow({ connected_players: 0 })]);
    await settle(300);

    await buttonNamed(rows(wrapper)[0], "Stop").trigger("click");
    await settle(300);

    expect(rows(wrapper)[0].text()).toContain("Nobody is on it.");
  });

  it("stops the session the row is for once confirmed", async () => {
    const wrapper = await mountPanel();
    push([serverRow(), serverRow({ id: "s-2" })]);
    await settle(300);

    await buttonNamed(rows(wrapper)[1], "Stop").trigger("click");
    await settle(300);
    await buttonNamed(rows(wrapper)[1], "Stop Server").trigger("click");
    await settle();

    expect(sent).toEqual([
      { field: "stopUtilityPractice", variables: { session_id: "s-2" } },
    ]);
  });

  it("says why in the row when the stop fails, and lets it be tried again", async () => {
    failStop = new Error("not allowed");
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(rows(wrapper)[0], "Stop").trigger("click");
    await settle(300);
    await buttonNamed(rows(wrapper)[0], "Stop Server").trigger("click");
    await settle(300);

    const row = rows(wrapper)[0];
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
    buttonNamed(rows(wrapper)[0], "Cancel");

  it("moves focus into the confirm and labels it with the prompt", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    const stop = buttonNamed(rows(wrapper)[0], "Stop");
    (stop.element as HTMLElement).focus();
    await stop.trigger("click");
    await settle(300);

    expect(document.activeElement).toBe(cancelButton(wrapper).element);

    const group = rows(wrapper)[0].find("[role='group']");
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

    await buttonNamed(rows(wrapper)[0], "Stop").trigger("click");
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

    expect(rows(wrapper)[0].text()).not.toContain("Stop kairo's server?");
    expect(document.activeElement).toBe(
      buttonNamed(rows(wrapper)[0], "Stop").element,
    );
    expect(seen).toEqual([true]);
    expect(sent).toEqual([]);
  });

  it("still cancels on Escape when focus has fallen to the page", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(rows(wrapper)[0], "Stop").trigger("click");
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

    expect(rows(wrapper)[0].text()).not.toContain("Stop kairo's server?");
    expect(seen).toEqual([true]);
  });

  it("puts focus back on Stop after Cancel", async () => {
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(rows(wrapper)[0], "Stop").trigger("click");
    await settle(300);
    await cancelButton(wrapper).trigger("click");
    await settle(300);

    expect(document.activeElement).toBe(
      buttonNamed(rows(wrapper)[0], "Stop").element,
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
    expect(buttonNamed(rows(wrapper)[0], "Stop")).toBeTruthy();
  });

  it("announces a failed stop", async () => {
    failStop = new Error("not allowed");
    const wrapper = await mountPanel();
    push([serverRow()]);
    await settle(300);

    await buttonNamed(rows(wrapper)[0], "Stop").trigger("click");
    await settle(300);
    await buttonNamed(rows(wrapper)[0], "Stop Server").trigger("click");
    await settle(300);

    const live = rows(wrapper)[0].find("[aria-live='polite']");
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
