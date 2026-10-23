import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { Crosshair, Tv } from "lucide-vue-next";
import { SidebarProvider } from "@/components/ui/sidebar";
import LeftNavDoors from "~/layouts/components/LeftNavDoors.vue";
import type { LeftNavItem } from "~/layouts/components/leftNav";

const doors: LeftNavItem[] = [
  { key: "play", label: "Play", icon: Crosshair, to: "/play", active: true },
  {
    key: "watch",
    label: "Watch",
    icon: Tv,
    to: "/watch",
    badge: 5,
    badgeTone: "live",
  },
];

let unmount: (() => void) | undefined;

async function mount(rail = false) {
  const wrapper = await mountSuspended(
    defineComponent({
      render: () =>
        h(SidebarProvider, null, () => h(LeftNavDoors, { doors, rail })),
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe("LeftNavDoors", () => {
  it("shows Play and Watch as buttons, marks the page you're on, and counts what's live", async () => {
    const wrapper = await mount();
    const play = wrapper.get('a[href="/play"]');
    const watch = wrapper.get('a[href="/watch"]');

    expect(play.text()).toBe("Play");
    expect(play.attributes("aria-current")).toBe("page");
    expect(watch.attributes("aria-current")).toBeUndefined();
    expect(watch.text()).toContain("5");
  });

  it("keeps both on the icon rail", async () => {
    const wrapper = await mount(true);

    expect(wrapper.find('a[href="/play"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/watch"]').exists()).toBe(true);
  });
});
