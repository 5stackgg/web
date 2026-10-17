import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMWrapper, flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamingSettings from "~/pages/settings/application/streaming.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

vi.mock("~/graphql/graphqlGen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/graphql/graphqlGen")>()),
  generateMutation: (mutation: unknown) => mutation,
}));

const DESCRIPTION =
  "Auto uses the GPU encoder and switches a job to the CPU if the GPU encoder fails. GPU only never uses the CPU; the job fails instead. CPU only always encodes on the CPU (H.264, more CPU cores). Every job still needs a GPU node to run CS2.";
let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

const saved = () =>
  mutate.mock.calls.flatMap(
    ([{ mutation }]) =>
      (mutation?.insert_settings?.[0]?.objects ?? []) as Array<{
        name: string;
        value: string;
      }>,
  );

const mountPage = async () => {
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "mutate",
  ).mockImplementation(mutate);
  const wrapper = await mountSuspended(StreamingSettings, {
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
};

describe("streaming Video Encoder setting (S7-U12)", () => {
  beforeEach(() => {
    useApplicationSettingsStore().settings = [];
  });

  afterEach(async () => {
    unmount?.();
    unmount = undefined;
    await flushPromises();
    vi.restoreAllMocks();
  });

  it("defaults to auto and saves it in the codec's upsert", async () => {
    const wrapper = await mountPage();
    const vm = wrapper.vm as any;
    expect(vm.form.values.video_encoder).toBe("auto");
    await vm.updateSettings();
    expect(mutate).toHaveBeenCalledTimes(1);
    const rows = saved();
    expect(rows).toEqual(
      expect.arrayContaining([
        { name: "live_video_codec", value: "h264" },
        { name: "video_encoder", value: "auto" },
      ]),
    );
    expect(rows.findIndex((row) => row.name === "video_encoder")).toBe(
      rows.findIndex((row) => row.name === "live_video_codec") + 1,
    );
  });

  it.each([
    ["gpu", "gpu"],
    ["cpu", "cpu"],
    ["auto", "auto"],
    [" GPU ", "gpu"],
    ["junk", "auto"],
    ["", "auto"],
    [null, "auto"],
  ])("loads and saves %s as %s", async (value, expected) => {
    // The null case simulates malformed subscription data outside the declared type.
    useApplicationSettingsStore().settings = [
      { name: "video_encoder", value: value as string },
    ];
    const wrapper = await mountPage();
    const vm = wrapper.vm as any;
    expect(vm.form.values.video_encoder).toBe(expected);
    await vm.updateSettings();
    expect(saved()).toContainEqual({ name: "video_encoder", value: expected });
  });

  it.each(["auto", "gpu", "cpu"])("saves the operator's %s choice", async (mode) => {
    const wrapper = await mountPage();
    const vm = wrapper.vm as any;
    vm.form.setFieldValue("video_encoder", mode);
    await vm.updateSettings();
    expect(saved()).toContainEqual({ name: "video_encoder", value: mode });
  });

  const openEncoder = async (wrapper: Awaited<ReturnType<typeof mountPage>>) => {
    const label = wrapper
      .findAll("label")
      .find((item) => item.text() === "Video Encoder");
    expect(label).toBeDefined();
    const trigger = label!.element.parentElement!.querySelector<HTMLElement>(
      '[role="combobox"]',
    );
    expect(trigger).not.toBeNull();
    await new DOMWrapper(trigger!).trigger("pointerdown", {
      button: 0,
      pointerType: "mouse",
    });
    await flushPromises();
    const contentId = trigger!.getAttribute("aria-controls");
    expect(contentId).toBeTruthy();
    const content = document.getElementById(contentId!);
    expect(content).not.toBeNull();
    return Array.from(content!.querySelectorAll<HTMLElement>('[role="option"]'));
  };

  it("shows the label, description and the three choices in order", async () => {
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("Video Encoder");
    expect(wrapper.text()).toContain(DESCRIPTION);
    const options = await openEncoder(wrapper);
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      "Auto (recommended)",
      "GPU only",
      "CPU only",
    ]);
  });

  it("selects CPU only through the keyboard control", async () => {
    const wrapper = await mountPage();
    const options = await openEncoder(wrapper);
    const cpu = options.find((option) => option.textContent?.trim() === "CPU only");
    expect(cpu).toBeDefined();
    cpu!.focus();
    await new DOMWrapper(cpu!).trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect((wrapper.vm as any).form.values.video_encoder).toBe("cpu");
  });
});
