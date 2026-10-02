import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import ProfileSettingsShell from "~/components/settings/ProfileSettingsShell.vue";

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe("notification settings URLs", () => {
  it("sends the old Notification Preferences URL to Notifications", () => {
    const record = useRouter()
      .getRoutes()
      .find((route) => route.path === "/settings/notification-preferences");

    expect(record?.redirect).toBe("/settings/notifications");
  });

  it("gives Notifications one settings tab", async () => {
    const wrapper = await mountSuspended(
      defineComponent({
        render: () => h(SidebarProvider, null, () => h(ProfileSettingsShell)),
      }),
    );
    unmount = () => wrapper.unmount();
    await flushPromises();

    const tabs = wrapper
      .findAll("a")
      .filter((link) =>
        (link.attributes("href") ?? "").startsWith("/settings/notification"),
      );

    expect(
      tabs.map((link) => [link.attributes("href"), link.text().trim()]),
    ).toEqual([["/settings/notifications", "Notifications"]]);
    expect(tabs[0].find("svg").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Notification Preferences");
    expect(wrapper.text()).not.toContain("Sound Settings");
  });
});
