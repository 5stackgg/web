import { afterEach, describe, expect, it } from "vitest";
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
  subscribed: ref(true),
  lastError: ref(null),
  refresh: async () => {},
  subscribe: async () => true,
  unsubscribe: async () => {},
}));

const preference = (key: string) => ({
  key,
  enabled: true,
  defaultEnabled: true,
});

mockNuxtImport("useNotificationPreferences", () => () => ({
  preferences: ref({
    push: [
      preference("account"),
      preference("teammate_bans"),
      preference("news"),
    ],
    in_app: [preference("AwardGranted"), preference("TeammateBanned")],
  }),
  quietHours: ref({ start: null, end: null, timezone: null }),
  load: async () => {},
  set: async () => {},
  loadQuietHours: async () => {},
  setQuietHours: async () => {},
}));

let pwa: ReturnType<typeof fakePwa> | undefined;
let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  pwa?.restore();
  pwa = undefined;
});

async function rowsIn(heading: string) {
  emulateDevice({ userAgent: userAgents.desktopChrome });
  pwa = fakePwa({ showInstallPrompt: false });

  const wrapper = await mountSuspended(
    defineComponent({
      render: () => h(SidebarProvider, null, () => h(NotificationPreferences)),
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();

  const list = wrapper
    .findAll("section")
    .find((candidate) => candidate.text().includes(heading));
  expect(list, heading).toBeDefined();

  return list!.findAll("label").map((row) => {
    const [title, description] = row.findAll("span.block");
    return {
      title: title.text(),
      description: description?.text() ?? "",
      enabled: row.find("[role='switch']").attributes("aria-checked"),
    };
  });
}

describe("notification preferences banned teammates", () => {
  it("gives banned teammates their own push row right after account", async () => {
    const rows = await rowsIn("What to push");

    expect(rows).toEqual([
      {
        title: "Account",
        description: "Your name changes, warnings, sanctions and awards.",
        enabled: "true",
      },
      {
        title: "Banned teammates",
        description:
          "When a player you've played with in the last 6 months gets banned.",
        enabled: "true",
      },
      expect.objectContaining({ title: "News" }),
    ]);
  });

  it("names the bell toggle the same way", async () => {
    const rows = await rowsIn("Alert bell");

    expect(rows.map((row) => row.title)).toEqual(["Awards", "Banned teammates"]);
    expect(rows[1].description).not.toBe("");
  });
});
