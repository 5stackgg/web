import { describe, expect, it, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import NodeControlMenu from "~/components/game-server-nodes/NodeControlMenu.vue";

const apollo = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@vue/apollo-composable", () => ({
  useApolloClient: () => ({ client: apollo }),
}));

vi.mock("~/components/ui/popover", async () => {
  const { defineComponent, h } = await import("vue");
  const passthrough = defineComponent({
    setup: (_, { slots }) => () => h("div", slots.default?.()),
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
      setup: (props, { emit }) => () =>
        h("button", {
          class: "switch",
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

const schedulingSwitch = async (fields: Record<string, unknown>) => {
  const wrapper = await mountSuspended(NodeControlMenu, {
    props: { node: node(fields) },
  });
  return wrapper.findAll(".switch")[1];
};

describe("NodeControlMenu scheduling switch", () => {
  beforeEach(() => {
    apollo.mutate.mockReset().mockResolvedValue({});
  });

  it("shows what the node was told while it is down", async () => {
    const accepting = await schedulingSwitch({
      status: "Offline",
      accepting_new_matches: true,
    });

    expect(accepting.attributes("data-checked")).toBe("true");
  });

  it("shows a node told to stop taking matches as off", async () => {
    const accepting = await schedulingSwitch({
      status: "NotAcceptingNewMatches",
      accepting_new_matches: false,
    });

    expect(accepting.attributes("data-checked")).toBe("false");
  });

  it("can stop a node that is down from taking matches once it is back", async () => {
    const accepting = await schedulingSwitch({
      status: "Offline",
      accepting_new_matches: true,
    });

    await accepting.trigger("click");

    expect(apollo.mutate).toHaveBeenCalledTimes(1);
    const mutation = print(apollo.mutate.mock.calls[0][0].mutation);
    expect(mutation).toContain("setGameNodeSchedulingState");
    expect(mutation).toContain("enabled: false");
  });
});
