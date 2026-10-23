import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { Crosshair, Play, Swords } from "lucide-vue-next";
import { SidebarProvider } from "@/components/ui/sidebar";
import LeftNavSection from "~/layouts/components/LeftNavSection.vue";
import type { LeftNavSectionData } from "~/layouts/components/leftNav";
import { useLeftNavState } from "~/composables/useLeftNavState";

const section: LeftNavSectionData = {
  id: "play",
  label: "Play",
  icon: Crosshair,
  live: { text: "4 live", tone: "live" },
  items: [
    {
      key: "play",
      label: "Find a Match",
      icon: Play,
      to: "/play",
      active: true,
    },
    {
      key: "scrims",
      label: "Scrim Finder",
      icon: Swords,
      to: "/scrims",
      badge: 3,
    },
  ],
};

let unmount: (() => void) | undefined;

async function mount(props: { rail?: boolean; pinnable?: boolean } = {}) {
  const wrapper = await mountSuspended(
    defineComponent({
      render: () =>
        h(SidebarProvider, null, () =>
          h(LeftNavSection, {
            section,
            rail: props.rail ?? false,
            pinnable: props.pinnable ?? true,
          }),
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
  const state = useLeftNavState();
  state.setOpen("play", true);
  state.pins.value = [];
  localStorage.clear();
});

describe("LeftNavSection", () => {
  it("shows the section open, with its live line and the page you are on", async () => {
    const wrapper = await mount();
    const header = wrapper.get('button[aria-controls="left-nav-play"]');

    expect(header.attributes("aria-expanded")).toBe("true");
    expect(header.text()).toContain("4 live");
    expect(wrapper.get('a[href="/play"]').attributes("data-active")).toBe(
      "true",
    );
    expect(wrapper.get('a[href="/scrims"]').text()).toContain("3");
  });

  it("folds, keeps the live line, and remembers the fold", async () => {
    const wrapper = await mount();
    const header = wrapper.get('button[aria-controls="left-nav-play"]');

    await header.trigger("click");

    expect(header.attributes("aria-expanded")).toBe("false");
    expect(header.text()).toContain("4 live");
    expect(wrapper.get("#left-nav-play").attributes("inert")).toBeDefined();
    expect(JSON.parse(localStorage.getItem("5stack:nav-folded")!)).toEqual({
      play: true,
    });
  });

  it("pins a page with its star", async () => {
    const wrapper = await mount();
    const star = wrapper.get('button[aria-label="Pin Scrim Finder"]');

    await star.trigger("click");

    expect(useLeftNavState().pins.value).toEqual(["scrims"]);
    expect(
      wrapper
        .get('button[aria-label="Unpin Scrim Finder"]')
        .attributes("aria-pressed"),
    ).toBe("true");
  });

  it("offers no stars to a visitor", async () => {
    const wrapper = await mount({ pinnable: false });

    expect(wrapper.find('button[aria-label^="Pin"]').exists()).toBe(false);
  });

  it("shows every page as an icon on the rail, folded or not", async () => {
    useLeftNavState().setOpen("play", false);
    const wrapper = await mount({ rail: true });

    expect(wrapper.find('button[aria-controls="left-nav-play"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('a[href="/play"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/scrims"]').exists()).toBe(true);
  });
});
