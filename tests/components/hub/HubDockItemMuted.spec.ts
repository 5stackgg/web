import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import HubDockItem from "~/components/hub/HubDockItem.vue";

describe("HubDockItem for a room the player muted", () => {
  it("marks the room muted beside its grey count, as the rail does", async () => {
    const wrapper = await mountSuspended(HubDockItem, {
      props: { label: "Lobby", badge: "3", badgeTone: "muted", muted: true },
    });

    expect(wrapper.find("[data-hub-dock-muted]").exists()).toBe(true);
    expect(wrapper.find("[data-hub-dock-badge]").classes()).toContain(
      "bg-zinc-700",
    );
  });

  it("marks no room that is not muted", async () => {
    const wrapper = await mountSuspended(HubDockItem, {
      props: { label: "Lobby", badge: "3", badgeTone: "fresh" },
    });

    expect(wrapper.find("[data-hub-dock-muted]").exists()).toBe(false);
  });
});
