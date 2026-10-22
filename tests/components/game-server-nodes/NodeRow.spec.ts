import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import NodeRow from "~/components/game-server-nodes/NodeRow.vue";
import { DEFAULT_DISK_THRESHOLDS } from "~/components/game-server-nodes/nodeState";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { mutate: vi.fn() } }),
}));

afterEach(() => {
  document.body.innerHTML = "";
});

const mountRow = async (fields: Record<string, unknown>) => {
  const table = document.createElement("table");
  const body = document.createElement("tbody");
  table.appendChild(body);
  document.body.appendChild(table);
  const wrapper = await mountSuspended(NodeRow, {
    attachTo: body,
    props: {
      node: {
        id: "node-1",
        label: "Frankfurt 1",
        status: "Online",
        enabled: true,
        gpu: false,
        region: "eu",
        build_id: 25966348,
        start_port_range: 30000,
        end_port_range: 30010,
        ...fields,
      },
      selected: false,
      inSelection: false,
      selecting: false,
      gameVersions: [],
      context: {
        currentBuildId: 25966348,
        maxServers: () => 10,
        diskThresholds: DEFAULT_DISK_THRESHOLDS,
      },
      diskThresholds: DEFAULT_DISK_THRESHOLDS,
      stats: null,
      showLoad: false,
    } as any,
  });
  await flushPromises();
  return wrapper;
};

const openMenu = async (wrapper: Awaited<ReturnType<typeof mountRow>>) => {
  await wrapper
    .get('.gsn-c-more button[aria-haspopup="menu"]')
    .trigger("keydown", { key: "Enter" });
  await flushPromises();
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
};

describe("NodeRow menu", () => {
  it("installs CS:GO from the row on a node without it", async () => {
    const wrapper = await mountRow({ csgo_build_id: null });

    const item = (await openMenu(wrapper)).find(
      (entry) => entry.textContent?.trim() === "Install CS:GO",
    );
    expect(item).toBeDefined();
    item!.click();
    await flushPromises();

    expect(wrapper.emitted("action")).toEqual([["update_csgo", "node-1"]]);
  });

  it("updates CS:GO from the row once it is installed", async () => {
    const wrapper = await mountRow({ csgo_build_id: 12426148 });

    const labels = (await openMenu(wrapper)).map((entry) =>
      entry.textContent?.trim(),
    );
    expect(labels).toContain("Update CS:GO");
    expect(labels).not.toContain("Install CS:GO");
  });

  it("leaves CS:GO off a GPU-only node's menu", async () => {
    const wrapper = await mountRow({
      gpu: true,
      enabled_for_match_making: false,
      region: null,
      start_port_range: null,
      end_port_range: null,
    });

    const labels = (await openMenu(wrapper)).map((entry) =>
      entry.textContent?.trim(),
    );
    expect(labels.some((label) => label?.includes("CS:GO"))).toBe(false);
  });
});
