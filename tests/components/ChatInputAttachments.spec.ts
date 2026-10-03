import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatInput from "~/components/chat/ChatInput.vue";
import type { ChatAttachmentConfig } from "~/utilities/chatAttachments";
// @ts-expect-error only the mock below exports it
import { testConfig as config } from "~/composables/useChatAttachmentConfig";

const { uploads, discards } = vi.hoisted(() => ({
  uploads: [] as Array<{
    resolve: (attachment: unknown) => void;
    reject: (error: unknown) => void;
  }>,
  discards: [] as string[],
}));

vi.mock("~/composables/useChatAttachmentConfig", async () => {
  const { computed, shallowRef } = await import("vue");
  const config = shallowRef<ChatAttachmentConfig | null>(null);

  return {
    testConfig: config,
    useChatAttachmentConfig: () => ({
      config: computed(() => config.value),
      load: vi.fn(async () => {}),
    }),
  };
});

vi.mock("~/composables/chatAttachmentUploads", () => ({
  uploadChatAttachment: () =>
    new Promise((resolve, reject) => {
      uploads.push({ resolve, reject });
    }),
  discardChatAttachment: (id: string) => {
    discards.push(id);
  },
}));

const LIMITS: ChatAttachmentConfig = {
  max_files: 4,
  max_file_bytes: 100 * 1024 * 1024,
  part_size: 8 * 1024 * 1024,
  mime_types: ["image/png", "video/mp4"],
  gifs: false,
};

const room = { type: "matchmaking", id: "lobby-1" };

const png = new File([new Uint8Array(16)], "smoke.png", { type: "image/png" });

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

const attachButton = (wrapper: Wrapper) =>
  wrapper.find("[data-chat-attach]");
const gifButton = (wrapper: Wrapper) => wrapper.find("[data-chat-gif]");
const sendButton = (wrapper: Wrapper) =>
  wrapper.get("button[type='submit']").element as HTMLButtonElement;

async function pick(wrapper: Wrapper, files: File[]) {
  const input = wrapper.get("input[type='file']");
  Object.defineProperty(input.element, "files", {
    value: files,
    configurable: true,
  });
  await input.trigger("change");
  await flushPromises();
}

describe("ChatInput attachments", () => {
  beforeEach(() => {
    config.value = { ...LIMITS };
    uploads.length = 0;
    discards.length = 0;
  });

  it("offers nothing to attach in a text-only room", async () => {
    const wrapper = await mountSuspended(ChatInput);

    expect(attachButton(wrapper).exists()).toBe(false);
    expect(gifButton(wrapper).exists()).toBe(false);
  });

  it("offers a file where the room takes them", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    expect(attachButton(wrapper).exists()).toBe(true);
  });

  it("hides the GIF button until the operator sets a GIPHY key", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    expect(gifButton(wrapper).exists()).toBe(false);

    config.value = { ...LIMITS, gifs: true };
    await flushPromises();

    expect(gifButton(wrapper).exists()).toBe(true);
  });

  it("holds Send until the upload finishes, then sends the file without text", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    await pick(wrapper, [png]);

    expect(wrapper.text()).toContain("smoke.png");
    expect(sendButton(wrapper).disabled).toBe(true);

    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("sendMessage")).toBeUndefined();

    uploads[0].resolve({
      id: "a-1",
      kind: "image",
      name: "smoke.png",
      mime_type: "image/png",
      size: 16,
    });
    await flushPromises();

    expect(sendButton(wrapper).disabled).toBe(false);

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    const [[text, destination, media]] = wrapper.emitted("sendMessage") as any;
    expect([text, destination, media.attachments]).toEqual(["", undefined, ["a-1"]]);

    // Still held until the room says it took the message.
    expect(wrapper.text()).toContain("smoke.png");

    media.delivered(Promise.resolve());
    await flushPromises();

    expect(wrapper.text()).not.toContain("smoke.png");
    expect(discards).toEqual([]);
  });

  const uploaded = async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    await pick(wrapper, [png]);
    uploads[0].resolve({
      id: "a-1",
      kind: "image",
      name: "smoke.png",
      mime_type: "image/png",
      size: 16,
    });
    await flushPromises();

    return wrapper;
  };

  it("gives the files and the text back when the room refuses the send", async () => {
    const wrapper = await uploaded();

    await wrapper.get("textarea").setValue("our smokes");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    const [[, , media]] = wrapper.emitted("sendMessage") as any;
    media.delivered(Promise.reject({ code: "rate_limited", action: "send" }));
    await flushPromises();

    expect(wrapper.text()).toContain("smoke.png");
    expect(
      (wrapper.get("textarea").element as HTMLTextAreaElement).value,
    ).toBe("our smokes");
    expect(sendButton(wrapper).disabled).toBe(false);
    expect(discards).toEqual([]);
  });

  it("says why Send is waiting", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    await pick(wrapper, [png]);

    expect(wrapper.text()).toContain("Waiting for uploads");
    expect(wrapper.get("button[type='submit']").attributes("aria-label")).toBe(
      "Waiting for uploads…",
    );

    uploads[0].reject(Object.assign(new Error("x"), { code: "unavailable" }));
    await flushPromises();

    expect(wrapper.text()).toContain("Remove or retry failed files");
  });

  it("says when the day's upload allowance is used up", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });
    const { ChatUploadError } = await import(
      "~/composables/useChatComposerAttachments"
    );

    await pick(wrapper, [png]);
    uploads[0].reject(new ChatUploadError("quota_exceeded"));
    await flushPromises();

    expect(wrapper.html()).toContain("You've reached today's upload allowance.");
  });

  it("says an image is too big, rather than over the size limit", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });
    const { ChatUploadError } = await import(
      "~/composables/useChatComposerAttachments"
    );

    await pick(wrapper, [png]);
    uploads[0].reject(new ChatUploadError("too_large"));
    await flushPromises();

    expect(wrapper.html()).toContain("This image is too big.");
  });

  it("ignores a file picked after the composer went away", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });
    const input = wrapper.get("input[type='file']").element as HTMLInputElement;

    wrapper.unmount();

    Object.defineProperty(input, "files", { value: [png], configurable: true });
    input.dispatchEvent(new Event("change"));
    await flushPromises();

    expect(uploads).toHaveLength(0);
  });

  it("attaches an image pasted into the box", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    const paste = new Event("paste", { cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { files: [png] },
    });
    wrapper.get("textarea").element.dispatchEvent(paste);
    await flushPromises();

    expect(uploads).toHaveLength(1);
    expect(paste.defaultPrevented).toBe(true);
  });

  // A spreadsheet's cells come with an image of them on the clipboard too.
  it("pastes the text when the clipboard has both text and a file", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    const paste = new Event("paste", { cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { files: [png], types: ["text/plain", "Files"] },
    });
    wrapper.get("textarea").element.dispatchEvent(paste);
    await flushPromises();

    expect(uploads).toHaveLength(0);
    expect(paste.defaultPrevented).toBe(false);
  });

  it("leaves a paste of plain text alone", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    const paste = new Event("paste", { cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { files: [] } });
    wrapper.get("textarea").element.dispatchEvent(paste);

    expect(uploads).toHaveLength(0);
    expect(paste.defaultPrevented).toBe(false);
  });

  it("drops unsent uploads when it goes away", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    await pick(wrapper, [png]);
    uploads[0].resolve({
      id: "a-1",
      kind: "image",
      name: "smoke.png",
      mime_type: "image/png",
      size: 16,
    });
    await flushPromises();

    wrapper.unmount();

    expect(discards).toEqual(["a-1"]);
  });
});
