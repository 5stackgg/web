import { describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatAttachMenu from "~/components/chat/ChatAttachMenu.vue";
import ChatGifPickerPanel from "~/components/chat/ChatGifPickerPanel.vue";

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

// The menu is portalled to the body, outside the wrapper.
const inMenu = (selector: string) =>
  document.body.querySelector<HTMLElement>(selector);

async function openMenu(wrapper: Wrapper) {
  await wrapper.get("[data-chat-attach]").trigger("click");
  await flushPromises();
}

describe("ChatAttachMenu", () => {
  it("goes straight to the file dialog when there are no GIFs", async () => {
    const wrapper = await mountSuspended(ChatAttachMenu, {
      props: { gifs: false },
      attachTo: document.body,
    });

    await openMenu(wrapper);

    expect(wrapper.emitted("files")).toHaveLength(1);
    expect(inMenu("[data-chat-gif]")).toBeNull();

    wrapper.unmount();
  });

  it("offers a file or a GIF when there are GIFs", async () => {
    const wrapper = await mountSuspended(ChatAttachMenu, {
      props: { gifs: true },
      attachTo: document.body,
    });

    await openMenu(wrapper);

    expect(wrapper.emitted("files")).toBeUndefined();
    expect(inMenu("[data-chat-attach-files]")).not.toBeNull();
    expect(inMenu("[data-chat-gif]")).not.toBeNull();

    inMenu("[data-chat-attach-files]")!.click();
    await flushPromises();

    expect(wrapper.emitted("files")).toHaveLength(1);

    wrapper.unmount();
  });

  // The panel stays on screen through the popover's close animation, where a
  // second click would send the GIF again.
  it("sends one GIF per opening, however fast it is clicked", async () => {
    const wrapper = await mountSuspended(ChatAttachMenu, {
      props: { gifs: true },
      attachTo: document.body,
    });
    const gif = { id: "abc123", width: 480, height: 270 };

    await openMenu(wrapper);

    expect(wrapper.findComponent(ChatGifPickerPanel).exists()).toBe(false);

    inMenu("[data-chat-gif]")!.click();
    await flushPromises();

    const panel = wrapper.findComponent(ChatGifPickerPanel);
    panel.vm.$emit("select", gif);
    panel.vm.$emit("select", gif);

    expect(wrapper.emitted("gif")).toEqual([[gif]]);

    wrapper.unmount();
  });
});
