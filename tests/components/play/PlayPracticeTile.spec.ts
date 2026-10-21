import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayPracticeTile from "~/components/play/PlayPracticeTile.vue";
import {
  leaveUtilityPracticeMutation,
  stopUtilityPracticeMutation,
} from "~/graphql/utilityGraphql";

function sessionRow(extra: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    match_id: "m-1",
    match: { server_id: "srv-1" },
    host_steam_id: "9",
    host: { name: "rawr" },
    team_id: null,
    map_name: "de_mirage",
    map_changing_at: null,
    region: "use",
    collection_id: null,
    playbook_id: null,
    status: "Ready",
    invite_code: "abc123",
    is_open: false,
    access: "Friends",
    expires_at: null,
    failure_reason: null,
    connection_string: "connect 1.2.3.4:27015; password x",
    connection_link: "steam://connect/1.2.3.4:27015/x",
    is_member: true,
    can_view: true,
    can_manage: true,
    ...extra,
  };
}

const { mutate } = vi.hoisted(() => ({
  mutate: vi.fn(async () => ({ data: {} })),
}));

let push: (row: ReturnType<typeof sessionRow> | null) => void = () => {};

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: () => ({
      subscribe: ({ next }: any) => {
        push = (row) =>
          next({ data: { utility_practice_sessions: row ? [row] : [] } });
        return { unsubscribe() {} };
      },
    }),
    query: async () => ({
      data: {
        maps: [{ name: "de_inferno" }, { name: "de_mirage" }],
        utilityPracticeWhereAmI: null,
      },
    }),
    mutate,
  }),
}));

vi.mock("~/utilities/mapAssets", async (original) => ({
  ...(await original<typeof import("~/utilities/mapAssets")>()),
  loadRadarMaps: async () => new Set(["de_inferno", "de_mirage"]),
}));

const auth = reactive({ me: { steam_id: "9" }, isRoleAbove: () => false });
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const mounted: Array<{ unmount: () => void }> = [];

