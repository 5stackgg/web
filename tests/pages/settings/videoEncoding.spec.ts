import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMWrapper, flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import EncodingSettings from "~/pages/settings/application/encoding.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { SETTINGS_NAV_GROUPS } from "~/composables/useSettingsNav";
import { toast } from "~/components/ui/toast";
vi.mock("~/components/ui/toast", () => ({ toast: vi.fn() }));

vi.mock("~/graphql/graphqlGen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/graphql/graphqlGen")>()),
  generateMutation: (mutation: unknown) => mutation,
}));
let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;
async function mountPage() {
  provideApolloClient((useNuxtApp() as any).$apollo.defaultClient);
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "mutate",
  ).mockImplementation(mutate);
  const wrapper = await mountSuspended(EncodingSettings);
  unmount = () => wrapper.unmount();
  return wrapper;
}
const rows = () => mutate.mock.calls[0][0].mutation.insert_settings[0].objects;

describe("dedicated video encoding settings", () => {
  beforeEach(() => {
    useApplicationSettingsStore().settings = [
      { name: "video_encoder", value: "auto" },
      { name: "live_video_codec", value: "h265" },
      { name: "clip_video_codec", value: "h265" },
      { name: "clip_fps", value: "60" },
      { name: "clip_resolution", value: "1080p" },
    ];
  });
  afterEach(async () => {
    unmount?.();
    unmount = undefined;
    await flushPromises();
    vi.restoreAllMocks();
  });
  it("exposes every video output control with hardware and fallback guidance", async () => {
    expect(
      SETTINGS_NAV_GROUPS.flatMap((g) => g.subgroups.flatMap((g) => g.items)),
    ).toContainEqual(
      expect.objectContaining({ path: "/settings/application/encoding" }),
    );
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("AMD or NVIDIA");
    expect(wrapper.text()).toContain("CPU fallback");
    expect(wrapper.text()).toContain("final MP4");
    expect(wrapper.text()).toContain("Running jobs and existing videos");
    expect(wrapper.findAll('[role="combobox"]')).toHaveLength(5);
    expect(wrapper.find('a[href="/gpu-nodes"]').exists()).toBe(true);
  });
  it.each(["gpu", "cpu"])(
    "saves %s without rewriting codecs or other settings",
    async (mode) => {
      const vm = (await mountPage()).vm as any;
      vm.form.setFieldValue("video_encoder", mode);
      await vm.updateSettings();
      expect(rows()).toEqual([{ name: "video_encoder", value: mode }]);
      expect(vm.form.meta.value.dirty).toBe(false);
    },
  );
  it("saves output changes together and leaves unrelated settings out", async () => {
    const vm = (await mountPage()).vm as any;
    for (const [name, value] of Object.entries({
      live_video_codec: "h264",
      clip_video_codec: "h264",
      clip_fps: "30",
      clip_resolution: "720p",
    }))
      vm.form.setFieldValue(name, value);
    await vm.updateSettings();
    expect(rows()).toEqual([
      { name: "live_video_codec", value: "h264" },
      { name: "clip_video_codec", value: "h264" },
      { name: "clip_fps", value: "30" },
      { name: "clip_resolution", value: "720p" },
    ]);
  });
  it("does not initialize missing settings on a no-change save", async () => {
    useApplicationSettingsStore().settings = [];
    const vm = (await mountPage()).vm as any;
    expect(vm.form.values).toEqual({
      video_encoder: "auto",
      live_video_codec: "h264",
      clip_video_codec: "h264",
      clip_fps: "60",
      clip_resolution: "1080p",
    });
    await vm.updateSettings();
    expect(mutate).not.toHaveBeenCalled();
  });
  it("normalizes stored modes and responds to another admin's changes", async () => {
    const store = useApplicationSettingsStore();
    store.settings = [{ name: "video_encoder", value: " GPU " }];
    const vm = (await mountPage()).vm as any;
    expect(vm.form.values.video_encoder).toBe("gpu");
    store.settings = [{ name: "video_encoder", value: "cpu" }];
    await flushPromises();
    expect(vm.form.values.video_encoder).toBe("cpu");
  });
  it("preserves drafts when another output or an unrelated setting changes", async () => {
    const store = useApplicationSettingsStore();
    const vm = (await mountPage()).vm as any;
    vm.form.setFieldValue("video_encoder", "cpu");
    store.settings = store.settings.map((s) =>
      s.name === "live_video_codec" ? { ...s, value: "h264" } : s,
    );
    store.settings.push({ name: "clips_max_storage", value: "100" });
    await flushPromises();
    expect(vm.form.values.video_encoder).toBe("cpu");
    expect(vm.form.values.live_video_codec).toBe("h264");
    expect(document.body.textContent).toContain("Save changes");
    await vm.updateSettings();
    expect(rows()).toEqual([{ name: "video_encoder", value: "cpu" }]);
  });
  it.each([
    ["video_encoder", "invalid"],
    ["live_video_codec", "av1"],
    ["clip_video_codec", "av1"],
    ["clip_fps", "120"],
    ["clip_resolution", "4k"],
  ])("rejects unsupported %s", async (name, value) => {
    const vm = (await mountPage()).vm as any;
    vm.form.setFieldValue(name, value);
    await vm.updateSettings();
    expect(mutate).not.toHaveBeenCalled();
    expect(vm.submitting).toBe(false);
  });
  it("keeps the draft and reports failed saves", async () => {
    const vm = (await mountPage()).vm as any;
    mutate.mockRejectedValueOnce(new Error("unavailable"));
    vm.form.setFieldValue("video_encoder", "cpu");
    await vm.updateSettings();
    expect(vm.form.values.video_encoder).toBe("cpu");
    expect(vm.form.meta.value.dirty).toBe(true);
    expect(vm.submitting).toBe(false);
    expect(toast).toHaveBeenCalledWith({
      title:
        "Could not save video encoding settings. Your changes are still here.",
      variant: "destructive",
    });
  });
  it("discards changes back to the loaded values", async () => {
    const vm = (await mountPage()).vm as any;
    vm.form.setFieldValue("clip_fps", "30");
    await flushPromises();
    const button = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Discard",
    );
    expect(button).toBeDefined();
    button!.click();
    await flushPromises();
    expect(vm.form.values.clip_fps).toBe("60");
    expect(mutate).not.toHaveBeenCalled();
  });
  it("allows CPU selection by keyboard through the actual selector", async () => {
    const wrapper = await mountPage();
    const trigger = wrapper.find('#encoding [role="combobox"]');
    await trigger.trigger("pointerdown", { button: 0, pointerType: "mouse" });
    await flushPromises();
    const content = document.getElementById(
      trigger.attributes("aria-controls")!,
    )!;
    const options = Array.from(
      content.querySelectorAll<HTMLElement>('[role="option"]'),
    );
    expect(options.map((o) => o.textContent?.trim())).toEqual([
      "Auto (recommended)",
      "GPU only",
      "CPU only",
    ]);
    const cpu = options[2];
    cpu.focus();
    await new DOMWrapper(cpu).trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect((wrapper.vm as any).form.values.video_encoder).toBe("cpu");
  });
});
