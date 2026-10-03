import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import {
  ChatUploadError,
  createChatComposerAttachments,
  type ChatAttachmentUploader,
} from "~/composables/useChatComposerAttachments";
import type {
  ChatAttachment,
  ChatAttachmentConfig,
} from "~/utilities/chatAttachments";

const config: ChatAttachmentConfig = {
  max_files: 4,
  max_file_bytes: 100 * 1024 * 1024,
  part_size: 8 * 1024 * 1024,
  mime_types: ["image/png", "video/mp4"],
  gifs: true,
};

const room = { type: "matchmaking" as const, id: "lobby-1" };

const png = (name = "smoke.png") =>
  ({ name, type: "image/png", size: 2048 }) as File;

const descriptor = (id: string): ChatAttachment => ({
  id,
  kind: "image",
  name: "smoke.png",
  mime_type: "image/png",
  size: 2048,
});

// One upload the test drives by hand: how far it got, whether the api gave it
// an id yet, and how it ends.
interface Upload {
  file: File;
  signal: AbortSignal;
  progress: (fraction: number) => void;
  created: (id: string) => void;
  resolve: (attachment: ChatAttachment) => void;
  reject: (error: unknown) => void;
}

function harness(
  overrides: Partial<Parameters<typeof createChatComposerAttachments>[0]> = {},
) {
  const uploads: Upload[] = [];
  const discard = vi.fn();
  const onRejected = vi.fn();

  const upload: ChatAttachmentUploader = (file, _room, hooks) =>
    new Promise((resolve, reject) => {
      uploads.push({
        file,
        signal: hooks.signal,
        progress: hooks.onProgress,
        created: hooks.onCreated,
        resolve,
        reject,
      });
    });

  const tray = createChatComposerAttachments({
    room: () => room,
    config: () => config,
    upload,
    discard,
    onRejected,
    ...overrides,
  });

  return { tray, uploads, discard, onRejected };
}

