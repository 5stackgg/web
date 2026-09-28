import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatInput from "~/components/chat/ChatInput.vue";
import { CHAT_MESSAGE_MAX_LENGTH } from "~/constants/chat";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

async function type(wrapper: Wrapper, text: string) {
  await wrapper.get("textarea").setValue(text);
  await flushPromises();
}

async function submit(wrapper: Wrapper) {
  await wrapper.get("form").trigger("submit");
  await flushPromises();
}

const textarea = (wrapper: Wrapper) =>
  wrapper.get("textarea").element as HTMLTextAreaElement;

const remaining = (wrapper: Wrapper) => wrapper.find(".tabular-nums");

describe("ChatInput", () => {
  beforeEach(() => {
    toast.mockClear();
  });

  it("sends the trimmed text and clears the box", async () => {
    const wrapper = await mountSuspended(ChatInput);

    await type(wrapper, "  gg wp  ");
    await submit(wrapper);

    expect(wrapper.emitted("sendMessage")).toEqual([["gg wp", undefined]]);
    expect(textarea(wrapper).value).toBe("");
    expect(toast).not.toHaveBeenCalled();
  });

  it("sends a message of exactly the limit", async () => {
    const wrapper = await mountSuspended(ChatInput);
    const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH);

    await type(wrapper, message);
    await submit(wrapper);

    expect(wrapper.emitted("sendMessage")).toEqual([[message, undefined]]);
    expect(toast).not.toHaveBeenCalled();
  });

  it("measures the limit after trimming, like the api", async () => {
    const wrapper = await mountSuspended(ChatInput);
    const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH);

    await type(wrapper, `   ${message}\n `);
    await submit(wrapper);

    expect(wrapper.emitted("sendMessage")).toEqual([[message, undefined]]);
  });

  it("refuses an over-length message and keeps the text", async () => {
    const wrapper = await mountSuspended(ChatInput);
    const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 1);

    await type(wrapper, message);
    await submit(wrapper);

    expect(wrapper.emitted("sendMessage")).toBeUndefined();
    expect(textarea(wrapper).value).toBe(message);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({
      variant: "destructive",
      description: "Messages can be up to 2000 characters.",
    });
  });

  it("refuses an over-length message sent with enter", async () => {
    const wrapper = await mountSuspended(ChatInput);
    const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 1);

    await type(wrapper, message);
    await wrapper.get("textarea").trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(wrapper.emitted("sendMessage")).toBeUndefined();
    expect(textarea(wrapper).value).toBe(message);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("counts down only near the limit", async () => {
    const wrapper = await mountSuspended(ChatInput);

    await type(wrapper, "a".repeat(CHAT_MESSAGE_MAX_LENGTH - 201));
    expect(remaining(wrapper).exists()).toBe(false);

    await type(wrapper, "a".repeat(CHAT_MESSAGE_MAX_LENGTH - 200));
    expect(remaining(wrapper).text()).toBe("200");
    expect(remaining(wrapper).classes()).not.toContain("text-destructive");

    await type(wrapper, "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 5));
    expect(remaining(wrapper).text()).toBe("-5");
    expect(remaining(wrapper).classes()).toContain("text-destructive");
  });

  it("counts what will be sent, not surrounding whitespace", async () => {
    const wrapper = await mountSuspended(ChatInput);

    await type(wrapper, ` ${"a".repeat(CHAT_MESSAGE_MAX_LENGTH - 200)}\n  `);

    expect(remaining(wrapper).text()).toBe("200");
  });
});
