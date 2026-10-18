import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import NodeControlMenu from "~/components/game-server-nodes/NodeControlMenu.vue";

const { mutate, toastMock } = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { mutate } }),
}));

vi.mock("~/components/ui/toast/use-toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/components/ui/toast/use-toast")>()),
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("~/components/ui/popover", async () => {
  const { defineComponent, h } = await import("vue");
  const passthrough = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h("div", slots.default?.()),
  });
  return {
    Popover: passthrough,
    PopoverTrigger: passthrough,
    PopoverContent: passthrough,
  };
});

vi.mock("~/components/ui/switch", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    Switch: defineComponent({
      props: { modelValue: Boolean, disabled: Boolean },
      emits: ["update:modelValue"],
      setup:
        (props, { emit }) =>
        () =>
          h("button", {
            class: "switch",
            disabled: props.disabled,
            "data-checked": String(props.modelValue),
            onClick: () => emit("update:modelValue", !props.modelValue),
          }),
    }),
  };
});

const node = (fields: Record<string, unknown>) => ({
  id: "node-1",
  enabled: true,
  enabled_for_match_making: true,
  gpu: false,
  start_port_range: 27015,
  end_port_range: 27025,
  ...fields,
});

const schedulingRow = async (fields: Record<string, unknown>) => {
  const wrapper = await mountSuspended(NodeControlMenu, {
    props: { node: node(fields) as any },
  });
  return wrapper.get('[data-testid="scheduling-row"]');
};

const scheduleMutation = () => print(mutate.mock.calls[0][0].mutation);

const hasHint = (row: Awaited<ReturnType<typeof schedulingRow>>) =>
  row.find('[data-testid="scheduling-hint"]').exists();

