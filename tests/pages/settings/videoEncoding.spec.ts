import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EncodingSettings from "~/pages/settings/application/encoding.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { SETTINGS_NAV_GROUPS } from "~/composables/useSettingsNav";

vi.mock("~/graphql/graphqlGen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/graphql/graphqlGen")>()),
  generateMutation: (mutation: unknown) => mutation,
}));

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;
async function mountPage() {
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn((useNuxtApp() as any).$apollo.defaultClient, "mutate")
    .mockImplementation(mutate);
  const wrapper = await mountSuspended(EncodingSettings, {
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("dedicated video encoding settings", () => {
  beforeEach(() => {
    useApplicationSettingsStore().settings = [
      { name: "video_encoder", value: "auto" },
      { name: "live_video_codec", value: "h265" },
      { name: "clip_video_codec", value: "h265" },
    ];
  });
  afterEach(async () => {
    unmount?.();
    unmount = undefined;
    await flushPromises();
    vi.restoreAllMocks();
  });

  it("is directly reachable from App Settings with AMD/NVIDIA and fallback guidance", async () => {
    const items = SETTINGS_NAV_GROUPS.flatMap(group => group.subgroups.flatMap(group => group.items));
    expect(items).toContainEqual(expect.objectContaining({
      path: "/settings/application/encoding",
      labelKey: "pages.settings.application.encoding.title",
    }));
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("AMD or NVIDIA");
    expect(wrapper.text()).toContain("CPU fallback");
    expect(wrapper.findAll('[role="combobox"]')).toHaveLength(1);
  });

  it.each(["auto", "gpu", "cpu"])("persists %s without changing codecs or unrelated settings", async (mode) => {
    const wrapper = await mountPage();
    const vm = wrapper.vm as any;
    vm.form.setFieldValue("video_encoder", mode);
    await vm.updateSettings();
    expect(mutate).toHaveBeenCalledTimes(1);
    const mutation = mutate.mock.calls[0][0].mutation;
    expect(mutation.insert_settings_one[0].object).toEqual({ name: "video_encoder", value: mode });
    expect(mutation.insert_settings).toBeUndefined();
    expect(useApplicationSettingsStore().settings).toContainEqual({ name: "clip_video_codec", value: "h265" });
    expect(vm.submitting).toBe(false);
  });

  it("loads a persisted mode and updates it when another admin saves", async () => {
    const store = useApplicationSettingsStore();
    store.settings = [{ name: "video_encoder", value: " GPU " }];
    const wrapper = await mountPage();
    const vm = wrapper.vm as any;
    expect(vm.form.values.video_encoder).toBe("gpu");
    store.settings = [{ name: "video_encoder", value: "cpu" }];
    await flushPromises();
    expect(vm.form.values.video_encoder).toBe("cpu");
  });

  it("retains the draft after an unrelated settings subscription update", async () => {
    const wrapper = await mountPage();
    const vm = wrapper.vm as any;
    vm.form.setFieldValue("video_encoder", "cpu");
    await flushPromises();
    expect(document.body.textContent).toContain("Save changes");
    useApplicationSettingsStore().settings = [
      { name: "video_encoder", value: "auto" },
      { name: "live_video_codec", value: "h264" },
    ];
    await flushPromises();
    expect(vm.form.values.video_encoder).toBe("cpu");
    expect(document.body.textContent).toContain("Save changes");
  });

  it("does not write an invalid mode", async () => {
    const wrapper = await mountPage();
    const vm = wrapper.vm as any;
    vm.form.setFieldValue("video_encoder", "invalid");
    await vm.updateSettings();
    expect(mutate).not.toHaveBeenCalled();
    expect(vm.submitting).toBe(false);
  });
});
