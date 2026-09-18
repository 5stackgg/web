import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ProfileMenu from "~/layouts/components/ProfileMenu.vue";
import { emulateDevice, fakePwa, userAgents } from "../../helpers/pwaDevice";

let pwa: ReturnType<typeof fakePwa> | undefined;
let unmount: (() => void) | undefined;

beforeEach(() => {
  useAuthStore().me = undefined;
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  pwa?.restore();
  pwa = undefined;
  vi.restoreAllMocks();
});

async function mountOpenMenu(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(ProfileMenu, {
    props: { open: true, ...props },
    slots: { trigger: () => "profile" },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
  return wrapper;
}

function installRow() {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((item) => item.textContent?.trim() === "Install App");
}

describe("ProfileMenu install entry", () => {
  it("offers Install App when asked to and a native prompt is waiting", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: true });

    await mountOpenMenu({ showInstall: true });

    const row = installRow();
    expect(row).toBeDefined();

    row!.click();
    await flushPromises();

    expect(pwa.install).toHaveBeenCalledTimes(1);
  });

  it("opens the Android steps from the menu when there is no native prompt", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: false });

    const wrapper = await mountOpenMenu({ showInstall: true });

    const row = installRow();
    expect(row).toBeDefined();

    row!.click();
    await wrapper.setProps({ open: false });
    await flushPromises();

    expect(pwa.install).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Select 'Install app' or 'Add to Home screen'",
    );
  });

  it("leaves the entry out unless the shell asks for it", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: true });

    await mountOpenMenu();

    expect(installRow()).toBeUndefined();
  });

  it("leaves the entry out inside the installed app", async () => {
    emulateDevice({
      userAgent: userAgents.androidChrome,
      width: 412,
      standalone: true,
    });
    pwa = fakePwa({ showInstallPrompt: false });

    await mountOpenMenu({ showInstall: true });

    expect(installRow()).toBeUndefined();
  });
});
