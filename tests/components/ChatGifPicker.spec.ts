import { describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatGifPicker from "~/components/chat/ChatGifPicker.vue";
import ChatGifPickerPanel from "~/components/chat/ChatGifPickerPanel.vue";

describe("ChatGifPicker", () => {
  // The panel stays on screen through the popover's close animation, where a
  // second click would send the GIF again.
  it("sends one GIF per opening, however fast it is clicked", async () => {
    const wrapper = await mountSuspended(ChatGifPicker, {
      attachTo: document.body,
    });
    const gif = { id: "abc123", width: 480, height: 270 };

    await wrapper.get("[data-chat-gif]").trigger("click");
    await flushPromises();

    const panel = wrapper.findComponent(ChatGifPickerPanel);
    panel.vm.$emit("select", gif);
    panel.vm.$emit("select", gif);

    expect(wrapper.emitted("select")).toEqual([[gif]]);

    wrapper.unmount();
  });
});
