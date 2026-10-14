import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useFileManagerStore } from "~/stores/FileManagerStore";

const fileManager = async () => {
  let store!: ReturnType<typeof useFileManagerStore>;
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        store = useFileManagerStore();
        return () => h("div");
      },
    }),
  );
  return { store, unmount: () => wrapper.unmount() };
};

type Sent = { url: string; withCredentials: boolean; body: FormData };

const sent: Sent[] = [];

class FakeXhr {
  upload = { onprogress: null as any };
  withCredentials = false;
  status = 200;
  statusText = "OK";
  response = "{}";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private url = "";
  open(_method: string, url: string) {
    this.url = url;
  }
  send(body: FormData) {
    sent.push({ url: this.url, withCredentials: this.withCredentials, body });
    this.onload?.();
  }
  abort() {}
}

describe("FileManagerStore uploads", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads with the session and names no uploader in the form", async () => {
    const { store, unmount } = await fileManager();
    store.nodeId = "node-1";
    store.serverId = "server-1";

    void store.uploadFiles([new File(["x"], "plugin.dll")]).catch(() => {});
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    unmount();

    expect(sent[0].url).toMatch(/\/file-manager\/upload\/node-1\/server-1$/);
    expect(sent[0].withCredentials).toBe(true);
    expect(sent[0].body.has("userId")).toBe(false);
  });

  it("uploads a folder with the session too", async () => {
    const { store, unmount } = await fileManager();
    store.nodeId = "node-1";
    store.serverId = null as any;

    void store
      .uploadFilesWithPaths(
        [{ file: new File(["x"], "a.cfg"), relativePath: "a.cfg" }],
        "",
      )
      .catch(() => {});
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
    unmount();

    for (const request of sent) {
      expect(request.withCredentials).toBe(true);
      expect(request.body.has("userId")).toBe(false);
    }
  });
});
