import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatInput from "~/components/chat/ChatInput.vue";
import ChatAttachMenu from "~/components/chat/ChatAttachMenu.vue";
import type { ChatAttachmentConfig } from "~/utilities/chatAttachments";
// @ts-expect-error only the mock below exports it
import { testConfig as config } from "~/composables/useChatAttachmentConfig";

const { toast, toastHandle } = vi.hoisted(() => {
  const toastHandle = { dismiss: vi.fn(), id: "t-1", update: vi.fn() };
  return { toast: vi.fn(() => toastHandle), toastHandle };
});

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

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

const attachButton = (wrapper: Wrapper) => wrapper.find("[data-chat-attach]");
const attachMenu = (wrapper: Wrapper) => wrapper.findComponent(ChatAttachMenu);
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
    toast.mockClear();
    toastHandle.dismiss.mockClear();
  });

  it("offers nothing to attach in a text-only room", async () => {
    const wrapper = await mountSuspended(ChatInput);

    expect(attachButton(wrapper).exists()).toBe(false);
    expect(attachMenu(wrapper).exists()).toBe(false);
  });

  it("offers a file where the room takes them", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    expect(attachButton(wrapper).exists()).toBe(true);
  });

  it("opens the file dialog from the + when there are no GIFs", async () => {
    const click = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    await attachButton(wrapper).trigger("click");

    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("offers GIFs from the + once the operator sets a GIPHY key", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    expect(attachMenu(wrapper).props("gifs")).toBe(false);

    config.value = { ...LIMITS, gifs: true };
    await flushPromises();

    expect(attachMenu(wrapper).props("gifs")).toBe(true);
    // No button of its own beside the box.
    expect(wrapper.find("[data-chat-gif]").exists()).toBe(false);
  });

  // Match and team rooms: the game server is sent text, so a GIF id is all
  // they take.
  it("offers only GIFs where the room takes no files", async () => {
    config.value = { ...LIMITS, gifs: true };

    const wrapper = await mountSuspended(ChatInput, {
      props: { takesGifs: true },
    });

    expect(attachMenu(wrapper).exists()).toBe(true);
    expect(attachMenu(wrapper).props("files")).toBe(false);
    expect(attachMenu(wrapper).props("gifs")).toBe(true);
    expect(wrapper.find("input[type='file']").exists()).toBe(false);
  });

  it("offers nothing in a GIF-only room until GIPHY is set up", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { takesGifs: true },
    });

    expect(attachButton(wrapper).exists()).toBe(false);
    expect(attachMenu(wrapper).exists()).toBe(false);
  });

  it("names the box without a generic placeholder", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });
    const box = wrapper.get("textarea");

    expect(box.attributes("placeholder")).toBeUndefined();
    expect(box.attributes("aria-label")).toBe("Message");
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
    expect([text, destination, media.attachments]).toEqual([
      "",
      undefined,
      ["a-1"],
    ]);

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
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "our smokes",
    );
    expect(sendButton(wrapper).disabled).toBe(false);
    expect(discards).toEqual([]);
  });

  // The answer came after the request gave up: the message is in the room,
  // so the composer must not keep offering to send it again.
  it("clears the composer when a timed-out send turns out to have landed", async () => {
    const wrapper = await uploaded();

    await wrapper.get("textarea").setValue("our smokes");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    const [[, , media]] = wrapper.emitted("sendMessage") as any;
    media.delivered(Promise.reject({ code: "timeout", action: "send" }));
    await flushPromises();

    expect(wrapper.text()).toContain("smoke.png");

    media.sentLate();
    await flushPromises();

    expect(wrapper.text()).not.toContain("smoke.png");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect(toastHandle.dismiss).toHaveBeenCalled();
  });

  it("treats a retry the room says already went out as sent", async () => {
    const wrapper = await uploaded();

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    const [[, , media]] = wrapper.emitted("sendMessage") as any;
    media.delivered(Promise.reject({ code: "already_sent", action: "send" }));
    await flushPromises();

    expect(wrapper.text()).not.toContain("smoke.png");
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("sends a GIF once, however fast it is clicked again", async () => {
    config.value = { ...LIMITS, gifs: true };
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });
    const gif = { id: "abc123", width: 480, height: 270 };

    (wrapper.vm as any).sendGif(gif);
    (wrapper.vm as any).sendGif(gif);

    expect(wrapper.emitted("sendMessage")).toEqual([["", undefined, { gif }]]);
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
    const { ChatUploadError } =
      await import("~/composables/useChatComposerAttachments");

    await pick(wrapper, [png]);
    uploads[0].reject(new ChatUploadError("quota_exceeded"));
    await flushPromises();

    expect(wrapper.html()).toContain(
      "You've reached today's upload allowance.",
    );
  });

  it("says an image is too big, rather than over the size limit", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });
    const { ChatUploadError } =
      await import("~/composables/useChatComposerAttachments");

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

  const pasteOf = (text: string) => {
    const paste = new Event("paste", { cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        files: [png],
        types: ["text/plain", "Files"],
        getData: (type: string) => (type === "text/plain" ? text : ""),
      },
    });
    return paste;
  };

  // A spreadsheet's cells come with an image of them on the clipboard too.
  it("pastes a spreadsheet's cells as text, not as the picture of them", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    const paste = pasteOf("K/D\tADR\n1.4\t92");
    wrapper.get("textarea").element.dispatchEvent(paste);
    await flushPromises();

    expect(uploads).toHaveLength(0);
    expect(paste.defaultPrevented).toBe(false);
  });

  // Finder puts the file's name next to it; Firefox's Copy Image, its URL.
  it.each([
    ["the file's own name", "smoke.png"],
    ["a single link", "https://cdn.example/smoke.png"],
  ])("attaches the file when the text is just %s", async (_, text) => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { attachmentRoom: room },
    });

    const paste = pasteOf(text);
    wrapper.get("textarea").element.dispatchEvent(paste);
    await flushPromises();

    expect(uploads).toHaveLength(1);
    expect(paste.defaultPrevented).toBe(true);
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
