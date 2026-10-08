import { describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import FeatureSpotlightNotification from "~/components/notification/FeatureSpotlightNotification.vue";
import { useNotificationStore } from "~/stores/NotificationStore";

const spotlight = {
  key: "auto_highlights",
  to: "/settings/linked-accounts",
  title: "feature_spotlights.auto_highlights.title",
  teaser: "feature_spotlights.auto_highlights.teaser",
  action: "feature_spotlights.auto_highlights.action",
};

describe("FeatureSpotlightNotification", () => {
  it("sends the player to linked accounts", async () => {
    const wrapper = await mountSuspended(FeatureSpotlightNotification, {
      props: { spotlight },
    });

    expect(wrapper.text()).toContain("Highlights From Every Match You Play");
    expect(wrapper.find("a").attributes("href")).toBe(
      "/settings/linked-accounts",
    );
  });

  it.each([
    ["Dismiss", "button"],
    ["Link Account", "a"],
  ])("dismisses the spotlight from %s", async (_label, selector) => {
    const dismiss = vi
      .spyOn(useNotificationStore(), "dismissFeatureSpotlight")
      .mockImplementation(() => {});
    const wrapper = await mountSuspended(FeatureSpotlightNotification, {
      props: { spotlight },
    });

    await wrapper.find(selector).trigger("click");

    expect(dismiss).toHaveBeenCalledWith("auto_highlights");
    dismiss.mockRestore();
  });
});