beforeEach(() => {
  push(null);
  mutate.mockClear();
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

const settle = async (ms = 20) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flushPromises();
};

async function mountTile() {
  const wrapper = await mountSuspended(PlayPracticeTile, {
    attachTo: document.body,
    global: {
      stubs: { PlayerSearch: true, RconCommander: true },
    },
  });
  mounted.push(wrapper);
  await settle();
  return wrapper;
}

const buttonNamed = (wrapper: any, label: string) =>
  wrapper
    .findAll("button")
    .find((button: any) => button.text().trim() === label);

describe("PlayPracticeTile", () => {
  it("offers Start practice while you hold no server", async () => {
    const wrapper = await mountTile();

    expect(buttonNamed(wrapper, "Start practice")).toBeTruthy();
    expect(wrapper.text()).not.toContain("Manage");
  });

  it("shows the map and Starting while your server boots", async () => {
    const wrapper = await mountTile();
    push(sessionRow({ status: "Starting", connection_string: null }));
    await settle(400);

    expect(wrapper.text()).toContain("Practice server");
    expect(wrapper.text()).toContain("Mirage");
    expect(wrapper.text()).toContain("Starting");
    expect(wrapper.text()).toContain("Starting your practice server...");
    expect(buttonNamed(wrapper, "Stop Server")).toBeTruthy();
    expect(buttonNamed(wrapper, "Start practice")).toBeFalsy();
    expect(wrapper.text()).not.toContain("Join Server");
  });

  it("offers join, copy, Manage and Stop once your server is up", async () => {
    const wrapper = await mountTile();
    push(sessionRow());
    await settle(400);

    expect(wrapper.text()).toContain("Mirage");
    expect(wrapper.text()).toContain("Ready to join");
    expect(wrapper.text()).toContain("Friends can join");
    expect(wrapper.text()).toContain("invite link in the panel");

    const join = wrapper.find('a[href="steam://connect/1.2.3.4:27015/x"]');
    expect(join.exists()).toBe(true);
    expect(join.text()).toContain("Join Server");

    expect(
      wrapper.find('[data-clipboard-text="connect 1.2.3.4:27015; password x"]')
        .exists(),
    ).toBe(true);
    expect(buttonNamed(wrapper, "Manage")).toBeTruthy();
    expect(buttonNamed(wrapper, "Stop")).toBeTruthy();
    expect(buttonNamed(wrapper, "Start practice")).toBeFalsy();
  });

  it("leaves out the invite link hint where a link would not get anyone in", async () => {
    const wrapper = await mountTile();
    push(sessionRow({ access: "Invite" }));
    await settle(400);

    expect(wrapper.text()).toContain("Invited players can join");
    expect(wrapper.text()).not.toContain("invite link in the panel");
  });

  it("Manage opens the full practice panel in a popover", async () => {
    const wrapper = await mountTile();
    push(sessionRow());
    await settle(400);

    expect(document.body.textContent).not.toContain("Session Access");

    await buttonNamed(wrapper, "Manage").trigger("click");
    await settle(400);

    expect(document.body.textContent).toContain("Session Access");
    expect(document.body.textContent).toContain("?practice=abc123");
  });

  it("Stop ends your server", async () => {
    const wrapper = await mountTile();
    push(sessionRow());
    await settle(400);

    await buttonNamed(wrapper, "Stop").trigger("click");
    await settle();

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: stopUtilityPracticeMutation,
        variables: { session_id: "s-1" },
      }),
    );
  });

  it("offers Leave rather than Stop on a server somebody else booked", async () => {
    const wrapper = await mountTile();
    push(sessionRow({ host_steam_id: "7", can_manage: false }));
    await settle(400);

    expect(buttonNamed(wrapper, "Stop")).toBeFalsy();

    await buttonNamed(wrapper, "Leave").trigger("click");
    await settle();

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: leaveUtilityPracticeMutation,
        variables: { session_id: "s-1" },
      }),
    );
  });

  it("says Switching, as the top bar does, while your server changes map", async () => {
    const wrapper = await mountTile();
    push(
      sessionRow({
        map_name: "de_inferno",
        map_changing_at: "2026-10-21T12:00:00Z",
      }),
    );
    await settle(400);

    expect(wrapper.text()).toContain("Inferno");
    expect(wrapper.text()).toContain("Switching");
    expect(wrapper.text()).toContain("Switching your server to Inferno");
    expect(wrapper.text()).not.toContain("Ready to join");
    expect(
      wrapper.find('a[href="steam://connect/1.2.3.4:27015/x"]').exists(),
    ).toBe(false);
    expect(buttonNamed(wrapper, "Stop Server")).toBeTruthy();
  });

  it("offers Join again once the switch has landed", async () => {
    const wrapper = await mountTile();
    push(sessionRow({ map_changing_at: "2026-10-21T12:00:00Z" }));
    await settle(400);
    push(sessionRow());
    await settle(400);

    expect(wrapper.text()).toContain("Ready to join");
    expect(
      wrapper.find('a[href="steam://connect/1.2.3.4:27015/x"]').exists(),
    ).toBe(true);
  });

  it("keeps the map line in place when the server comes up, swapping only what changed", async () => {
    const wrapper = await mountTile();
    push(sessionRow({ status: "Starting", connection_string: null }));
    await settle(400);
    const mapLine = () =>
      wrapper.findAll("span").find((span) => span.text() === "Mirage")?.element;
    const before = mapLine();
    expect(before).toBeDefined();

    push(sessionRow());
    await settle(400);

    expect(mapLine()).toBe(before);
    expect(wrapper.text()).toContain("Ready to join");
    expect(wrapper.text()).not.toContain("Starting your practice server...");
  });

  it("gives the copy button the same reach as the buttons beside it", async () => {
    const wrapper = await mountTile();
    push(sessionRow());
    await settle(400);

    const copy = wrapper
      .find('[data-clipboard-text="connect 1.2.3.4:27015; password x"]')
      .element.closest("button")!;

    expect(Array.from(copy.classList)).toEqual(
      expect.arrayContaining([
        "relative",
        "after:absolute",
        "after:-inset-y-1.5",
        "after:-inset-x-1.5",
        "[@media(pointer:fine)]:after:hidden",
      ]),
    );
  });

  it("goes back to Start practice once the server is gone", async () => {
    const wrapper = await mountTile();
    push(sessionRow());
    await settle(400);
    push(null);
    await settle(400);

    expect(buttonNamed(wrapper, "Start practice")).toBeTruthy();
    expect(wrapper.text()).not.toContain("Ready to join");
  });
});
