import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityPracticeSessionPanel from "~/components/utility/UtilityPracticeSessionPanel.vue";

function sessionRow(extra: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    match_id: "m-1",
    server_id: null,
    host_steam_id: "9",
    host: { name: "kairo" },
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
    can_manage: false,
    can_stop: false,
    ...extra,
  };
}

const sent: Array<{ field: string; variables: unknown }> = [];

function fieldOf(document: any) {
  return document?.definitions?.[0]?.selectionSet?.selections?.[0]?.name
    ?.value;
}

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    mutate: async ({ mutation, variables }: any) => {
      sent.push({ field: fieldOf(mutation), variables });
      return { data: {} };
    },
  }),
}));

const auth = reactive({
  me: { steam_id: "7" },
  staff: false,
  isRoleAbove() {
    return auth.staff;
  },
});
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const mounted: Array<{ unmount: () => void }> = [];

beforeEach(() => {
  sent.length = 0;
  auth.staff = false;
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

const settle = async (ms = 20) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flushPromises();
};

async function mountPanel(session: ReturnType<typeof sessionRow>) {
  const wrapper = await mountSuspended(UtilityPracticeSessionPanel, {
    attachTo: document.body,
    props: { session: session as any },
    global: {
      stubs: {
        PlayerSearch: true,
        RconCommander: true,
      },
    },
  });
  mounted.push(wrapper);
  await settle();
  return wrapper;
}

function buttonNamed(wrapper: any, label: string) {
  return wrapper
    .findAll("button")
    .find((button: any) => button.text().trim() === label);
}

async function openConsole(wrapper: any) {
  const trigger = wrapper
    .findAll("button")
    .find((button: any) => button.text().includes("Server console"));
  await trigger.trigger("click");
  await settle();
}

describe("UtilityPracticeSessionPanel server console", () => {
  it("opens onto the server for an administrator the api gave its id", async () => {
    auth.staff = true;
    const wrapper = await mountPanel(sessionRow({ server_id: "srv-1" }));

    await openConsole(wrapper);

    const rcon = wrapper.find("rcon-commander-stub");
    expect(rcon.exists()).toBe(true);
    expect(rcon.attributes("serverid")).toBe("srv-1");
  });

  it("opens for whoever the api gave the id to, whatever their role", async () => {
    const wrapper = await mountPanel(
      sessionRow({ server_id: "srv-1", can_manage: true, can_stop: true }),
    );

    await openConsole(wrapper);

    expect(wrapper.find("rcon-commander-stub").attributes("serverid")).toBe(
      "srv-1",
    );
  });

  it("is not offered to a plain member", async () => {
    const wrapper = await mountPanel(sessionRow());

    expect(wrapper.text()).not.toContain("Server console");
    expect(wrapper.find("rcon-commander-stub").exists()).toBe(false);
  });

  it("is not offered to staff the api gave no server to", async () => {
    auth.staff = true;
    const wrapper = await mountPanel(sessionRow({ can_stop: true }));

    expect(wrapper.text()).not.toContain("Server console");
  });
});

describe("UtilityPracticeSessionPanel way out", () => {
  it("gives the host Stop and nothing else", async () => {
    const wrapper = await mountPanel(
      sessionRow({ can_manage: true, can_stop: true }),
    );

    expect(buttonNamed(wrapper, "Stop Server")).toBeTruthy();
    expect(buttonNamed(wrapper, "Leave Session")).toBeUndefined();
    expect(buttonNamed(wrapper, "Stop")).toBeUndefined();

    await buttonNamed(wrapper, "Stop Server").trigger("click");
    await settle();

    expect(sent).toEqual([
      { field: "stopUtilityPractice", variables: { session_id: "s-1" } },
    ]);
    expect(wrapper.emitted("ended")).toHaveLength(1);
  });

  it("gives a plain guest Leave only", async () => {
    const wrapper = await mountPanel(sessionRow());

    expect(buttonNamed(wrapper, "Leave Session")).toBeTruthy();
    expect(buttonNamed(wrapper, "Stop")).toBeUndefined();
    expect(buttonNamed(wrapper, "Stop Server")).toBeUndefined();
  });

  it("gives a staff guest Leave, and Stop beside it rather than in its place", async () => {
    auth.staff = true;
    const wrapper = await mountPanel(sessionRow({ can_stop: true }));

    expect(buttonNamed(wrapper, "Leave Session")).toBeTruthy();
    expect(buttonNamed(wrapper, "Stop")).toBeTruthy();

    await buttonNamed(wrapper, "Leave Session").trigger("click");
    await settle();

    expect(sent).toEqual([
      { field: "leaveUtilityPractice", variables: { session_id: "s-1" } },
    ]);
  });

  it("asks a staff guest in place before stopping, and Cancel puts it back", async () => {
    auth.staff = true;
    const wrapper = await mountPanel(sessionRow({ can_stop: true }));

    await buttonNamed(wrapper, "Stop").trigger("click");
    await settle(300);

    expect(sent).toEqual([]);
    expect(wrapper.text()).toContain(
      "Stop kairo's server for everyone on it?",
    );
    expect(buttonNamed(wrapper, "Leave Session")).toBeUndefined();

    await buttonNamed(wrapper, "Cancel").trigger("click");
    await settle(300);

    expect(sent).toEqual([]);
    expect(buttonNamed(wrapper, "Leave Session")).toBeTruthy();
    expect(buttonNamed(wrapper, "Stop")).toBeTruthy();
  });

  it("stops the server for a staff guest who confirms", async () => {
    auth.staff = true;
    const wrapper = await mountPanel(sessionRow({ can_stop: true }));

    await buttonNamed(wrapper, "Stop").trigger("click");
    await settle(300);
    await buttonNamed(wrapper, "Stop Server").trigger("click");
    await settle();

    expect(sent).toEqual([
      { field: "stopUtilityPractice", variables: { session_id: "s-1" } },
    ]);
    expect(wrapper.emitted("ended")).toHaveLength(1);
  });
});
