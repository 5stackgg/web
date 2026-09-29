import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import CreateClipDialog from "~/components/clips/CreateClipDialog.vue";
import ClipEditorBar from "~/components/clips/ClipEditorBar.vue";
import RenderHighlightForPlayerDialog from "~/components/match/RenderHighlightForPlayerDialog.vue";
import HighlightsSettings from "~/pages/settings/application/highlights.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useDemoPlaybackStore } from "~/stores/DemoPlaybackStore";
import { useClipEditor } from "~/composables/useClipEditor";

vi.mock("~/graphql/graphqlGen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/graphql/graphqlGen")>()),
  generateMutation: (mutation: unknown) => mutation,
}));

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | null = null;

const sent = (action: string) =>
  mutate.mock.calls
    .map(([{ mutation }]) => mutation?.[action]?.[0])
    .find(Boolean);

describe("clip output settings for a non-administrator", () => {
  beforeEach(() => {
    // All a non-administrator's settings subscription can see: `public.` rows.
    useApplicationSettingsStore().settings = [
      { name: "public.clip_fps", value: "30" },
      { name: "public.clip_resolution", value: "720p" },
    ];

    mutate = vi.fn().mockResolvedValue({ data: {} });
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "mutate",
    ).mockImplementation(mutate);
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    useClipEditor().reset();
    useApplicationSettingsStore().settings = [];
    vi.restoreAllMocks();
  });

  it("sends the operator's fps and resolution from the preset dialog", async () => {
    const wrapper = await mountSuspended(CreateClipDialog, {
      props: { open: false, matchMapId: "map-1" },
    });
    unmount = () => wrapper.unmount();

    await wrapper.setProps({ open: true });
    const vm = wrapper.vm as any;
    vm.presetTarget = "76561198000000009";
    await vm.submit();

    expect(sent("createClipFromPreset")).toMatchObject({
      resolution: "720p",
      fps: 30,
    });
  });

  it("sends the operator's fps and resolution from the clip editor", async () => {
    const playback = useDemoPlaybackStore();
    playback.totalTicks = 64 * 60;
    playback.hudVisible = false;
    useClipEditor().addSegmentAt(0, 640);

    const wrapper = await mountSuspended(ClipEditorBar, {
      props: { matchMapId: "map-1" },
    });
    unmount = () => wrapper.unmount();

    await (wrapper.vm as any).submit();

    expect(sent("createClipRender").spec.output).toEqual({
      format: "mp4",
      resolution: "720p",
      fps: 30,
    });
  });

  it("opens the admin highlight dialog on the operator's resolution", async () => {
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "query",
    ).mockResolvedValue({
      data: {
        getHighlightPresetAvailability: {
          has_demo: true,
          knife: true,
          multikills: true,
          best_round: true,
          recap: true,
        },
      },
    });

    const wrapper = await mountSuspended(RenderHighlightForPlayerDialog, {
      props: {
        open: false,
        matchMaps: [{ id: "map-1", label: "Mirage" }],
        targetSteamId: "76561198000000009",
        targetName: "keith",
      },
    });
    unmount = () => wrapper.unmount();

    await wrapper.setProps({ open: true });
    await flushPromises();
    await (wrapper.vm as any).submit();

    const args = sent("queueClipFromPreset");
    expect(args.resolution).toBe("720p");
    expect(args).not.toHaveProperty("fps");
  });
});

describe("highlights settings page", () => {
  afterEach(() => {
    unmount?.();
    unmount = null;
    useApplicationSettingsStore().settings = [];
    vi.restoreAllMocks();
  });

  const mountPage = async () => {
    mutate = vi.fn().mockResolvedValue({ data: {} });
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "mutate",
    ).mockImplementation(mutate);

    const wrapper = await mountSuspended(HighlightsSettings, {
      global: {
        mixins: (useNuxtApp().vueApp as any)._context.mixins,
        stubs: { StorageBreakdown: true, OrphanedUploadsButton: true },
      },
    });
    unmount = () => wrapper.unmount();
    return wrapper;
  };

  it("loads and saves the clip settings under names every role can read", async () => {
    useApplicationSettingsStore().settings = [
      { name: "public.clip_fps", value: "30" },
      { name: "public.clip_resolution", value: "720p" },
    ];
    const wrapper = await mountPage();

    await (wrapper.vm as any).updateSettings();

    expect(sent("insert_settings").objects).toEqual(
      expect.arrayContaining([
        { name: "public.clip_fps", value: "30" },
        { name: "public.clip_resolution", value: "720p" },
      ]),
    );
  });

  it("saves what an admin picks in the clip fields", async () => {
    const wrapper = await mountPage();
    const field = (name: string) =>
      wrapper
        .findAllComponents({ name: "Field" })
        .find((f) => f.props("name") === name);

    field("public.clip_fps")!.vm.handleChange("30");
    field("public.clip_resolution")!.vm.handleChange("720p");
    await flushPromises();
    await (wrapper.vm as any).updateSettings();

    expect(sent("insert_settings").objects).toEqual(
      expect.arrayContaining([
        { name: "public.clip_fps", value: "30" },
        { name: "public.clip_resolution", value: "720p" },
      ]),
    );
  });
});
