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

const OUTPUT_CONTROL = /resolution|\bfps\b|720p|1080p/i;

const dialogWith = (marker: string) =>
  [...document.body.querySelectorAll('[role="dialog"]')]
    .map((dialog) => dialog.textContent ?? "")
    .find((text) => text.includes(marker));

describe("clip render requests", () => {
  beforeEach(() => {
    useApplicationSettingsStore().settings = [
      { name: "clip_fps", value: "30" },
      { name: "clip_resolution", value: "720p" },
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

  it("the preset dialog shows no output controls and sends no fps or resolution", async () => {
    const wrapper = await mountSuspended(CreateClipDialog, {
      props: { open: false, matchMapId: "map-1" },
    });
    unmount = () => wrapper.unmount();

    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(dialogWith("Auto Clip")).toBeDefined();
    expect(dialogWith("Auto Clip")).not.toMatch(OUTPUT_CONTROL);

    const vm = wrapper.vm as any;
    vm.presetTarget = "76561198000000009";
    await vm.submit();

    const args = sent("createClipFromPreset");
    expect(args.target_steam_id).toBe("76561198000000009");
    expect(args).not.toHaveProperty("fps");
    expect(args).not.toHaveProperty("resolution");
  });

  it("the clip editor shows no output controls and sends no output", async () => {
    const playback = useDemoPlaybackStore();
    playback.totalTicks = 64 * 60;
    playback.hudVisible = false;
    useClipEditor().addSegmentAt(0, 640);

    const wrapper = await mountSuspended(ClipEditorBar, {
      props: { matchMapId: "map-1" },
    });
    unmount = () => wrapper.unmount();

    expect(wrapper.text()).not.toMatch(OUTPUT_CONTROL);

    await (wrapper.vm as any).submit();

    const { spec } = sent("createClipRender");
    expect(spec.match_map_id).toBe("map-1");
    expect(spec).not.toHaveProperty("output");
  });

  it("the admin highlight dialog shows no output controls and sends no fps or resolution", async () => {
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
    expect(dialogWith("Mirage")).toBeDefined();
    expect(dialogWith("Mirage")).not.toMatch(OUTPUT_CONTROL);

    await (wrapper.vm as any).submit();

    const args = sent("queueClipFromPreset");
    expect(args.target_steam_id).toBe("76561198000000009");
    expect(args).not.toHaveProperty("fps");
    expect(args).not.toHaveProperty("resolution");
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

  const saved = () =>
    (sent("insert_settings").objects as Array<{ name: string }>).filter(
      ({ name }) =>
        name.includes("clip_fps") || name.includes("clip_resolution"),
    );

  it("loads and saves the admin-only clip settings", async () => {
    useApplicationSettingsStore().settings = [
      { name: "clip_fps", value: "30" },
      { name: "clip_resolution", value: "720p" },
    ];
    const wrapper = await mountPage();

    await (wrapper.vm as any).updateSettings();

    expect(saved()).toEqual([
      { name: "clip_fps", value: "30" },
      { name: "clip_resolution", value: "720p" },
    ]);
  });

  it("binds the clip fields to the admin-only names", async () => {
    const wrapper = await mountPage();
    const field = (name: string) =>
      wrapper
        .findAllComponents({ name: "Field" })
        .find((f) => f.props("name") === name);

    expect(field("public.clip_fps")).toBeUndefined();
    expect(field("public.clip_resolution")).toBeUndefined();

    field("clip_fps")!.vm.handleChange("30");
    field("clip_resolution")!.vm.handleChange("720p");
    await flushPromises();
    await (wrapper.vm as any).updateSettings();

    expect(saved()).toEqual([
      { name: "clip_fps", value: "30" },
      { name: "clip_resolution", value: "720p" },
    ]);
  });
});
