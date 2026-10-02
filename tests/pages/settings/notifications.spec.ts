import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import Notifications from "~/pages/settings/notifications.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { emulateDevice, fakePwa, userAgents } from "../../helpers/pwaDevice";

const { push, preferences, set } = vi.hoisted(() => ({
  push: {
    subscribed: { value: false },
    refresh: async (): Promise<void> => {},
  },
  preferences: { value: null as any },
  set: vi.fn(async () => {}),
}));

mockNuxtImport("usePushNotifications", () => () => ({
  supported: ref(true),
  isDenied: ref(false),
  busy: ref(false),
  subscribed: ref(push.subscribed.value),
  lastError: ref(null),
  refresh: () => push.refresh(),
  subscribe: async () => false,
  unsubscribe: async () => {},
}));

mockNuxtImport("useNotificationPreferences", () => () => ({
  preferences: ref(preferences.value),
  quietHours: ref({ start: null, end: null, timezone: null }),
  loaded: ref(true),
  loading: ref(false),
  load: async () => {},
  set,
  loadQuietHours: async () => {},
  setQuietHours: async () => {},
  isAlertTypeEnabled: () => true,
  reset: () => {},
}));

mockNuxtImport("useNotificationStore", () => () => ({
  unreadNotificationCount: 3,
}));

const kind = (
  type: string,
  bell: "toggle" | "locked" | "push_only",
  ignoresQuietHours = false,
) => ({ type, bell, ignoresQuietHours });

const category = (
  key: string,
  types: ReturnType<typeof kind>[],
  extra: Record<string, unknown> = {},
) => ({ key, enabled: true, defaultEnabled: true, ...extra, types });

const toggle = (key: string) => ({ key, enabled: true, defaultEnabled: true });

function catalog() {
  return {
    push: [
      category("matches", [
        kind("MatchStatusChange", "toggle"),
        kind("MatchImported", "toggle"),
      ]),
      category("match_found", [kind("MatchFound", "push_only", true)]),
      category("admin_call", [kind("AdminCall", "push_only", true)]),
      category("chat", [kind("ChatMessage", "push_only")]),
      category("match_chat", [kind("MatchChatMessage", "push_only")], {
        enabled: false,
        defaultEnabled: false,
      }),
      category("tournaments", [kind("TournamentReminder", "toggle")]),
      category("utility", [
        kind("UtilityPracticeInvite", "toggle"),
        kind("UtilityPracticeReady", "toggle"),
      ]),
      category("account", [
        kind("NameChangeApproved", "locked"),
        kind("PlayerWarning", "locked"),
        kind("AwardGranted", "toggle"),
      ]),
      category("teammate_bans", [kind("TeammateBanned", "toggle")]),
      category("news", [kind("NewsPublished", "toggle")]),
      category(
        "staff_moderation",
        [kind("MatchSupport", "locked"), kind("NameChangeRequest", "locked")],
        { adminOnly: true },
      ),
      category("staff_infrastructure", [kind("GameUpdate", "locked")], {
        adminOnly: true,
        enabled: false,
        defaultEnabled: false,
      }),
    ],
    in_app: [
      toggle("MatchStatusChange"),
      toggle("MatchImported"),
      toggle("TournamentReminder"),
      toggle("UtilityPracticeInvite"),
      toggle("UtilityPracticeReady"),
      toggle("AwardGranted"),
      toggle("TeammateBanned"),
      toggle("NewsPublished"),
    ],
  };
}

let pwa: ReturnType<typeof fakePwa> | undefined;
let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  pwa?.restore();
  pwa = undefined;
  set.mockClear();
  push.subscribed.value = false;
  push.refresh = async () => {};
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

