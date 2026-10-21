import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityPracticePanel from "~/components/utility/UtilityPracticePanel.vue";
import { useToast } from "~/components/ui/toast";

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

// The session a refresh finds, and what the subscription by id says next.
let held: ReturnType<typeof sessionRow> | null = null;
let push: (row: ReturnType<typeof sessionRow> | null) => void = () => {};
let joined: ReturnType<typeof sessionRow> | null = null;
const asked: string[] = [];

function fieldOf(query: any) {
  return query?.definitions?.[0]?.selectionSet?.selections?.[0]?.name?.value;
}

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: () => ({
      subscribe: ({ next }: any) => {
        push = (row) =>
          next({ data: { utility_practice_sessions_by_pk: row } });
        return { unsubscribe() {} };
      },
    }),
    query: async ({ query, variables }: any) => {
      asked.push(fieldOf(query));
      return {
        data: variables?.statuses
          ? { utility_practice_sessions: held ? [held] : [] }
          : { utilityPracticeServers: { servers: [] }, utility_playbooks: [] },
      };
    },
    mutate: async () => ({
      data: joined ? { joinUtilityPractice: joined } : {},
    }),
  }),
}));

const auth = reactive({ me: { steam_id: "9" }, isRoleAbove: () => false });
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const settings = reactive({ canCreateMatch: true });
vi.mock("~/stores/ApplicationSettings", () => ({
  useApplicationSettingsStore: () => ({
    availableRegions: [],
    canCreateMatch: settings.canCreateMatch,
  }),
}));

vi.mock("~/stores/MatchmakingStore", () => ({
  useMatchmakingStore: () => ({ getRegionlatencyResult: () => null }),
}));

const mounted: Array<{ unmount: () => void }> = [];

beforeEach(() => {
  held = sessionRow();
  joined = null;
  asked.length = 0;
  settings.canCreateMatch = true;
  useToast().dismiss();
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

const settle = async (ms = 20) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flushPromises();
};

async function mountPanel(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(UtilityPracticePanel, {
    attachTo: document.body,
    props: { mapName: "de_mirage", ...props },
    global: {
      stubs: {
        PlayerSearch: true,
        RconCommander: true,
        UtilitySaveLineupDialog: true,
      },
    },
  });
  mounted.push(wrapper);
  await settle();
  return wrapper;
}

const lastToast = () => useToast().toasts.value[0];

describe("UtilityPracticePanel", () => {
  it("picks a held server back up", async () => {
    const wrapper = await mountPanel();
    push(sessionRow());
    await settle();

    expect(wrapper.text()).toContain("Stop Server");
    expect(wrapper.text()).not.toContain("Start Server");
  });

  it("keeps saying starting while the server is coming up", async () => {
    held = sessionRow({ status: "Starting", connection_string: null });
    const wrapper = await mountPanel();
    push(held);
    await settle();

    expect(wrapper.text()).toContain("Starting your practice server");
    expect(wrapper.text()).toContain("Stop Server");
  });

  it("goes back to the form when the server was stopped under it", async () => {
    const wrapper = await mountPanel();
    push(sessionRow({ status: "Ended", connection_string: null }));
    await settle();

    expect(wrapper.text()).toContain("Start Server");
    expect(wrapper.text()).not.toContain("Starting your practice server");
    expect(wrapper.text()).not.toContain("Stop Server");
    expect(lastToast()).toBeUndefined();
  });

  it("says why when the server never came up", async () => {
    held = sessionRow({ status: "Starting", connection_string: null });
    const wrapper = await mountPanel();
    push(
      sessionRow({
        status: "Failed",
        connection_string: null,
        failure_reason: "no practice server was available",
      }),
    );
    await settle();

    expect(wrapper.text()).toContain("Start Server");
    expect(wrapper.text()).not.toContain("Starting your practice server");
    expect(lastToast().title).toBe("Could not start the practice server");
    expect(lastToast().description).toBe("no practice server was available");
  });

  it("goes back to the form when the row can no longer be read", async () => {
    const wrapper = await mountPanel();
    push(null);
    await settle();

    expect(wrapper.text()).toContain("Start Server");
    expect(wrapper.text()).not.toContain("Stop Server");
  });
});

describe("UtilityPracticePanel and the create matches role", () => {
  beforeEach(() => {
    settings.canCreateMatch = false;
    held = null;
  });

  it("offers a player below the role no way to start a server", async () => {
    const wrapper = await mountPanel();

    expect(wrapper.text()).not.toContain("Start Server");
    expect(wrapper.text()).not.toContain("Region");
    expect(asked).not.toContain("utilityPracticeServers");
  });

  it("still lets a player below the role join from an invite link", async () => {
    joined = sessionRow({ can_manage: false });
    const wrapper = await mountPanel({ joinInviteCode: "abc123" });
    push(sessionRow({ can_manage: false }));
    await settle();

    expect(wrapper.text()).toContain("Leave Session");
    expect(wrapper.text()).not.toContain("Start Server");
    expect(useToast().toasts.value.map((toast) => toast.title)).not.toContain(
      "Could not join that practice server",
    );
  });

  it("puts nothing in its place once the server they joined is gone", async () => {
    held = sessionRow({ can_manage: false });
    const wrapper = await mountPanel();
    push(sessionRow({ can_manage: false, status: "Ended" }));
    await settle();

    expect(wrapper.text()).not.toContain("Leave Session");
    expect(wrapper.text()).not.toContain("Start Server");
  });

  it("is unchanged for a player at the role", async () => {
    settings.canCreateMatch = true;
    const wrapper = await mountPanel();

    expect(wrapper.text()).toContain("Start Server");
    expect(asked).toContain("utilityPracticeServers");
  });
});
