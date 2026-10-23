import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, type DOMWrapper } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import AppUpdateNotice from "~/components/AppUpdateNotice.vue";
import { useAppUpdate } from "~/composables/useAppUpdate";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  clearNuxtState(["app-update-available", "app-update-dismissed"]);
  vi.restoreAllMocks();
});

// What Nuxt's build check calls once builds/latest.json names another build.
async function newBuildDeployed() {
  await useNuxtApp().callHook("app:manifest:update", {
    id: "next-build",
    timestamp: Date.now(),
  });
  await flushPromises();
}

async function mountNotice() {
  const reload = vi
    .spyOn(window.location, "reload")
    .mockImplementation(() => {});
  // No navigation: once a build is announced, Nuxt reloads at the next one.
  wrapper = await mountSuspended(AppUpdateNotice, { route: false });
  return { wrapper, reload };
}

const refreshButton = (mounted: NonNullable<typeof wrapper>) =>
  mounted
    .findAll("button")
    .find((button: DOMWrapper<Element>) => button.text() === "Refresh");

describe("new version notice", () => {
  it("shows nothing while the tab runs the latest build", async () => {
    const { wrapper } = await mountNotice();

    expect(useAppUpdate().available.value).toBe(false);
    expect(wrapper.text()).not.toContain("New version available");
  });

  it("appears when a new build is deployed, without reloading", async () => {
    const { wrapper, reload } = await mountNotice();

    await newBuildDeployed();

    expect(useAppUpdate().available.value).toBe(true);
    expect(wrapper.text()).toContain("New version available");
    expect(refreshButton(wrapper)).toBeDefined();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads the page when Refresh is pressed", async () => {
    const { wrapper, reload } = await mountNotice();
    await newBuildDeployed();

    await refreshButton(wrapper)!.trigger("click");

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stays dismissed while Nuxt keeps announcing the build", async () => {
    const { wrapper, reload } = await mountNotice();
    await newBuildDeployed();

    await wrapper.find('button[aria-label="Dismiss"]').trigger("click");
    await newBuildDeployed();

    expect(wrapper.text()).not.toContain("New version available");
    expect(reload).not.toHaveBeenCalled();
  });

  it("stays off pages without the app shell", async () => {
    const route = useRoute();
    const layout = route.meta.layout;
    route.meta.layout = false;

    try {
      const { wrapper } = await mountNotice();
      await newBuildDeployed();

      expect(useAppUpdate().available.value).toBe(true);
      expect(wrapper.text()).not.toContain("New version available");
    } finally {
      route.meta.layout = layout;
    }
  });
});