describe("NodeControlMenu scheduling switch", () => {
  beforeEach(() => {
    toastMock.mockReset();
    mutate.mockReset().mockResolvedValue({
      data: { setGameNodeSchedulingState: { success: true } },
    });
  });

  it("shows what the node was told while it is down", async () => {
    const row = await schedulingRow({
      status: "Offline",
      accepting_new_matches: true,
    });

    expect(row.get(".switch").attributes("data-checked")).toBe("true");
  });

  it("reads the saved setting, not the status, for a node that is up", async () => {
    const row = await schedulingRow({
      status: "Online",
      accepting_new_matches: false,
    });

    expect(row.get(".switch").attributes("data-checked")).toBe("false");
  });

  it("falls back to the status when the setting was not selected", async () => {
    const online = await schedulingRow({ status: "Online" });
    const draining = await schedulingRow({ status: "NotAcceptingNewMatches" });

    expect(online.get(".switch").attributes("data-checked")).toBe("true");
    expect(draining.get(".switch").attributes("data-checked")).toBe("false");
  });

  it("can stop a node that is down from taking matches once it is back", async () => {
    const row = await schedulingRow({
      status: "Offline",
      accepting_new_matches: true,
    });

    await row.get(".switch").trigger("click");

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(scheduleMutation()).toContain("setGameNodeSchedulingState");
    expect(scheduleMutation()).toContain("enabled: false");
  });

  it("tells the admin when the api refuses the change", async () => {
    mutate.mockResolvedValue({
      data: { setGameNodeSchedulingState: { success: false } },
    });
    const row = await schedulingRow({
      status: "Offline",
      accepting_new_matches: true,
    });

    await row.get(".switch").trigger("click");
    await flushPromises();

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("stays quiet when the change goes through", async () => {
    const row = await schedulingRow({
      status: "Online",
      accepting_new_matches: true,
    });

    await row.get(".switch").trigger("click");
    await flushPromises();

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("locks the switch while the node is still in setup", async () => {
    const row = await schedulingRow({
      status: "Setup",
      accepting_new_matches: true,
    });

    expect(row.get(".switch").attributes("disabled")).toBeDefined();
    expect(hasHint(row)).toBe(true);
  });

  it("warns that the setting is not in effect while the node is down", async () => {
    const offline = await schedulingRow({
      status: "Offline",
      accepting_new_matches: true,
    });
    const offlineAndOff = await schedulingRow({
      status: "Offline",
      accepting_new_matches: false,
    });
    const online = await schedulingRow({
      status: "Online",
      accepting_new_matches: true,
    });

    expect(hasHint(offline)).toBe(true);
    expect(hasHint(offlineAndOff)).toBe(false);
    expect(hasHint(online)).toBe(false);
  });
});

describe("NodeControlMenu GPU workloads", () => {
  const gpuNode = (fields: Record<string, unknown> = {}) =>
    node({
      status: "Online",
      gpu: true,
      gpu_streaming_enabled: true,
      gpu_demos_enabled: true,
      gpu_rendering_enabled: true,
      ...fields,
    });

  beforeEach(() => {
    toastMock.mockReset();
    mutate.mockReset().mockResolvedValue({ data: {} });
  });

  it("leaves Enabled and scheduling to a panel that has its own", async () => {
    const wrapper = await mountSuspended(NodeControlMenu, {
      props: { node: gpuNode() as any, workloadsOnly: true },
    });

    expect(wrapper.find('[data-testid="scheduling-row"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="gpu-only-row"]').exists()).toBe(true);
    expect(wrapper.findAll(".switch")).toHaveLength(4);
  });

  it("marks the trigger only while a workload is off", async () => {
    const allOn = await mountSuspended(NodeControlMenu, {
      props: { node: gpuNode() as any, workloadsOnly: true },
    });
    const oneOff = await mountSuspended(NodeControlMenu, {
      props: {
        node: gpuNode({ gpu_rendering_enabled: false }) as any,
        workloadsOnly: true,
      },
    });
    const disabled = await mountSuspended(NodeControlMenu, {
      props: {
        node: gpuNode({ enabled: false, gpu_rendering_enabled: false }) as any,
        workloadsOnly: true,
      },
    });

    const dot = '[data-testid="workloads-off-dot"]';
    expect(allOn.find(dot).exists()).toBe(false);
    expect(oneOff.find(dot).exists()).toBe(true);
    expect(disabled.find(dot).exists()).toBe(false);
    expect(
      disabled.find('[data-testid="workloads-node-disabled"]').exists(),
    ).toBe(true);
  });

  it("puts what is running under its workload", async () => {
    const wrapper = await mountSuspended(NodeControlMenu, {
      props: {
        node: gpuNode() as any,
        workloadsOnly: true,
        activity: { demos: "Playing a demo for Mira" },
      },
    });

    const live = wrapper.findAll('[data-testid="workload-live"]');
    expect(live).toHaveLength(1);
    expect(wrapper.get('[data-testid="workload-demos"]').text()).toContain(
      "Playing a demo for Mira",
    );
  });

  it("switches one workload off", async () => {
    const wrapper = await mountSuspended(NodeControlMenu, {
      props: { node: gpuNode() as any, workloadsOnly: true },
    });

    await wrapper
      .get('[data-testid="workload-streaming"] .switch')
      .trigger("click");

    const sent = print(mutate.mock.calls[0][0].mutation);
    expect(sent).toContain("update_game_server_nodes_by_pk");
    expect(sent).toContain("gpu_streaming_enabled: false");
  });
});

describe("NodeControlMenu GPU only", () => {
  const gpuNode = (fields: Record<string, unknown> = {}) =>
    node({ status: "Online", gpu: true, ...fields });

  // Turning GPU only on asks first when the node has a region or ports.
  const confirmGpuOnly = async (row: { element: Element }) => {
    const button = row.element.parentElement!.querySelector(
      '[data-testid="gpu-only-confirm"] button:last-child',
    ) as HTMLButtonElement | null;
    button?.click();
    await flushPromises();
  };

  const gpuOnlyRow = async (
    fields: Record<string, unknown>,
    workloadsOnly = false,
  ) => {
    const wrapper = await mountSuspended(NodeControlMenu, {
      props: { node: gpuNode(fields) as any, workloadsOnly },
    });
    return wrapper.find('[data-testid="gpu-only-row"]');
  };

  beforeEach(() => {
    toastMock.mockReset();
    mutate.mockReset().mockResolvedValue({ data: {} });
  });

  it("is offered only on a node with a GPU, in both lists", async () => {
    const plain = await mountSuspended(NodeControlMenu, {
      props: { node: node({ status: "Online" }) as any },
    });

    expect(plain.find('[data-testid="gpu-only-row"]').exists()).toBe(false);
    expect((await gpuOnlyRow({})).exists()).toBe(true);
    expect((await gpuOnlyRow({}, true)).exists()).toBe(true);
  });

  it("reads on when the node takes no matches", async () => {
    const matchNode = await gpuOnlyRow({ enabled_for_match_making: true });
    const gpuOnly = await gpuOnlyRow({ enabled_for_match_making: false });

    expect(matchNode.get(".switch").attributes("data-checked")).toBe("false");
    expect(gpuOnly.get(".switch").attributes("data-checked")).toBe("true");
  });

  it("asks before turning it on, and sends nothing until confirmed", async () => {
    const row = await gpuOnlyRow({
      enabled_for_match_making: true,
      region: "us-east",
      start_port_range: 30020,
      end_port_range: 30038,
    });

    await row.get(".switch").trigger("click");
    await flushPromises();

    expect(mutate).not.toHaveBeenCalled();
    expect(
      row.element.parentElement!.querySelector(
        '[data-testid="gpu-only-confirm"]',
      ),
    ).not.toBeNull();
  });

  it("turning it on drops matchmaking, the region and the ports", async () => {
    const row = await gpuOnlyRow({ enabled_for_match_making: true });

    await row.get(".switch").trigger("click");
    await flushPromises();
    await confirmGpuOnly(row);

    const sent = print(mutate.mock.calls[0][0].mutation);
    expect(sent).toContain("update_game_server_nodes_by_pk");
    expect(sent).toContain("enabled_for_match_making: false");
    expect(sent).toContain("region: null");
    expect(sent).toContain("start_port_range: null");
    expect(sent).toContain("end_port_range: null");
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0][0].variant).toBeUndefined();
  });

  it("turning it off makes it a match server again", async () => {
    const row = await gpuOnlyRow({ enabled_for_match_making: false });

    await row.get(".switch").trigger("click");

    const sent = print(mutate.mock.calls[0][0].mutation);
    expect(sent).toContain("enabled_for_match_making: true");
    expect(sent).not.toContain("region");
  });

  it("says so when the change fails", async () => {
    mutate.mockRejectedValue(new Error("permission denied"));
    const row = await gpuOnlyRow({ enabled_for_match_making: true });

    await row.get(".switch").trigger("click");
    await flushPromises();
    await confirmGpuOnly(row);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "permission denied",
      }),
    );
  });
});
