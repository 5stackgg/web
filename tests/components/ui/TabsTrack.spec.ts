// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

function mountStrip(variant: "track" | "underline") {
  const Host = defineComponent({
    setup() {
      const tab = ref("overview");
      return () =>
        h(
          Tabs,
          {
            modelValue: tab.value,
            "onUpdate:modelValue": (value: string | number) =>
              (tab.value = String(value)),
          },
          () =>
            h(TabsList, { variant }, () => [
              h(TabsTrigger, { value: "overview" }, () => "Overview"),
              h(TabsTrigger, { value: "matches" }, () => "Matches"),
            ]),
        );
    },
  });
  wrapper = mount(Host, { attachTo: document.body });
  return wrapper;
}

function rect(left: number, top: number, width: number, height: number) {
  return () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
    }) as DOMRect;
}

describe("TabsList track variant", () => {
  it("frames the tabs as a 4-wide grid on phones and one row of segments from md", () => {
    const strip = mountStrip("track");
    const list = strip.get('[role="tablist"]');
    expect(list.classes()).toEqual(
      expect.arrayContaining([
        "grid",
        "grid-cols-4",
        "border",
        "p-1",
        "md:flex",
        "md:flex-wrap",
      ]),
    );

    const trigger = strip.get('[role="tab"]');
    expect(trigger.classes()).toEqual(
      expect.arrayContaining(["h-10", "md:h-[38px]", "md:flex-[1_0_auto]"]),
    );
    // Phone cells let a label take two lines instead of cutting it short.
    expect(trigger.get("span").classes()).toEqual(
      expect.arrayContaining(["max-md:line-clamp-2", "max-md:whitespace-normal"]),
    );
  });

  it("leaves the other variants' triggers as they were", () => {
    const strip = mountStrip("underline");
    const trigger = strip.get('[role="tab"]');
    expect(trigger.classes()).not.toContain("h-10");
    expect(trigger.get("span").classes()).toEqual(["truncate"]);
  });

  it("glides the amber pill onto the picked tab, inside the track's border", async () => {
    const strip = mountStrip("track");
    const list = strip.get('[role="tablist"]').element as HTMLElement;
    const [overview, matches] = strip
      .findAll('[role="tab"]')
      .map((tab) => tab.element as HTMLElement);
    list.getBoundingClientRect = rect(100, 50, 400, 48);
    Object.defineProperty(list, "clientLeft", { value: 1 });
    Object.defineProperty(list, "clientTop", { value: 1 });
    overview.getBoundingClientRect = rect(105, 55, 90, 38);
    // On phones the second tab can sit on the grid's next row.
    matches.getBoundingClientRect = rect(197, 95, 90, 38);

    // The list starts listening a tick after it mounts.
    await nextTick();
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    const pill = strip.get(".ring-inset").element as HTMLElement;
    expect(pill.className).toContain("bg-[hsl(var(--tac-amber)/0.12)]");
    expect(pill.style.transform).toBe("translate(4px, 4px)");
    expect(pill.style.width).toBe("90px");
    expect(pill.style.height).toBe("38px");

    await strip.findAll('[role="tab"]')[1].trigger("mousedown", { button: 0 });
    await flushPromises();
    expect(matches.getAttribute("data-state")).toBe("active");
    expect(pill.style.transform).toBe("translate(96px, 44px)");
  });
});
