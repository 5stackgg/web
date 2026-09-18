import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import NotificationPreferences from "~/pages/settings/notification-preferences.vue";
import { emulateDevice, fakePwa, userAgents } from "../../helpers/pwaDevice";

mockNuxtImport("usePushNotifications", () => () => ({
  supported: ref(true),
  isDenied: ref(false),
  busy: ref(false),
  subscribed: ref(false),
  lastError: ref(null),
  refresh: async () => {},
  subscribe: async () => false,
  unsubscribe: async () => {},
}));

mockNuxtImport("useNotificationPreferences", () => () => ({
  preferences: ref({ push: [], in_app: [] }),
  quietHours: ref({ start: null, end: null, timezone: null }),
  load: async () => {},
  set: async () => {},
  loadQuietHours: async () => {},
  setQuietHours: async () => {},
}));

const ALREADY_INSTALLED = "Already installed?";

let pwa: ReturnType<typeof fakePwa> | undefined;
let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  pwa?.restore();
  pwa = undefined;
  vi.restoreAllMocks();
});

async function mountPage() {
  const wrapper = await mountSuspended(
    defineComponent({
      render: () => h(SidebarProvider, null, () => h(NotificationPreferences)),
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

function installButton(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  return wrapper
    .findAll("button")
    .find((button) => button.text() === "Install App");
}

describe("notification preferences install gate", () => {
  it("gives Android without a native prompt the install steps, not 'Already installed?'", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: false });

    const wrapper = await mountPage();

    expect(wrapper.text()).not.toContain(ALREADY_INSTALLED);

    const button = installButton(wrapper);
    expect(button).toBeDefined();

    await button!.trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain(
      "Select 'Install app' or 'Add to Home screen'",
    );
  });

  it("drops the install card entirely inside the installed app", async () => {
    emulateDevice({
      userAgent: userAgents.androidChrome,
      width: 412,
      standalone: true,
    });
    pwa = fakePwa({ showInstallPrompt: false });

    const wrapper = await mountPage();

    expect(wrapper.text()).not.toContain(ALREADY_INSTALLED);
    expect(installButton(wrapper)).toBeUndefined();
  });

  it("keeps the iOS install button", async () => {
    emulateDevice({ userAgent: userAgents.iphoneSafari, width: 390 });
    pwa = fakePwa({ showInstallPrompt: false });

    const wrapper = await mountPage();

    expect(installButton(wrapper)).toBeDefined();
    expect(wrapper.text()).not.toContain(ALREADY_INSTALLED);
  });
});
