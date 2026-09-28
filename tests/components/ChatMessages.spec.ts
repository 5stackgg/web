import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import ChatMessages from "~/components/chat/ChatMessages.vue";

const ME = "76561198000000001";
const ROOM = { type: "match", id: "match-1" };

const own = (id: string, secondsAgo: number) => ({
  id,
  message: `line ${id}`,
  source: "web",
  timestamp: new Date(Date.now() - secondsAgo * 1000).toISOString(),
  from: { steam_id: ME, name: "Me" },
});

let unmount: (() => void) | undefined;

beforeEach(() => {
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
});

describe("ChatMessages editing", () => {
  async function mountList(messages = [own("a", 30), own("b", 20)]) {
    const wrapper = await mountSuspended(ChatMessages, {
      props: { messages, messageRoom: () => ROOM },
    });
    unmount = () => wrapper.unmount();
    return wrapper;
  }

  const rows = (wrapper: Awaited<ReturnType<typeof mountList>>) =>
    wrapper.findAllComponents(ChatMessage);

  it("keeps a single editor open across the list", async () => {
    const wrapper = await mountList();

    rows(wrapper)[0].vm.$emit("edit");
    await flushPromises();

    expect(wrapper.findAll("textarea")).toHaveLength(1);
    expect(rows(wrapper)[0].props("editing")).toBe(true);

    rows(wrapper)[1].vm.$emit("edit");
    await flushPromises();

    expect(wrapper.findAll("textarea")).toHaveLength(1);
    expect(rows(wrapper)[0].props("editing")).toBe(false);
    expect(rows(wrapper)[1].props("editing")).toBe(true);
  });

  it("ignores a close from a row that is no longer the one editing", async () => {
    const wrapper = await mountList();

    rows(wrapper)[1].vm.$emit("edit");
    rows(wrapper)[0].vm.$emit("edit-end");
    await flushPromises();

    expect(rows(wrapper)[1].props("editing")).toBe(true);

    rows(wrapper)[1].vm.$emit("edit-end");
    await flushPromises();

    expect(wrapper.findAll("textarea")).toHaveLength(0);
  });

  it("hands focus to the editor picked from the menu, and keeps it", async () => {
    const wrapper = await mountSuspended(ChatMessages, {
      props: { messages: [own("a", 30)], messageRoom: () => ROOM },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();

    const trigger = wrapper.get('button[aria-label="Message actions"]');
    (trigger.element as HTMLElement).focus();
    await trigger.trigger("keydown", { key: "Enter" });
    await flushPromises();

    const edit = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === "Edit Message");
    edit!.click();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();

    expect(document.activeElement).toBe(wrapper.get("textarea").element);
  });

  it("gives focus back to the trigger when the editor closes", async () => {
    const wrapper = await mountSuspended(ChatMessages, {
      props: { messages: [own("a", 30)], messageRoom: () => ROOM },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();

    rows(wrapper)[0].vm.$emit("edit");
    await flushPromises();

    await wrapper.get("textarea").trigger("keydown", { key: "Escape" });
    await flushPromises();

    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(document.activeElement).toBe(
      wrapper.get('button[aria-label="Message actions"]').element,
    );
  });

  it("forgets the editor when its message is deleted", async () => {
    const wrapper = await mountList();

    rows(wrapper)[1].vm.$emit("edit");
    await flushPromises();

    await wrapper.setProps({ messages: [own("a", 30)] });
    await flushPromises();
    await wrapper.setProps({ messages: [own("a", 30), own("b", 20)] });
    await flushPromises();

    expect(wrapper.findAll("textarea")).toHaveLength(0);
  });
});
