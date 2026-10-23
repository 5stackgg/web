import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { Server, ShieldCheck, Users } from "lucide-vue-next";
import { SidebarProvider } from "@/components/ui/sidebar";
import LeftNavPins from "~/layouts/components/LeftNavPins.vue";
import type { LeftNavItem } from "~/layouts/components/leftNav";
import { useLeftNavState } from "~/composables/useLeftNavState";

const page = (key: string, label: string, icon = Users): LeftNavItem => ({
  key,
  label,
  icon,
  to: `/${key}`,
});

let unmount: (() => void) | undefined;

async function mount(items: LeftNavItem[], adminItems: LeftNavItem[] = []) {
  const wrapper = await mountSuspended(
    defineComponent({
      render: () =>
        h(SidebarProvider, null, () =>
          h(LeftNavPins, { items, adminItems, rail: false }),
        ),
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useLeftNavState().pins.value = [];
  localStorage.clear();
});

describe("LeftNavPins", () => {
  it("shows pinned pages under a Pinned divider, with no star in the label", async () => {
    const wrapper = await mount([page("players", "Players")]);

    expect(wrapper.text()).toContain("Pinned");
    expect(
      wrapper.find('ul[aria-label="Pinned"] a[href="/players"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).not.toContain("Administration");
  });

  it("puts pinned admin pages in their own Administration group below", async () => {
    const wrapper = await mount(
      [page("players", "Players")],
      [page("admin:game-server-nodes", "Game Server Nodes", ShieldCheck)],
    );

    const groups = wrapper.findAll("ul[aria-label]");
    expect(groups.map((group) => group.attributes("aria-label"))).toEqual([
      "Pinned",
      "Administration",
    ]);
  });

  it("moves a pin down with Alt and the arrow key", async () => {
    const state = useLeftNavState();
    state.pins.value = ["players", "servers"];
    const wrapper = await mount([
      page("players", "Players"),
      page("servers", "Public Servers", Server),
    ]);

    await wrapper
      .get('a[href="/players"]')
      .trigger("keydown", { key: "ArrowDown", altKey: true });

    expect(state.pins.value).toEqual(["servers", "players"]);
  });

  it("unpins from the row's star", async () => {
    const state = useLeftNavState();
    state.pins.value = ["players"];
    const wrapper = await mount([page("players", "Players")]);

    await wrapper.get('button[aria-label="Unpin Players"]').trigger("click");

    expect(state.pins.value).toEqual([]);
  });
});
