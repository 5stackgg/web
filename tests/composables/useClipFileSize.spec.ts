import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { useClipFileSize } from "~/composables/useClipFileSize";

afterEach(() => {
  vi.unstubAllGlobals();
});

// Without a Cloudflare worker a clip is served by the api, which only hands a
// clip that is not public to the signed-in viewer who may see it.
describe("useClipFileSize", () => {
  it("reads the size as the signed-in viewer", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, { headers: { "content-length": "2097152" } }),
    );
    vi.stubGlobal("fetch", fetch);

    const size = useClipFileSize("https://demos.5stack.gg/clips/c1?v=1");
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith("https://demos.5stack.gg/clips/c1?v=1", {
      method: "HEAD",
      credentials: "include",
    });
    expect(size.value).toBe("2.0 MB");
  });
});
