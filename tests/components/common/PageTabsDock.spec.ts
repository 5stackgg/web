// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import PageTabsDock from "~/components/common/PageTabsDock.vue";

const tab = ref("overview");
let wrapper: VueWrapper | undefined;

beforeEach(() => {
  tab.value = "overview";
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.unstubAllGlobals();
});

// The page scroller, holding the tab sections with the dock first. `sticky`
// stands in for md and up, where the dock's classes make it sticky.
function mountPage(sticky: boolean) {
  const Host = defineComponent({
    setup() {
      return () =>
        h("div", { class: "scroller", style: "overflow-y: auto" }, [
          h(
            Tabs,
            {
              class: "sections",
              modelValue: tab.value,
              "onUpdate:modelValue": (value: string | number) =>
                (tab.value = String(value)),
            },
            () => [
              h(
                PageTabsDock,
                { style: sticky ? "position: sticky; top: 8px" : undefined },
                () =>
                  h(TabsList, { variant: "track" }, () => [
                    h(TabsTrigger, { value: "overview" }, () => "Overview"),
                    h(TabsTrigger, { value: "matches" }, () => "Matches"),
                  ]),
              ),
              h("div", "sections"),
            ],
          ),
        ]);
    },
  });
  wrapper = mount(Host, { attachTo: document.body });
  const scroller = wrapper.get(".scroller").element as HTMLElement;
  const sections = wrapper.get(".sections").element as HTMLElement;
  const dock = sections.firstElementChild as HTMLElement;
  scroller.getBoundingClientRect = () => ({ top: 60 }) as DOMRect;
  Object.defineProperty(scroller, "scrollTop", { value: 0, writable: true });
  return { scroller, sections, dock };
}

const band = (dock: HTMLElement) =>
  dock.querySelector('[aria-hidden="true"]') as HTMLElement;

// The track is 48px tall and the band reaches 8px past it.
function place(
  { scroller, sections, dock }: ReturnType<typeof mountPage>,
  { scrollTop, sectionsTop, dockTop }: Record<string, number>,
) {
  scroller.scrollTop = scrollTop;
  sections.getBoundingClientRect = () => ({ top: sectionsTop }) as DOMRect;
  dock.getBoundingClientRect = () =>
    ({ top: dockTop, bottom: dockTop + 48 }) as DOMRect;
  band(dock).getBoundingClientRect = () =>
    ({ bottom: dockTop + 56 }) as DOMRect;
  scroller.dispatchEvent(new Event("scroll"));
}

describe("PageTabsDock", () => {
  it("shows its band only once it has docked under the top bar", async () => {
    const page = mountPage(true);
    place(page, { scrollTop: 0, sectionsTop: 400, dockTop: 400 });
    await nextTick();
    expect(page.dock.hasAttribute("data-docked")).toBe(false);
    expect(band(page.dock).classList).not.toContain("opacity-100");

    // Scrolled past: the sections' top is above the scroller, the dock holds 8px under it.
    place(page, { scrollTop: 900, sectionsTop: -440, dockTop: 68 });
    await nextTick();
    expect(page.dock.hasAttribute("data-docked")).toBe(true);
    expect(band(page.dock).classList).toContain("opacity-100");
  });

  it("pads the scroller so what it scrolls to lands below the docked strip", async () => {
    const page = mountPage(true);
    place(page, { scrollTop: 0, sectionsTop: 400, dockTop: 400 });
    await nextTick();
    // 8px down, 48px of track, 8px of band.
    expect(page.scroller.style.scrollPaddingTop).toBe("64px");

    wrapper!.unmount();
    wrapper = undefined;
    expect(page.scroller.style.scrollPaddingTop).toBe("");
  });

  it("glides the strip up to its docking line on reveal", async () => {
    const page = mountPage(true);
    place(page, { scrollTop: 0, sectionsTop: 400, dockTop: 400 });
    const scrollTo = vi.fn();
    page.scroller.scrollTo = scrollTo;

    (wrapper!.findComponent(PageTabsDock).vm as any).reveal();
    expect(scrollTo).toHaveBeenCalledWith({ top: 332, behavior: "smooth" });
  });

  it("starts a new section at its top when switched while docked", async () => {
    const page = mountPage(true);
    place(page, { scrollTop: 900, sectionsTop: -440, dockTop: 68 });
    await nextTick();

    tab.value = "matches";
    await nextTick();
    // 900 - (60 + 8 - -440): the sections' top lands where the dock sticks.
    expect(page.scroller.scrollTop).toBe(392);
  });

  it("leaves the scroll alone when switched before it docks", async () => {
    const page = mountPage(true);
    place(page, { scrollTop: 120, sectionsTop: 280, dockTop: 280 });
    await nextTick();

    tab.value = "matches";
    await nextTick();
    expect(page.scroller.scrollTop).toBe(120);
  });

  it("never docks where it isn't sticky (phones)", async () => {
    const page = mountPage(false);
    place(page, { scrollTop: 900, sectionsTop: -440, dockTop: -440 });
    await nextTick();
    expect(page.dock.hasAttribute("data-docked")).toBe(false);
    expect(page.scroller.style.scrollPaddingTop).toBe("");

    tab.value = "matches";
    await nextTick();
    expect(page.scroller.scrollTop).toBe(900);
  });
});
