import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import HubDockItem from "~/components/hub/HubDockItem.vue";

const badge = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) =>
  wrapper.find("[data-hub-dock-badge]");

describe("HubDockItem badge", () => {
  it("puts an @ before the count of a room that tagged you", async () => {
    const wrapper = await mountSuspended(HubDockItem, {
      props: { label: "Autumn Cup", badge: "2", badgeMention: true },
    });

    expect(badge(wrapper).classes()).toContain("bg-red-500");
    expect(badge(wrapper).find("svg").exists()).toBe(true);
    expect(badge(wrapper).text()).toBe("2");
  });

  it("draws a plain count without one", async () => {
    const wrapper = await mountSuspended(HubDockItem, {
      props: { label: "Lobby", badge: "3", badgeTone: "fresh" },
    });

    expect(badge(wrapper).classes()).toContain("bg-zinc-50");
    expect(badge(wrapper).find("svg").exists()).toBe(false);
  });
});
