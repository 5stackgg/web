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

describe("notification preferences browser tab toggles", () => {
  const storageKey = (kind: string) => `5stack:tab-flash:${kind}`;

  afterEach(() => {
    for (const kind of ["match-found", "admin-call", "chat", "bell"]) {
      localStorage.removeItem(storageKey(kind));
    }
  });

  async function mountTabFlashRows() {
    emulateDevice({ userAgent: userAgents.desktopChrome });
    pwa = fakePwa({ showInstallPrompt: false });

    const wrapper = await mountPage();
    const section = wrapper
      .findAll("section")
      .find((candidate) => candidate.text().includes("Browser tab"));

    expect(section).toBeDefined();

    return section!.findAll("label").map((row) => ({
      title: row.find("span").text(),
      toggle: row.find("[role='switch']"),
    }));
  }

  it("offers every kind, on by default, without push", async () => {
    const rows = await mountTabFlashRows();

    expect(rows.map((row) => row.title)).toEqual([
      "Match found",
      "Organizer calls",
      "Chat messages",
      "Notifications",
    ]);
    for (const row of rows) {
      expect(row.toggle.attributes("aria-checked")).toBe("true");
    }
  });

  it("saves a toggle on this device", async () => {
    const rows = await mountTabFlashRows();
    const chat = rows.find((row) => row.title === "Chat messages")!;

    await chat.toggle.trigger("click");
    await flushPromises();

    expect(localStorage.getItem(storageKey("chat"))).toBe("false");
    expect(chat.toggle.attributes("aria-checked")).toBe("false");
  });

  it("reads a saved choice back", async () => {
    localStorage.setItem(storageKey("bell"), "false");

    const rows = await mountTabFlashRows();

    expect(
      rows
        .find((row) => row.title === "Notifications")!
        .toggle.attributes("aria-checked"),
    ).toBe("false");
    expect(
      rows
        .find((row) => row.title === "Match found")!
        .toggle.attributes("aria-checked"),
    ).toBe("true");
  });
});