async function mountPage({
  role = "user",
  subscribed = false,
  device = userAgents.desktopChrome,
  standalone = true,
  served = catalog(),
}: {
  role?: string;
  subscribed?: boolean;
  device?: string;
  standalone?: boolean;
  served?: ReturnType<typeof catalog>;
} = {}) {
  emulateDevice({ userAgent: device, width: 412, standalone });
  pwa = fakePwa({ showInstallPrompt: false });
  push.subscribed.value = subscribed;
  preferences.value = served;
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;

  const wrapper = await mountSuspended(
    defineComponent({
      render: () => h(SidebarProvider, null, () => h(Notifications)),
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Page = Awaited<ReturnType<typeof mountPage>>;

const group = (wrapper: Page, id: string) =>
  wrapper.find(`[data-test="notification-group-${id}"]`);

const kindRow = (wrapper: Page, type: string) =>
  wrapper.find(`[data-test="notification-kind-${type}"]`);

async function openGroup(wrapper: Page, id: string) {
  const toggle = group(wrapper, id).find("button[aria-expanded]");
  if (toggle.attributes("aria-expanded") !== "true") {
    await toggle.trigger("click");
    await flushPromises();
  }
}

describe("notifications page", () => {
  it("lists every kind a player can receive, grouped by push category", async () => {
    const wrapper = await mountPage();

    for (const id of [
      "matches",
      "account",
      "teammate_bans",
      "chat",
      "tournaments",
      "more",
    ]) {
      await openGroup(wrapper, id);
    }

    expect(
      group(wrapper, "matches")
        .findAll("[data-test^='notification-kind-']")
        .map((row) => row.attributes("data-test")),
    ).toEqual([
      "notification-kind-MatchStatusChange",
      "notification-kind-MatchImported",
      "notification-kind-MatchFound",
      "notification-kind-MatchChatMessage",
      "notification-kind-AdminCall",
    ]);

    expect(group(wrapper, "teammate_bans").text()).toContain(
      "When a player you've played with in the last 6 months gets banned.",
    );

    const awards = kindRow(wrapper, "AwardGranted");
    expect(awards.text()).toContain("Awards");
    expect(awards.text()).toContain("You received an award.");
    expect(awards.find("[data-test='kind-example']").text()).not.toBe("");

    expect(
      group(wrapper, "more")
        .findAll("[data-test^='notification-kind-']")
        .map((row) => row.attributes("data-test")),
    ).toEqual([
      "notification-kind-UtilityPracticeInvite",
      "notification-kind-UtilityPracticeReady",
      "notification-kind-NewsPublished",
    ]);
  });

  it("hides the staff group from a player", async () => {
    const wrapper = await mountPage({ role: "user" });

    expect(group(wrapper, "staff").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Staff only");
  });

  it("shows the staff group to a moderator", async () => {
    const wrapper = await mountPage({ role: "moderator" });

    expect(group(wrapper, "staff").exists()).toBe(true);
    expect(group(wrapper, "staff").text()).toContain("Staff only");

    await openGroup(wrapper, "staff");

    expect(kindRow(wrapper, "MatchSupport").exists()).toBe(true);
    expect(kindRow(wrapper, "GameUpdate").exists()).toBe(true);
  });

  it("gives a kind a bell switch, and locks a player's own account notices", async () => {
    const wrapper = await mountPage();
    await openGroup(wrapper, "account");

    const awardsBell = kindRow(wrapper, "AwardGranted").find(
      "[data-test='kind-bell']",
    );
    expect(awardsBell.find("[role='switch']").attributes("aria-label")).toBe(
      "Awards in the bell",
    );

    for (const type of ["NameChangeApproved", "PlayerWarning"]) {
      const bell = kindRow(wrapper, type).find("[data-test='kind-bell']");
      expect(bell.find("[role='switch']").exists()).toBe(false);
      expect(bell.find("svg.lucide-lock-icon").exists()).toBe(true);
      expect(bell.text()).toContain("Always shown: it's about your account");
    }
  });

  it("says push-only kinds never reach the bell", async () => {
    const wrapper = await mountPage();
    await openGroup(wrapper, "matches");

    const bell = kindRow(wrapper, "MatchFound").find("[data-test='kind-bell']");
    expect(bell.find("[role='switch']").exists()).toBe(false);
    expect(bell.text()).toContain("Push only, never in the bell");
    expect(kindRow(wrapper, "MatchFound").text()).toContain(
      "Rings in quiet hours",
    );
  });

  it("saves a kind's bell switch", async () => {
    const wrapper = await mountPage();
    await openGroup(wrapper, "account");

    await kindRow(wrapper, "AwardGranted")
      .find("[data-test='kind-bell'] [role='switch']")
      .trigger("click");
    await flushPromises();

    expect(set).toHaveBeenCalledWith("in_app", "AwardGranted", false);
  });

  it("keeps push one switch per group, with match found, admin calls and match chat on their own", async () => {
    const wrapper = await mountPage();
    await openGroup(wrapper, "matches");

    const header = group(wrapper, "matches").find("[data-test='group-push']");
    expect(header.find("[role='switch']").attributes("aria-label")).toBe(
      "Matches push",
    );

    expect(
      kindRow(wrapper, "MatchImported")
        .find("[data-test='kind-push'] [role='switch']")
        .exists(),
    ).toBe(false);

    for (const [type, label] of [
      ["MatchFound", "Match found push"],
      ["AdminCall", "Admin calls push"],
      ["MatchChatMessage", "Match chat push"],
    ]) {
      expect(
        kindRow(wrapper, type)
          .find("[data-test='kind-push'] [role='switch']")
          .attributes("aria-label"),
      ).toBe(label);
    }

    expect(kindRow(wrapper, "MatchChatMessage").text()).toContain(
      "Push off by default",
    );

    await header.find("[role='switch']").trigger("click");
    await flushPromises();

    expect(set).toHaveBeenCalledWith("push", "matches", false);
  });
});

describe("notifications page loading", () => {
  it("lists the catalog even when this device's push check never settles", async () => {
    push.refresh = () => new Promise<void>(() => {});

    const wrapper = await mountPage();

    expect(group(wrapper, "matches").exists()).toBe(true);
    expect(kindRow(wrapper, "MatchStatusChange").exists()).toBe(true);
  });

  it("falls back to the choices an older server lists, without claiming a load failure", async () => {
    const older = catalog();
    for (const entry of older.push) {
      delete (entry as { types?: unknown }).types;
    }

    const wrapper = await mountPage({ served: older });

    expect(wrapper.text()).not.toContain(
      "Couldn't load your notification settings.",
    );
    expect(wrapper.text()).toContain(
      "Your 5stack server doesn't list every notification kind yet.",
    );

    const pushRows = wrapper.findAll("[data-test^='legacy-push-']");
    expect(pushRows.map((row) => row.attributes("data-test"))).toContain(
      "legacy-push-matches",
    );
    expect(
      wrapper
        .find("[data-test='legacy-push-matches'] [role='switch']")
        .attributes("aria-label"),
    ).toBe("Matches push");
    expect(
      wrapper.find("[data-test='legacy-push-staff_moderation']").exists(),
    ).toBe(false);

    const awards = wrapper.find("[data-test='legacy-bell-AwardGranted']");
    expect(awards.text()).toContain("Awards");
    await awards.find("[role='switch']").trigger("click");
    await flushPromises();

    expect(set).toHaveBeenCalledWith("in_app", "AwardGranted", false);
  });

  it("does not call a switchable kind locked when its bell setting is missing", async () => {
    const served = catalog();
    served.in_app = served.in_app.filter(
      (entry) => entry.key !== "AwardGranted",
    );

    const wrapper = await mountPage({ served });
    await openGroup(wrapper, "account");

    const bell = kindRow(wrapper, "AwardGranted").find(
      "[data-test='kind-bell']",
    );
    expect(bell.find("svg.lucide-lock-icon").exists()).toBe(false);
    expect(bell.text()).not.toContain("Always shown: it's about your account");
    expect(bell.text()).toContain("Can't be changed right now");
  });
});

describe("notifications page push channel", () => {
  const HINT =
    "Push is off on this device. Your Push choices below are still saved, and apply on any device where you turn push on.";

  it("shows push choices and the hint before push is on here", async () => {
    const wrapper = await mountPage({ subscribed: false });

    expect(wrapper.text()).toContain(HINT);
    expect(
      wrapper.find("[data-test='channel-push']").text(),
    ).toContain("Off on this device");

    const groupPush = group(wrapper, "matches").find(
      "[data-test='group-push'] [role='switch']",
    );
    expect(groupPush.exists()).toBe(true);
    expect(groupPush.attributes("disabled")).toBeUndefined();
  });

  it("drops the hint once push is on here", async () => {
    const wrapper = await mountPage({ subscribed: true });

    expect(wrapper.text()).not.toContain(HINT);
    expect(
      wrapper.find("[data-test='channel-push']").text(),
    ).toContain("On on this device");
  });

  it("shows the bell's unread count", async () => {
    const wrapper = await mountPage();

    expect(
      wrapper.find("[data-test='channel-bell']").text().replace(/\s+/g, ""),
    ).toContain("3unread");
  });
});

describe("notifications page install gate", () => {
  const ALREADY_INSTALLED = "Already installed?";

  const installButton = (wrapper: Page) =>
    wrapper.findAll("button").find((button) => button.text() === "Install App");

  it("gives Android without a native prompt the install steps, not 'Already installed?'", async () => {
    const wrapper = await mountPage({
      device: userAgents.androidChrome,
      standalone: false,
    });

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
    const wrapper = await mountPage({
      device: userAgents.androidChrome,
      standalone: true,
    });

    expect(wrapper.text()).not.toContain(ALREADY_INSTALLED);
    expect(installButton(wrapper)).toBeUndefined();
  });

  it("keeps the iOS install button", async () => {
    const wrapper = await mountPage({
      device: userAgents.iphoneSafari,
      standalone: false,
    });

    expect(installButton(wrapper)).toBeDefined();
    expect(wrapper.text()).not.toContain(ALREADY_INSTALLED);
  });
});

describe("notifications page browser tab card", () => {
  const storageKey = (kind: string) => `5stack:tab-flash:${kind}`;

  afterEach(() => {
    for (const kind of ["match-found", "admin-call", "chat", "bell"]) {
      localStorage.removeItem(storageKey(kind));
    }
  });

  async function tabFlashRows() {
    const wrapper = await mountPage();
    const card = wrapper.find("[data-test='channel-tab-flash']");
    expect(card.exists()).toBe(true);

    return card.findAll("label").map((row) => ({
      title: row.find("span").text(),
      toggle: row.find("[role='switch']"),
    }));
  }

  it("offers every kind, on by default, without push", async () => {
    const rows = await tabFlashRows();

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
    const rows = await tabFlashRows();
    const chat = rows.find((row) => row.title === "Chat messages")!;

    await chat.toggle.trigger("click");
    await flushPromises();

    expect(localStorage.getItem(storageKey("chat"))).toBe("false");
    expect(chat.toggle.attributes("aria-checked")).toBe("false");
  });

  it("reads a saved choice back", async () => {
    localStorage.setItem(storageKey("bell"), "false");

    const rows = await tabFlashRows();

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

describe("notifications page sounds card", () => {
  it("keeps the sound switch, volume and a test for each sound", async () => {
    const wrapper = await mountPage();
    const card = wrapper.find("[data-test='channel-sounds']");

    expect(card.find("[role='switch']").exists()).toBe(true);
    expect(card.find("input[type='range']").exists()).toBe(true);
    expect(
      card.findAll("[data-test='sound-test']").map((button) => button.text()),
    ).toEqual(["Chat message", "Match found"]);
  });
});
