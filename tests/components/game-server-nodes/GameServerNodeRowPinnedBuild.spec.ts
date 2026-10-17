import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import GameServerNodeRow from "~/components/game-server-nodes/GameServerNodeRow.vue";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      mutate: vi.fn(async () => ({ data: {} })),
      query: vi.fn(async () => ({ data: {} })),
    },
  }),
}));

const PINNED = 25966348;

const node = {
  id: "node-1",
  label: "Frankfurt 1",
  status: "Online",
  enabled: true,
  enabled_for_match_making: true,
  gpu: false,
  region: "eu",
  start_port_range: 27015,
  end_port_range: 27025,
  available_server_count: 0,
  total_server_count: 0,
  servers: [],
};

beforeEach(() => {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "mutate").mockResolvedValue({ data: {} });
  vi.spyOn(client, "query").mockResolvedValue({ data: {} });
  vi.spyOn(client, "subscribe").mockReturnValue({
    subscribe: () => ({ unsubscribe() {} }),
  } as any);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function mountRow(overrides: Record<string, unknown>) {
  const wrapper = await mountSuspended(GameServerNodeRow, {
    attachTo: document.body,
    props: { gameServerNode: { ...node, ...overrides } as any },
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper;
}

// A failed pinned update deletes the install, so the node reports no build.
// The pin picker was the only place to unpin, and it only rendered with a
// build, leaving Install CS2 to reinstall the pinned build forever.
describe("GameServerNodeRow pinned build without an install", () => {
  it("still shows the pin, so it can be changed or removed", async () => {
    const wrapper = await mountRow({ build_id: null, pin_build_id: PINNED });
    expect(wrapper.text()).toContain(String(PINNED));
  });

  it("still offers to install CS2", async () => {
    const wrapper = await mountRow({ build_id: null, pin_build_id: PINNED });
    expect(wrapper.text()).toContain("Install CS2");
  });

  it("keeps the pin and Install CS2 in the narrow layout's versions section", async () => {
    const wrapper = await mountRow({ build_id: null, pin_build_id: PINNED });
    const header = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Game Server Versions"));
    expect(header).toBeTruthy();
    await header!.trigger("click");
    await flushPromises();
    const installs = wrapper
      .findAll("button")
      .filter((button) => button.text().trim() === "Install CS2");
    expect(installs).toHaveLength(2);
    expect(wrapper.text().split(String(PINNED)).length - 1).toBe(2);
  });

  it("shows only the install button with no build and no pin", async () => {
    const wrapper = await mountRow({ build_id: null, pin_build_id: null });
    expect(wrapper.text()).not.toContain(String(PINNED));
    expect(wrapper.text()).toContain("Install CS2");
  });
});
