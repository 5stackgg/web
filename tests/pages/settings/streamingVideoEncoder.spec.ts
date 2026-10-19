import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamingSettings from "~/pages/settings/application/streaming.vue";
import HighlightsSettings from "~/pages/settings/application/highlights.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
vi.mock("~/graphql/graphqlGen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/graphql/graphqlGen")>()),
  generateMutation: (mutation: unknown) => mutation,
}));
let unmount: (() => void) | undefined;
describe("encoding controls have one settings home", () => {
  beforeEach(() => {
    useApplicationSettingsStore().settings = [
      { name: "video_encoder", value: "cpu" },
      { name: "live_video_codec", value: "h265" },
      { name: "clip_video_codec", value: "h265" },
      { name: "clip_fps", value: "30" },
      { name: "clip_resolution", value: "720p" },
    ];
  });
  afterEach(async () => {
    unmount?.();
    await flushPromises();
    vi.restoreAllMocks();
  });
  it.each([
    ["Streaming", StreamingSettings],
    ["Highlights", HighlightsSettings],
  ])(
    "%s links to Video Encoding and never writes encoding settings",
    async (_name, page) => {
      const mutate = vi.fn().mockResolvedValue({ data: {} });
      vi.spyOn(
        (useNuxtApp() as any).$apollo.defaultClient,
        "mutate",
      ).mockImplementation(mutate);
      const wrapper = await mountSuspended(page as any, {
        global: {
          mixins: (useNuxtApp().vueApp as any)._context.mixins,
          stubs: { StorageBreakdown: true, OrphanedUploadsButton: true },
        },
      });
      unmount = () => wrapper.unmount();
      expect(
        wrapper.find('a[href^="/settings/application/encoding"]').text(),
      ).toBe("Video Encoding");
      expect(wrapper.text()).not.toContain("Highlight Codec");
      expect(wrapper.text()).not.toContain("Live Stream Codec");
      await (wrapper.vm as any).updateSettings();
      const rows = mutate.mock.calls[0][0].mutation.insert_settings[0].objects;
      expect(rows.length).toBeGreaterThan(0);
      expect(
        rows.some((r: any) =>
          [
            "video_encoder",
            "live_video_codec",
            "clip_video_codec",
            "clip_fps",
            "clip_resolution",
          ].includes(r.name),
        ),
      ).toBe(false);
    },
  );
});
