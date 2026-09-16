import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { usePwaInstall } from "~/composables/usePwaInstall";
import { emulateDevice, fakePwa, userAgents } from "../helpers/pwaDevice";

let pwa: ReturnType<typeof fakePwa> | undefined;

afterEach(() => {
  pwa?.restore();
  pwa = undefined;
  vi.restoreAllMocks();
});

async function mountInstallState() {
  let state!: ReturnType<typeof usePwaInstall>;
  await mountSuspended(
    defineComponent({
      setup() {
        state = usePwaInstall();
        return () => h("div");
      },
    }),
  );
  return state;
}

describe("usePwaInstall", () => {
  it("offers manual install steps on Android when the browser never fired beforeinstallprompt", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: false });

    const state = await mountInstallState();

    expect(state.installed.value).toBe(false);
    expect(state.canInstall.value).toBe(true);
    expect(state.manualInstall.value).toBe("android");
  });

  it("tells in-app WebViews to open the page in a browser", async () => {
    emulateDevice({ userAgent: userAgents.androidWebView, width: 412 });
    pwa = fakePwa({ showInstallPrompt: false });

    const state = await mountInstallState();

    expect(state.canInstall.value).toBe(true);
    expect(state.manualInstall.value).toBe("in_app");
  });

  it("prefers the native prompt on Android once it has been captured", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: true, outcome: "dismissed" });

    const state = await mountInstallState();

    expect(state.canInstall.value).toBe(true);
    expect(state.manualInstall.value).toBeNull();

    await state.install();

    expect(pwa.install).toHaveBeenCalledTimes(1);
  });

  it("treats an accepted native prompt as installed before appinstalled lands", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: true, outcome: "accepted" });

    const state = await mountInstallState();
    await state.install();
    await flushPromises();

    expect(state.installed.value).toBe(true);
    expect(state.canInstall.value).toBe(false);
  });

  it("shares an accepted install with every other consumer in the tab", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: true, outcome: "accepted" });

    const button = await mountInstallState();
    const page = await mountInstallState();

    await button.install();
    await flushPromises();

    expect(page.installed.value).toBe(true);
    expect(page.canInstall.value).toBe(false);

    const laterMounted = await mountInstallState();

    expect(laterMounted.installed.value).toBe(true);
    expect(laterMounted.canInstall.value).toBe(false);
  });

  it("offers nothing once running as the installed app", async () => {
    emulateDevice({
      userAgent: userAgents.androidChrome,
      width: 412,
      standalone: true,
    });
    pwa = fakePwa({ showInstallPrompt: false });

    const state = await mountInstallState();

    expect(state.installed.value).toBe(true);
    expect(state.canInstall.value).toBe(false);
    expect(state.manualInstall.value).toBeNull();
  });

  it("keeps offering the Share steps on iOS", async () => {
    emulateDevice({ userAgent: userAgents.iphoneSafari, width: 390 });
    pwa = fakePwa({ showInstallPrompt: false });

    const state = await mountInstallState();

    expect(state.canInstall.value).toBe(true);
    expect(state.manualInstall.value).toBe("ios");
  });

  it("offers nothing on a desktop browser without a native prompt", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome });
    pwa = fakePwa({ showInstallPrompt: false });

    const state = await mountInstallState();

    expect(state.canInstall.value).toBe(false);
    expect(state.manualInstall.value).toBeNull();
  });
});
