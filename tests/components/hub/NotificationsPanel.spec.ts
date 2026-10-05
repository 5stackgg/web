import { afterEach, describe, expect, it } from "vitest";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import NotificationsPanel from "~/components/hub/NotificationsPanel.vue";

mockNuxtImport("useNotificationStore", () => () => ({
  team_invites: [],
  tournament_team_invites: [],
  tournament_invites: [],
  draft_invites: [],
  notifications: [],
  scheduleTasks: [],
  rosterNeeds: [],
  stackedNotifications: [],
  unreadNewsArticle: null,
}));

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

describe("NotificationsPanel header", () => {
  it("has a settings gear that opens the Notifications page", async () => {
    const wrapper = await mountSuspended(NotificationsPanel, {
      global: { stubs: { NewsNotification: true } },
    });
    unmount = () => wrapper.unmount();

    const gear = wrapper.find("a[href='/settings/notifications']");
    expect(gear.exists()).toBe(true);
    expect(gear.attributes("aria-label")).toBe("Notification Settings");
    expect(gear.find("svg.lucide-settings-icon").exists()).toBe(true);
  });
});
