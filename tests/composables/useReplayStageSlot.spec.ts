// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { useReplayStageSlot } from "~/composables/useReplayStageSlot";

const Holder = defineComponent({
  setup() {
    return { active: useReplayStageSlot() };
  },
  render: () => h("div"),
});

describe("useReplayStageSlot", () => {
  it("gives the page's one stage to the newest holder, and back when it goes", async () => {
    const first = mount(Holder);
    await nextTick();
    expect(first.vm.active).toBe(true);

    const second = mount(Holder);
    await nextTick();
    expect(first.vm.active).toBe(false);
    expect(second.vm.active).toBe(true);

    second.unmount();
    await nextTick();
    expect(first.vm.active).toBe(true);
    first.unmount();
  });
});
