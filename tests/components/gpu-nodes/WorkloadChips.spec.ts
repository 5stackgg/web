import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import WorkloadChips from "~/components/gpu-nodes/WorkloadChips.vue";

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

// The tooltip renders its trigger and its content inline, so the note reads
// without hovering.
vi.mock("~/components/FiveStackToolTip.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      inheritAttrs: false,
      setup:
        (_, { slots }) =>
        () => [slots.trigger?.(), h("span", slots.default?.())],
    }),
  };
});

// Each test gets its own node: toggles in flight are shared per node.
let seq = 0;
const node = (fields: Record<string, unknown> = {}) => ({
  id: `node-${++seq}`,
  enabled: true,
  gpu_streaming_enabled: true,
  gpu_demos_enabled: true,
  gpu_rendering_enabled: false,
  ...fields,
});

const mountChips = (props: Record<string, unknown>) =>
  mountSuspended(WorkloadChips, {
    props: props as any,
    attachTo: document.body,
  });

type Chips = Awaited<ReturnType<typeof mountChips>>;

const chip = (wrapper: Chips, key: string) =>
  wrapper.get(`[data-testid="workload-chip-${key}"]`);

const press = (el: Element, from: number, to: number) => {
  el.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: from,
      clientY: 0,
      pointerType: "mouse",
    }),
  );
  el.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      clientX: to,
      clientY: 0,
      detail: 1,
    }),
  );
};

const sent = () => print(mutate.mock.calls[0][0].mutation);

describe("WorkloadChips", () => {
  beforeEach(() => {
    toastMock.mockReset();
    mutate.mockReset().mockResolvedValue({ data: {} });
  });

  it("flips a workload that isn't running in place", async () => {
    const wrapper = await mountChips({ node: node() });

    expect(chip(wrapper, "demos").attributes("aria-pressed")).toBe("true");
    expect(chip(wrapper, "rendering").attributes("aria-pressed")).toBe("false");

    await chip(wrapper, "rendering").trigger("click");
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(sent()).toContain("update_game_server_nodes_by_pk");
    expect(sent()).toContain("gpu_rendering_enabled: true");
  });

  it("keeps its click from opening the row around it", async () => {
    const wrapper = await mountChips({ node: node() });
    const row = vi.fn();
    document.body.addEventListener("click", row);

    press(chip(wrapper, "demos").element, 10, 10);
    await flushPromises();

    document.body.removeEventListener("click", row);
    expect(row).not.toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("turns off the running workload at once, without asking", async () => {
    const wrapper = await mountChips({
      node: node(),
      activity: { streaming: "Streaming FaZe vs NAVI" },
    });

    expect(chip(wrapper, "streaming").attributes("data-running")).toBe("true");
    await chip(wrapper, "streaming").trigger("click");
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(sent()).toContain("gpu_streaming_enabled: false");
  });

  it("says in the running chip's tooltip that the session keeps going", async () => {
    const wrapper = await mountChips({
      node: node(),
      activity: { demos: "Playing a demo for Mira" },
    });

    const notes = wrapper.findAll('[data-testid="workload-keeps"]');
    expect(notes).toHaveLength(1);
    expect(notes[0].text()).toContain("keeps running");
    expect(wrapper.text()).toContain("Playing a demo for Mira");
  });

  it("turns a workload back on without asking, even with work under it", async () => {
    const wrapper = await mountChips({
      node: node(),
      activity: { rendering: "Rendering highlights for ropz" },
    });
    // Off, the running render has nothing to keep going past.
    expect(wrapper.find('[data-testid="workload-keeps"]').exists()).toBe(false);

    await chip(wrapper, "rendering").trigger("click");
    await flushPromises();

    expect(sent()).toContain("gpu_rendering_enabled: true");
  });

  it("flips nothing when the click ends a drag", async () => {
    const wrapper = await mountChips({ node: node() });

    press(chip(wrapper, "demos").element, 0, 40);
    await flushPromises();
    expect(mutate).not.toHaveBeenCalled();

    press(chip(wrapper, "demos").element, 0, 3);
    await flushPromises();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("takes no presses on a disabled node", async () => {
    const wrapper = await mountChips({ node: node({ enabled: false }) });

    expect(chip(wrapper, "demos").attributes("aria-disabled")).toBe("true");
    await chip(wrapper, "demos").trigger("click");
    await flushPromises();

    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows the toggle in flight and ignores a second press", async () => {
    let finish: (value: unknown) => void = () => {};
    mutate.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const wrapper = await mountChips({ node: node() });

    await chip(wrapper, "demos").trigger("click");

    expect(chip(wrapper, "demos").attributes("aria-busy")).toBe("true");
    expect(chip(wrapper, "demos").attributes("aria-pressed")).toBe("false");

    await chip(wrapper, "demos").trigger("click");
    expect(mutate).toHaveBeenCalledTimes(1);

    finish({ data: {} });
    await flushPromises();
  });

  it("spells out on, off and running when laid out full", async () => {
    const wrapper = await mountChips({
      node: node(),
      activity: { streaming: "Streaming FaZe vs NAVI" },
      full: true,
    });

    expect(chip(wrapper, "streaming").text()).toContain("Running");
    expect(chip(wrapper, "demos").text()).toContain("On");
    expect(chip(wrapper, "rendering").text()).toContain("Off");
    expect(wrapper.find(".wlc-pip").exists()).toBe(false);
  });

  it("says so and shows the saved value when the change fails", async () => {
    mutate.mockRejectedValue(new Error("permission denied"));
    const wrapper = await mountChips({ node: node() });

    await chip(wrapper, "demos").trigger("click");
    await flushPromises();

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "permission denied",
      }),
    );
    expect(chip(wrapper, "demos").attributes("aria-pressed")).toBe("true");
    expect(chip(wrapper, "demos").attributes("aria-busy")).toBeUndefined();
  });
});
