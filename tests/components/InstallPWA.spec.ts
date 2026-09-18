import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import InstallPWA from "~/components/InstallPWA.vue";
import { emulateDevice, fakePwa, userAgents } from "../helpers/pwaDevice";

let pwa: ReturnType<typeof fakePwa> | undefined;
let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  pwa?.restore();
  pwa = undefined;
  vi.restoreAllMocks();
});

async function mountInstallButton() {
  const wrapper = await mountSuspended(
    defineComponent({
      render: () =>
        h(SidebarProvider, null, () =>
          h(InstallPWA, { isMenuItem: false, showLabel: true }),
        ),
    }),
  );
  unmount = () => wrapper.unmount();
  return wrapper;
}

function installButton(
  wrapper: Awaited<ReturnType<typeof mountInstallButton>>,
) {
  return wrapper
    .findAll("button")
    .find((button) => button.text() === "Install App");
}

describe("InstallPWA", () => {
  it("shows Android browser-menu steps when there is no native prompt", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: false });

    const wrapper = await mountInstallButton();
    const button = installButton(wrapper);
    expect(button).toBeDefined();

    await button!.trigger("click");
    await flushPromises();

    expect(pwa.install).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Select 'Install app' or 'Add to Home screen'",
    );
    expect(document.body.textContent).not.toContain("Press the 'Share' button");
  });

  it("tells an in-app WebView to open the page in a browser first", async () => {
    emulateDevice({ userAgent: userAgents.androidWebView, width: 412 });
    pwa = fakePwa({ showInstallPrompt: false });

    const wrapper = await mountInstallButton();
    const button = installButton(wrapper);
    expect(button).toBeDefined();

    await button!.trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain(
      "Open this page in your browser",
    );
  });

  it("opens the native prompt on Android when one was captured", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: true });

    const wrapper = await mountInstallButton();
    await installButton(wrapper)!.trigger("click");
    await flushPromises();

    expect(pwa.install).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain(
      "Select 'Install app' or 'Add to Home screen'",
    );
  });

  it("keeps the iOS Share steps", async () => {
    emulateDevice({ userAgent: userAgents.iphoneSafari, width: 390 });
    pwa = fakePwa({ showInstallPrompt: false });

    const wrapper = await mountInstallButton();
    await installButton(wrapper)!.trigger("click");
    await flushPromises();

    expect(pwa.install).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Press the 'Share' button");
    expect(document.body.textContent).toContain("Select 'Add to Home Screen'");
  });

  it("renders nothing inside the installed app", async () => {
    emulateDevice({
      userAgent: userAgents.androidChrome,
      width: 412,
      standalone: true,
    });
    pwa = fakePwa({ showInstallPrompt: true });

    const wrapper = await mountInstallButton();

    expect(installButton(wrapper)).toBeUndefined();
  });
});
