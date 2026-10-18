import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UpdateSettings from "~/pages/settings/application/updates.vue";
import {
  UPDATE_COMPONENTS,
  buildSourceDraft,
  panelUpdateCommand,
} from "~/utilities/updateSource";
import { SETTINGS_NAV_GROUPS } from "~/composables/useSettingsNav";

const images = Object.fromEntries(
  UPDATE_COMPONENTS.map((name) => [
    name,
    "ghcr.io/example/" + name + ":testing",
  ]),
);
const source = () => ({
  source: { version: 1, mode: "custom", panel: null, images },
  writable: true,
  resourceVersion: "7",
  installedImages: images,
  panel: {
    service: "panel",
    currentVersion: "a".repeat(40),
    status: "pinned",
    canUpdate: false,
  },
  services: [
    {
      service: "api",
      currentImage: images.api,
      targetImage: images.api,
      status: "current",
      canUpdate: false,
    },
  ],
  applyMethod: "host-updater",
  checkedAt: "2026-10-18T09:00:00Z",
});
let fetcher: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;
async function mountPage() {
  const wrapper = await mountSuspended(UpdateSettings);
  await flushPromises();
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("build source settings", () => {
  beforeEach(() => {
    fetcher = vi
      .fn()
      .mockImplementation(async (_url, options) =>
        options?.method === "PUT" ? { applied: false } : source(),
      );
    vi.stubGlobal("$fetch", fetcher);
  });
  afterEach(async () => {
    unmount?.();
    unmount = undefined;
    await flushPromises();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("is reachable from App Settings and displays the actual custom builds", async () => {
    expect(
      SETTINGS_NAV_GROUPS.flatMap((group) =>
        group.subgroups.flatMap((group) => group.items),
      ),
    ).toContainEqual(
      expect.objectContaining({ path: "/settings/application/updates" }),
    );
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("Builds & Updates");
    expect(wrapper.text()).toContain("Saving does not replace or restart");
    expect((wrapper.get("#image-api").element as HTMLInputElement).value).toBe(
      images.api,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("saves the complete chosen source with optimistic concurrency and no apply call", async () => {
    const wrapper = await mountPage();
    await wrapper.get("#image-api").setValue("ghcr.io/example/api:beta");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const writes = fetcher.mock.calls.filter(
      ([, options]) => options?.method === "PUT",
    );
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toMatchObject({
      credentials: "include",
      body: {
        resourceVersion: "7",
        source: {
          version: 1,
          mode: "custom",
          panel: null,
          images: { ...images, api: "ghcr.io/example/api:beta" },
        },
      },
    });
    expect(
      fetcher.mock.calls.every(([url]) =>
        url.endsWith("/system/update-source"),
      ),
    ).toBe(true);
  });
  it("retains an unsaved draft and its original resource version when refreshing status", async () => {
    const wrapper = await mountPage();
    await wrapper.get("#image-api").setValue("ghcr.io/example/api:my-draft");
    fetcher.mockResolvedValueOnce({ ...source(), resourceVersion: "8" });
    const refresh = wrapper
      .findAll("button")
      .find((button) => button.text() === "Refresh")!;
    await refresh.trigger("click");
    await flushPromises();
    expect((wrapper.get("#image-api").element as HTMLInputElement).value).toBe(
      "ghcr.io/example/api:my-draft",
    );
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(
      fetcher.mock.calls.find(([, options]) => options?.method === "PUT")?.[1]
        .body.resourceVersion,
    ).toBe("7");
  });
  it("shows a conflict and retains the edited image", async () => {
    const wrapper = await mountPage();
    await wrapper.get("#image-api").setValue("ghcr.io/example/api:draft");
    fetcher.mockRejectedValueOnce({
      data: { message: "The update source changed; reload before saving" },
    });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "reload before saving",
    );
    expect((wrapper.get("#image-api").element as HTMLInputElement).value).toBe(
      "ghcr.io/example/api:draft",
    );
  });
});

describe("selected update commands", () => {
  it("uses the selected ref and records provenance for a detached checkout", () => {
    const command = panelUpdateCommand({
      version: 1,
      mode: "official",
      channel: "beta",
    });
    expect(command).toContain(
      "https://github.com/5stackgg/5stack-panel.git' 'beta'",
    );
    expect(command).toContain("git config 5stack.update-source-ref 'beta'");
    expect(command).not.toContain("git pull");
  });
  it.each(["beta;id", "-other", "../main", "main/", "main.lock", "main'$(id)"])(
    "never renders an unsafe ref %p",
    (ref) => {
      expect(
        panelUpdateCommand({
          version: 1,
          mode: "custom",
          panel: { repository: "example/panel", ref },
        }),
      ).toBe("");
    },
  );
  it("does not invent a panel feed for image-only custom builds", () => {
    expect(panelUpdateCommand(buildSourceDraft("custom", images, null))).toBe(
      "./update.sh",
    );
  });
});