describe("the attachment tray", () => {
  it("starts uploading the moment a file is picked", async () => {
    const { tray, uploads } = harness();

    tray.add([png()]);

    expect(uploads).toHaveLength(1);
    expect(tray.items.value).toEqual([
      expect.objectContaining({
        name: "smoke.png",
        kind: "image",
        status: "uploading",
        progress: 0,
      }),
    ]);
    expect(tray.busy.value).toBe(true);
  });

  it("shows how far each upload has got", async () => {
    const { tray, uploads } = harness();

    tray.add([png()]);
    uploads[0].progress(0.42);

    expect(tray.items.value[0].progress).toBe(0.42);
  });

  it("is ready to send once every upload is done", async () => {
    const { tray, uploads } = harness();

    tray.add([png("a.png"), png("b.png")]);
    uploads[0].resolve(descriptor("a-1"));
    await flushPromises();

    expect(tray.items.value.map(({ status }) => status)).toEqual([
      "done",
      "uploading",
    ]);
    expect(tray.busy.value).toBe(true);

    uploads[1].resolve(descriptor("a-2"));
    await flushPromises();

    expect(tray.busy.value).toBe(false);
  });

  it("marks a failed upload and says why", async () => {
    const { tray, uploads } = harness();

    tray.add([png()]);
    uploads[0].reject(new ChatUploadError("too_large"));
    await flushPromises();

    expect(tray.items.value[0]).toMatchObject({
      status: "failed",
      error: "too_large",
    });
    expect(tray.busy.value).toBe(true);
  });

  it("starts a failed upload over on retry, dropping what it had stored", async () => {
    const { tray, uploads, discard } = harness();

    tray.add([png()]);
    uploads[0].created("a-1");
    uploads[0].reject(new ChatUploadError("unavailable"));
    await flushPromises();

    tray.retry(tray.items.value[0].key);

    expect(discard).toHaveBeenCalledWith("a-1");
    expect(uploads).toHaveLength(2);
    expect(tray.items.value[0]).toMatchObject({
      status: "uploading",
      progress: 0,
    });

    uploads[1].resolve(descriptor("a-2"));
    await flushPromises();

    expect(tray.beginSend()).toEqual(["a-2"]);
  });

  it("cancels an upload taken out of the tray, and drops what it stored", async () => {
    const { tray, uploads, discard } = harness();

    tray.add([png()]);
    uploads[0].created("a-1");
    tray.remove(tray.items.value[0].key);

    expect(uploads[0].signal.aborted).toBe(true);
    expect(discard).toHaveBeenCalledWith("a-1");
    expect(tray.items.value).toEqual([]);

    // Too late to matter.
    uploads[0].resolve(descriptor("a-1"));
    await flushPromises();

    expect(tray.items.value).toEqual([]);
  });

  it("drops a finished upload taken out of the tray", async () => {
    const { tray, uploads, discard } = harness();

    tray.add([png()]);
    uploads[0].created("a-1");
    uploads[0].resolve(descriptor("a-1"));
    await flushPromises();

    tray.remove(tray.items.value[0].key);

    expect(discard).toHaveBeenCalledWith("a-1");
  });

  it("hands the files over in tray order, and keeps them until the send lands", async () => {
    const { tray, uploads, discard } = harness();

    tray.add([png("a.png"), png("b.png")]);
    uploads[1].resolve(descriptor("a-2"));
    uploads[0].resolve(descriptor("a-1"));
    await flushPromises();

    expect(tray.beginSend()).toEqual(["a-1", "a-2"]);
    expect(tray.items.value).toHaveLength(2);
    expect(tray.sending.value).toBe(true);
    expect(tray.busy.value).toBe(true);

    tray.sent();

    expect(tray.items.value).toEqual([]);
    expect(tray.sending.value).toBe(false);
    expect(discard).not.toHaveBeenCalled();
  });

  // A refused send (rate limit, gag, a room the player left) must not lose
  // what they were sending.
  it("gives the files back when the send is refused", async () => {
    const { tray, uploads, discard } = harness();

    tray.add([png()]);
    uploads[0].resolve(descriptor("a-1"));
    await flushPromises();

    tray.beginSend();
    tray.unsent();

    expect(tray.items.value).toEqual([
      expect.objectContaining({ status: "done" }),
    ]);
    expect(tray.sending.value).toBe(false);
    expect(tray.busy.value).toBe(false);
    expect(discard).not.toHaveBeenCalled();
  });

  it("holds the tray still while a send is on its way", async () => {
    const { tray, uploads, discard } = harness();

    tray.add([png()]);
    uploads[0].resolve(descriptor("a-1"));
    await flushPromises();

    tray.beginSend();
    tray.remove(tray.items.value[0].key);
    tray.add([png("b.png")]);

    expect(tray.items.value).toHaveLength(1);
    expect(uploads).toHaveLength(1);
    expect(discard).not.toHaveBeenCalled();
  });

  it("holds four at most and says so", async () => {
    const { tray, uploads, onRejected } = harness();

    tray.add([png("a.png"), png("b.png"), png("c.png")]);
    tray.add([png("d.png"), png("e.png")]);

    expect(uploads).toHaveLength(4);
    expect(onRejected).toHaveBeenCalledWith([
      { file: expect.objectContaining({ name: "e.png" }), reason: "count" },
    ]);
  });

  it("turns away a file the api would refuse, before uploading it", async () => {
    const { tray, uploads, onRejected } = harness();
    const pdf = { name: "rules.pdf", type: "application/pdf", size: 10 } as File;

    tray.add([pdf]);

    expect(uploads).toEqual([]);
    expect(onRejected).toHaveBeenCalledWith([{ file: pdf, reason: "type" }]);
  });

  it("takes nothing where attachments are off", async () => {
    const { tray, uploads } = harness({ room: () => null });

    tray.add([png()]);

    expect(uploads).toEqual([]);
    expect(tray.items.value).toEqual([]);
  });

  it("drops every unsent upload when the composer goes away", async () => {
    const { tray, uploads, discard } = harness();

    tray.add([png("a.png"), png("b.png")]);
    uploads[0].created("a-1");
    uploads[0].resolve(descriptor("a-1"));
    uploads[1].created("a-2");
    await flushPromises();

    tray.dispose();

    expect(uploads[1].signal.aborted).toBe(true);
    expect(discard.mock.calls.map(([id]) => id).sort()).toEqual([
      "a-1",
      "a-2",
    ]);
    expect(tray.items.value).toEqual([]);
  });
});
