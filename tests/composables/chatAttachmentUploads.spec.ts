import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import {
  discardChatAttachment,
  uploadChatAttachment,
} from "~/composables/chatAttachmentUploads";
import { createChatComposerAttachments } from "~/composables/useChatComposerAttachments";

const uuid = (n: number) =>
  `0b7d6c1e-1111-4a2b-9c3d-${String(n).padStart(12, "0")}`;

// Stands in for the browser's XHR: every PUT waits until the test answers it.
class FakeXHR {
  static all: FakeXHR[] = [];
  static inFlight = 0;
  static most = 0;

  upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
    onprogress: null,
  };
  status = 0;
  responseText = "";
  withCredentials = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  url = "";
  done = false;

  open(_method: string, url: string) {
    this.url = url;
  }

  setRequestHeader() {}

  send() {
    FakeXHR.all.push(this);
    FakeXHR.inFlight++;
    FakeXHR.most = Math.max(FakeXHR.most, FakeXHR.inFlight);
  }

  abort() {
    this.finish();
    this.onabort?.();
  }

  respond(status: number, body: Record<string, unknown> = {}) {
    this.finish();
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }

  private finish() {
    if (!this.done) {
      this.done = true;
      FakeXHR.inFlight--;
    }
  }
}

class FakeImage {
  naturalWidth = 64;
  naturalHeight = 64;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    setTimeout(() => this.onload?.());
  }
}

const png = (name: string) =>
  new File([new Uint8Array(8)], name, { type: "image/png" });

const config = {
  max_files: 4,
  max_file_bytes: 100 * 1024 * 1024,
  part_size: 4,
  mime_types: ["image/png"],
  gifs: false,
};

const room = { type: "matchmaking", id: "lobby-1" };

describe("chat attachment uploads", () => {
  let fetchCalls: Array<{ url: string; method: string }>;
  let created = 0;

  beforeEach(() => {
    FakeXHR.all = [];
    FakeXHR.inFlight = 0;
    FakeXHR.most = 0;
    fetchCalls = [];
    created = 0;

    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal(
      "$fetch",
      vi.fn(async (url: string, options: { method: string }) => {
        fetchCalls.push({ url, method: options.method });

        if (url.endsWith("/attachments")) {
          created++;
          return { id: uuid(created), part_size: 4, parts: 2 };
        }

        if (url.endsWith("/complete")) {
          const id = url.split("/").at(-2);
          return {
            id,
            kind: "image",
            name: "f.png",
            mime_type: "image/png",
            size: 8,
          };
        }

        return {};
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Answers whatever part is waiting, one at a time, until nothing is left.
  const drain = async (
    answer: (xhr: FakeXHR) => [number, Record<string, unknown>?] = () => [200],
  ) => {
    for (let i = 0; i < 400; i++) {
      await flushPromises();
      await new Promise((resolve) => setTimeout(resolve, 5));

      const waiting = FakeXHR.all.find((xhr) => !xhr.done);

      if (waiting) {
        waiting.respond(...answer(waiting));
      }
    }
  };

  // The api takes two parts at a time from a player and answers 429 to the
  // rest, so the tray must never ask for more.
  it("never sends more than two parts at once, and finishes every file", async () => {
    const tray = createChatComposerAttachments({
      room: () => room,
      config: () => config,
      upload: uploadChatAttachment,
      discard: discardChatAttachment,
    });

    tray.add(["a.png", "b.png", "c.png", "d.png"].map(png));
    await drain();

    expect(FakeXHR.most).toBeLessThanOrEqual(2);
    expect(FakeXHR.all.filter((xhr) => xhr.url.includes("/parts/"))).toHaveLength(8);
    expect(tray.items.value.map(({ status }) => status)).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
  });

  it("sends the same part again after a 429, rather than starting over", async () => {
    let refused = false;
    const hooks = {
      signal: new AbortController().signal,
      onProgress: () => {},
      onCreated: () => {},
    };

    const upload = uploadChatAttachment(png("a.png"), room, hooks);

    await drain((xhr) => {
      if (!refused && xhr.url.endsWith("/parts/1")) {
        refused = true;
        return [429, { code: "rate_limited" }];
      }
      return [200];
    });

    await expect(upload).resolves.toMatchObject({ id: uuid(1) });
    expect(
      FakeXHR.all.filter((xhr) => xhr.url.endsWith("/parts/1")),
    ).toHaveLength(2);
    expect(
      fetchCalls.filter(({ url }) => url.endsWith("/attachments")),
    ).toHaveLength(1);
  });
});
