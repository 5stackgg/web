// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import SlideSwap from "~/components/ui/transitions/SlideSwap.vue";

// Two views behind one SlideSwap, switched by index like a tab strip would.
const Host = defineComponent({
  setup() {
    const index = ref(0);
    return { index };
  },
  render() {
    return h(SlideSwap, { index: this.index }, () =>
      this.index === 0
        ? h("div", { key: "a", class: "view-a" }, "A")
        : h("div", { key: "b", class: "view-b" }, "B"),
    );
  },
});

function mountHost() {
  return mount(Host, {
    attachTo: document.body,
    global: { stubs: { transition: false } },
  });
}

describe("SlideSwap", () => {
  it("brings the next view in from the right and pushes the old one left", async () => {
    const wrapper = mountHost();
    (wrapper.vm as unknown as { index: number }).index = 1;
    await nextTick();

    const entering = wrapper.find(".view-b").element;
    const leaving = wrapper.find(".view-a").element;
    expect(entering.className).toContain("slide-swap-next-enter-from");
    expect(entering.className).toContain("slide-swap-next-enter-active");
    expect(leaving.className).toContain("slide-swap-next-leave-active");
    wrapper.unmount();
  });

  it("goes the other way when the tab moves back", async () => {
    const wrapper = mountHost();
    const vm = wrapper.vm as unknown as { index: number };
    vm.index = 1;
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 300));
    vm.index = 0;
    await nextTick();

    const entering = wrapper.find(".view-a").element;
    expect(entering.className).toContain("slide-swap-prev-enter-from");
    expect(entering.className).not.toContain("slide-swap-next");
    wrapper.unmount();
  });
});
