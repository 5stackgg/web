import { describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useRouter } from "#app";
import UtilityCardView from "~/components/utility/UtilityCardView.vue";

const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await flushPromises();
};

const position = () => Number(window.history.state?.position);

describe("UtilityCardView and the Back button", () => {
  it("takes a history entry of its own, and Back asks to close it", async () => {
    const wrapper = await mountSuspended(UtilityCardView, {
      props: { open: false },
    });
    const before = position();

    await wrapper.setProps({ open: true });
    await settle();
    expect(position()).toBe(before + 1);

    useRouter().back();
    await settle();
    expect(wrapper.emitted("back")).toHaveLength(1);
    expect(position()).toBe(before);
    wrapper.unmount();
  });

  // A meta spot, a collection, an execute: the push that put it in the
  // address is the entry Back undoes. A second one would make their own Back
  // step onto the first and open them again.
  it("takes none when its being open is already in the address", async () => {
    const wrapper = await mountSuspended(UtilityCardView, {
      props: { open: false, addressed: true },
    });
    const before = position();

    await wrapper.setProps({ open: true });
    await settle();
    expect(position()).toBe(before);

    await wrapper.setProps({ open: false });
    await settle();
    expect(position()).toBe(before);
    expect(wrapper.emitted("back")).toBeUndefined();
    wrapper.unmount();
  });
});
