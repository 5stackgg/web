import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";

const options = [
  { key: "list", label: "Lineups" },
  { key: "meta", label: "Meta", count: 12 },
  { key: "plan", label: "Plan" },
];

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
type Played = { element: Element; keyframes: Keyframe[] };

const played: Played[] = [];
const observed: Element[] = [];
let resized: () => void = () => {};
let reduced = false;
let tabWidth = 80;
let wrapper: Wrapper | undefined;

// Nothing is laid out here, so the strip is given one: tabs 80 wide with 10
// between them, starting 4 in.
const tabs = (element: Element) =>
  Array.from(element.parentElement?.querySelectorAll("button") ?? []);
const leftOf = (element: Element) =>
  4 + tabs(element).indexOf(element as HTMLButtonElement) * (tabWidth + 10);

beforeEach(() => {
  played.length = 0;
  observed.length = 0;
  reduced = false;
  tabWidth = 80;
  const isTab = (element: Element) => element.tagName === "BUTTON";
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return isTab(this) ? tabWidth : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return isTab(this) ? 22 : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    function (this: HTMLElement) {
      return isTab(this) ? leftOf(this) : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
    function (this: HTMLElement) {
      return isTab(this) ? 4 : 0;
    },
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const element = this as HTMLElement;
      const left = isTab(element)
        ? leftOf(element)
        : Number.parseFloat(element.style.left) || 0;
      const top = isTab(element)
        ? 4
        : Number.parseFloat(element.style.top) || 0;
      const width = isTab(element)
        ? tabWidth
        : Number.parseFloat(element.style.width) || 0;
      const height = isTab(element)
        ? 22
        : Number.parseFloat(element.style.height) || 0;
      return { left, top, width, height } as DOMRect;
    },
  );
  Element.prototype.animate = function (
    this: Element,
    keyframes: Keyframe[],
  ) {
    played.push({ element: this, keyframes });
    return {
      addEventListener() {},
      cancel() {},
    } as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("reduced-motion") ? reduced : false,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(report: () => void) {
        resized = report;
      }
      observe(element: Element) {
        observed.push(element);
      }
      unobserve() {}
      disconnect() {
        observed.length = 0;
      }
    },
  );
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // @ts-expect-error put back as it was found: happy-dom has none
  delete Element.prototype.animate;
});

async function mountFilters(props: Record<string, unknown> = {}) {
  wrapper = await mountSuspended(AnimatedFilters, {
    props: { options, modelValue: "list", ...props },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

const indicator = (mounted: Wrapper) =>
  mounted.find("[data-filter-indicator]").element as HTMLElement;

const properties = (keyframes: Keyframe[]) =>
  [...new Set(keyframes.flatMap((frame) => Object.keys(frame)))].filter(
    (key) => key !== "offset",
  );

describe("AnimatedFilters", () => {
  it("sits its indicator on the picked tab", async () => {
    const mounted = await mountFilters();

    expect(indicator(mounted).style.left).toBe("4px");
    expect(indicator(mounted).style.width).toBe("80px");
    expect(indicator(mounted).style.opacity).toBe("1");
  });

  it("moves it with a transform, over a layout that has already landed", async () => {
    const mounted = await mountFilters();

    await mounted.setProps({ modelValue: "plan" });
    await flushPromises();

    expect(indicator(mounted).style.left).toBe("184px");
    expect(played).toHaveLength(1);
    expect(played[0].element).toBe(indicator(mounted));
    expect(properties(played[0].keyframes)).toEqual(["transform"]);
    expect(played[0].keyframes[0].transform).toBe(
      "translate(-180px, 0px) scale(1, 1)",
    );
    expect(played[0].keyframes[1].transform).toBe("none");
  });

  it("never eases its place through layout or its glow through paint", async () => {
    const mounted = await mountFilters();
    await mounted.setProps({ modelValue: "meta" });
    await flushPromises();

    const classes = indicator(mounted).className;
    expect(classes).not.toContain("transition");
    for (const move of played) {
      for (const property of properties(move.keyframes)) {
        expect(["transform", "opacity"]).toContain(property);
      }
    }
  });

  it("holds still for someone who asked for less motion", async () => {
    reduced = true;
    const mounted = await mountFilters();

    await mounted.setProps({ modelValue: "plan" });
    await flushPromises();

    expect(indicator(mounted).style.left).toBe("184px");
    expect(played).toHaveLength(0);
  });

  it("is put back on its tab when the strip or a tab changes size", async () => {
    const mounted = await mountFilters({ modelValue: "plan" });
    expect(indicator(mounted).style.left).toBe("184px");
    expect(indicator(mounted).style.width).toBe("80px");

    // A count gains a digit, the window narrows: every tab is 60 wide now.
    tabWidth = 60;
    resized();

    expect(indicator(mounted).style.left).toBe("144px");
    expect(indicator(mounted).style.width).toBe("60px");
    // Placed, not animated: nothing asked for the tab to change.
    expect(played).toHaveLength(0);
    // It hears of the strip's size and of each tab's, which is what a count
    // changing width inside a full-width strip takes.
    expect(observed).toHaveLength(4);
    expect(observed[0]).toBe(mounted.element);
  });

  it("keeps the square variant's box, and its API", async () => {
    const mounted = await mountFilters({ square: true });
    const first = mounted.find("button");

    expect(first.classes()).toContain("h-[1.375rem]");
    expect(first.text()).toBe("Lineups");

    await mounted.findAll("button")[1].trigger("click");
    expect(mounted.emitted("update:modelValue")).toEqual([["meta"]]);
  });

  it("plays the collapsing strip's swap as transforms and fades too", async () => {
    const mounted = await mountFilters({ collapse: true, block: true });

    await mounted.setProps({ modelValue: "meta" });
    await flushPromises();

    expect(played.length).toBeGreaterThan(0);
    for (const move of played) {
      for (const property of properties(move.keyframes)) {
        expect(["transform", "opacity"]).toContain(property);
      }
    }
  });
});
