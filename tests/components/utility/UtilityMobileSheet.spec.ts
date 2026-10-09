import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityMobileSheet from "~/components/utility/UtilityMobileSheet.vue";
import { escapeTaken } from "~/utilities/escapeKey";

const back = vi.hoisted(() => ({
  isOpen: (() => false) as () => boolean,
  close: (() => {}) as () => void,
  id: undefined as string | undefined,
  reopen: (() => {}) as () => void,
}));
vi.mock("~/composables/useBackDismiss", () => ({
  useBackDismiss: (
    isOpen: () => boolean,
    close: () => void,
    options: { id?: string; reopen?: () => void },
  ) => {
    back.isOpen = isOpen;
    back.close = close;
    back.id = options.id;
    back.reopen = options.reopen ?? (() => {});
  },
}));

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
type SheetApi = {
  hold: () => void;
  release: () => void;
  snap: () => "full" | "half" | "peek";
};

// An 800px window: full is 728 and half is 320, so half sits 408 down; the
// peek is the handle and a strip, 88 in all, which is 640 down.
const HALF = 408;
const PEEK = 640;
const mounted: Wrapper[] = [];

// The drawer times a drag and its settle off the clock, half a second at a
// time. The clock here is the test's to wind on, or this file alone would
// take most of a minute.
const sleep = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  Object.defineProperty(window, "innerHeight", {
    value: 800,
    configurable: true,
  });
  vi.stubGlobal(
    "matchMedia",
    () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  );
  // Nothing is laid out here. The drawer reads where it is off its computed
  // transform, which a browser reports as a matrix, and how tall it is off
  // its box.
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (element: Element, pseudo?: string | null) => {
      const style = computed(element, pseudo);
      if (!(element as HTMLElement).hasAttribute?.("data-vaul-drawer")) {
        return style;
      }
      const drawn = /translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(
        (element as HTMLElement).style.transform,
      );
      return new Proxy(style, {
        get: (target, key) =>
          key === "transform"
            ? drawn
              ? `matrix(1, 0, 0, 1, 0, ${drawn[1]})`
              : "none"
            : Reflect.get(target, key),
      });
    },
  );
});

afterEach(() => {
  pointerType = "touch";
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function mountSheet(peek = true) {
  const wrapper = await mountSuspended(UtilityMobileSheet, {
    props: { enabled: true },
    slots: {
      default: () =>
        h("div", { class: "list", style: "overflow-y:auto;height:100%" }, [
          h("p", { class: "row" }, "A lineup"),
          h("div", { class: "still", "data-no-sheet-drag": "" }, "still"),
        ]),
      ...(peek
        ? {
            peek: () => [
              h("button", { class: "type", type: "button" }, "Smoke"),
              h("button", { class: "type", type: "button" }, "Flash"),
            ],
          }
        : {}),
    },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  await flushPromises();
  sheet().getBoundingClientRect = () =>
    ({ height: 728, width: 390, top: 72, left: 0 }) as DOMRect;
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  // The drawer does not take a drag in its first half second.
  await sleep(560);
  return wrapper;
}

const sheet = () =>
  document.querySelector("[data-utility-sheet]") as HTMLElement;
const handle = () =>
  sheet().querySelector("[data-sheet-handle]") as HTMLElement;
const strip = () =>
  document.querySelector("[data-sheet-peek]") as HTMLElement;
const card = () => document.querySelector(".list")!.parentElement!;
const api = (wrapper: Wrapper) => wrapper.vm as unknown as SheetApi;

// The drawer animates to a snap point over half a second, and for that long
// after reaching fully open it does not take a drag.
const settled = () => sleep(620);

function offsetOf() {
  const match = /translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(
    sheet().style.transform,
  );
  return match ? Number(match[1]) : null;
}

let pointerType = "touch";

function pointer(target: Element, type: string, y: number, x = 100, id = 1) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: id,
      pointerType,
      isPrimary: id === 1,
      clientX: x,
      clientY: y,
      button: 0,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function touchMove(target: Element, y: number, x = 100) {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: [{ identifier: 1, clientX: x, clientY: y }],
  });
  target.dispatchEvent(event);
  return event;
}

// A drag by `by` px from `from`, held for `ms` before it is let go: slow
// enough and the drawer goes by where it was dropped, quick and it is a
// flick.
async function drag(target: Element, from: number, by: number, ms: number) {
  pointer(target, "pointerdown", from);
  pointer(target, "pointermove", from + Math.sign(by) * 10);
  pointer(target, "pointermove", from + by);
  await sleep(ms);
  pointer(target, "pointerup", from + by);
  await settled();
}

const SLOW = 900;
const FLICK = 70;

// A press some while after whatever came before it. An event carries the
// real clock's time, which the wound-on one does not move, and a click that
// lands in the same instant as the end of a drag is taken for the drag's own.
function pressLater(target: Element) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "timeStamp", {
    value: performance.now() + 1000,
  });
  target.dispatchEvent(event);
}

describe("UtilityMobileSheet on the shared drawer", () => {
  it("is the app's Drawer, with the three places as its snap points", async () => {
    await mountSheet();

    expect(sheet().hasAttribute("data-vaul-drawer")).toBe(true);
    expect(sheet().getAttribute("data-vaul-snap-points")).toBe("true");
    expect(sheet().getAttribute("data-state")).toBe("open");
    // Part of the page: nothing dims behind it and it is not a dialog.
    expect(document.querySelector("[data-vaul-overlay]")).toBeNull();
    expect(sheet().getAttribute("role")).toBe("region");
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });

  it("rests at half, with the card as tall as what is on screen", async () => {
    const wrapper = await mountSheet();

    expect(api(wrapper).snap()).toBe("half");
    expect(sheet().style.height).toBe("728px");
    expect(offsetOf()).toBe(HALF);
    expect(card().style.height).toBe(`${320 - 28}px`);
  });

  it("cannot be dismissed: not by Escape, a press outside or focus leaving", async () => {
    const wrapper = await mountSheet();
    const outside = document.createElement("button");
    document.body.appendChild(outside);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    outside.focus();
    outside.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await settled();

    expect(sheet().getAttribute("data-state")).toBe("open");
    expect(api(wrapper).snap()).toBe("half");
    expect(offsetOf()).toBe(HALF);
  });

  it("follows a finger on its content, through the drawer", async () => {
    await mountSheet();
    const row = document.querySelector(".row")!;

    pointer(row, "pointerdown", 600);
    pointer(row, "pointermove", 590);
    const refused = touchMove(row, 590);
    pointer(row, "pointermove", 500);
    await flushPromises();

    expect(offsetOf()).toBe(HALF - 100);
    expect(refused.defaultPrevented).toBe(true);
    expect(card().style.height).toBe(`${728 - 28}px`);
  });

  it("settles on full when dropped past halfway, and stays when not", async () => {
    const wrapper = await mountSheet();
    const row = document.querySelector(".row")!;

    await drag(row, 600, -270, SLOW);
    expect(api(wrapper).snap()).toBe("full");
    expect(offsetOf()).toBe(0);
    expect(card().style.height).toBe(`${728 - 28}px`);
    expect(back.isOpen()).toBe(true);

    await drag(handle(), 90, 60, SLOW);
    expect(api(wrapper).snap()).toBe("full");
    expect(offsetOf()).toBe(0);
  });

  it("lets a scrolled list scroll, and takes a pull down from its top", async () => {
    const wrapper = await mountSheet();
    api(wrapper).hold();
    await settled();
    const list = document.querySelector(".list") as HTMLElement;
    const row = document.querySelector(".row")!;
    Object.defineProperty(list, "scrollHeight", { value: 2000 });
    Object.defineProperty(list, "clientHeight", { value: 600 });
    list.scrollTop = 120;

    pointer(row, "pointerdown", 300);
    pointer(row, "pointermove", 340);
    const scrolling = touchMove(row, 340);
    pointer(row, "pointermove", 400);
    expect(scrolling.defaultPrevented).toBe(false);
    expect(offsetOf()).toBe(0);
    // The browser takes the press once it is scrolling.
    pointer(row, "pointercancel", 400);
    await settled();
    expect(api(wrapper).snap()).toBe("full");

    list.scrollTop = 0;
    pointer(row, "pointerdown", 300);
    pointer(row, "pointermove", 310);
    const pulling = touchMove(row, 310);
    pointer(row, "pointermove", 360);
    expect(pulling.defaultPrevented).toBe(true);
    expect(offsetOf()).toBe(60);
    pointer(row, "pointerup", 360);
    await settled();
  });

  it("tells the browser which scrolls are its own, ahead of the touch", async () => {
    const wrapper = await mountSheet();
    const list = document.querySelector(".list") as HTMLElement;
    list.classList.add("overflow-y-auto");
    Object.defineProperty(list, "scrollHeight", { value: 2000 });
    Object.defineProperty(list, "clientHeight", { value: 600 });

    // Below fully open nothing inside scrolls, so nothing inside pans.
    expect(card().className).toContain("[&_*]:!touch-none");

    api(wrapper).hold();
    await settled();
    expect(card().className).not.toContain("touch-none");
    // At its top a list scrolls one way only; the pull down is the sheet's.
    expect(list.style.touchAction).toBe("pan-x pan-down");

    list.scrollTop = 120;
    list.dispatchEvent(new Event("scroll"));
    expect(list.style.touchAction).toBe("");

    list.scrollTop = 0;
    list.dispatchEvent(new Event("scroll"));
    expect(list.style.touchAction).toBe("pan-x pan-down");
  });

  it("leaves a tap, a sideways drag and its own draggable things alone", async () => {
    await mountSheet();
    const row = document.querySelector(".row")!;

    pointer(row, "pointerdown", 600);
    pointer(row, "pointermove", 602);
    pointer(row, "pointerup", 602);
    expect(offsetOf()).toBe(HALF);

    pointer(row, "pointerdown", 600, 100);
    pointer(row, "pointermove", 604, 160);
    pointer(row, "pointermove", 500, 200);
    expect(offsetOf()).toBe(HALF);
    pointer(row, "pointerup", 500, 200);

    const still = document.querySelector(".still")!;
    pointer(still, "pointerdown", 600);
    pointer(still, "pointermove", 480);
    expect(offsetOf()).toBe(HALF);
    pointer(still, "pointerup", 480);
    await settled();
    expect(offsetOf()).toBe(HALF);
  });

  it("does not take the end of a drag for a press on what it ended over", async () => {
    await mountSheet();
    const row = document.querySelector(".row")!;
    const pressed = vi.fn();
    row.addEventListener("click", pressed);

    // With a mouse a drag ends on what it began on, which makes a click.
    await drag(row, 600, -270, SLOW);
    row.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(pressed).not.toHaveBeenCalled();

    pressLater(row);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it("finishes a drag the browser took the press away from", async () => {
    const wrapper = await mountSheet();

    pointer(handle(), "pointerdown", 500);
    pointer(handle(), "pointermove", 510);
    pointer(handle(), "pointermove", 730);
    await sleep(SLOW);
    pointer(handle(), "pointercancel", 730);
    await settled();

    expect(api(wrapper).snap()).toBe("peek");
    expect(offsetOf()).toBe(PEEK);
  });

  it("moves from the handle on a tap, and comes down when Back says so", async () => {
    const wrapper = await mountSheet();

    handle().click();
    await settled();
    expect(api(wrapper).snap()).toBe("full");
    expect(offsetOf()).toBe(0);
    expect(handle().getAttribute("aria-expanded")).toBe("true");
    expect(back.isOpen()).toBe(true);

    back.close();
    await settled();
    expect(api(wrapper).snap()).toBe("half");
    expect(offsetOf()).toBe(HALF);
    expect(back.isOpen()).toBe(false);
  });

  it("does not call a raise by the page one Back should undo", async () => {
    const wrapper = await mountSheet();

    api(wrapper).hold();
    await settled();

    expect(api(wrapper).snap()).toBe("full");
    expect(offsetOf()).toBe(0);
    expect(back.isOpen()).toBe(false);
  });
});

describe("UtilityMobileSheet and the keyboard", () => {
  // A drawer that cannot be dismissed cancels every Escape it hears, and it
  // hears it before anything on the page.
  it("leaves Escape free for whatever is open on the page", async () => {
    await mountSheet();
    const heard: KeyboardEvent[] = [];
    const later = (event: KeyboardEvent) => heard.push(event);
    window.addEventListener("keydown", later);

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    window.removeEventListener("keydown", later);

    expect(heard).toHaveLength(1);
    expect(escapeTaken(heard[0])).toBe(false);
    expect(sheet().getAttribute("data-state")).toBe("open");
  });

  // A dialog's focus scope wraps Tab round its own edges. The sheet is a
  // region of the page, and Tab has to be able to walk out of it.
  it("lets Tab and Shift+Tab walk out of the sheet", async () => {
    await mountSheet();
    const press = (target: HTMLElement, shiftKey: boolean) => {
      target.focus();
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    };
    const row = document.querySelector(".row") as HTMLElement;
    row.tabIndex = 0;

    expect(press(handle(), true).defaultPrevented).toBe(false);
    expect(press(row, false).defaultPrevented).toBe(false);
  });

  it("leaves the card's text to be selected", async () => {
    await mountSheet();

    expect(card().classList.contains("select-text")).toBe(true);
  });

  it("is dragged by a mouse from the handle, and not by one selecting text", async () => {
    await mountSheet();
    pointerType = "mouse";
    const row = document.querySelector(".row")!;

    pointer(row, "pointerdown", 600);
    pointer(row, "pointermove", 590);
    pointer(row, "pointermove", 500);
    expect(offsetOf()).toBe(HALF);
    pointer(row, "pointerup", 500);

    pointer(handle(), "pointerdown", 500);
    pointer(handle(), "pointermove", 490);
    pointer(handle(), "pointermove", 400);
    expect(offsetOf()).toBe(HALF - 100);
    pointer(handle(), "pointerup", 400);
    await settled();
  });
});

describe("UtilityMobileSheet and a list at its top", () => {
  async function fullWithList() {
    const wrapper = await mountSheet();
    api(wrapper).hold();
    await settled();
    const list = document.querySelector(".list") as HTMLElement;
    Object.defineProperty(list, "scrollHeight", { value: 2000 });
    Object.defineProperty(list, "clientHeight", { value: 600 });
    return document.querySelector(".row")!;
  }

  // A browser commits to a scroll on the first move it is not refused. Six
  // px later is too late: the press is taken away and the sheet snaps back.
  it("takes a pull down on the very first move, before the browser scrolls", async () => {
    const row = await fullWithList();

    pointer(row, "pointerdown", 300);
    const first = touchMove(row, 302);

    expect(first.defaultPrevented).toBe(true);
    pointer(row, "pointerup", 302);
    await settled();
  });

  it("still waits to see which way a sideways or upward first move is going", async () => {
    const row = await fullWithList();

    pointer(row, "pointerdown", 300);
    expect(touchMove(row, 298).defaultPrevented).toBe(false);
    pointer(row, "pointerup", 298);

    pointer(row, "pointerdown", 300);
    expect(touchMove(row, 301, 104).defaultPrevented).toBe(false);
    pointer(row, "pointerup", 301, 104);
    await settled();
  });

  it("does not take a press that shook by a pixel for a drag", async () => {
    const row = await fullWithList();
    const pressed = vi.fn();
    row.addEventListener("click", pressed);

    pointer(row, "pointerdown", 300);
    touchMove(row, 302);
    pointer(row, "pointermove", 302);
    pointer(row, "pointerup", 302);
    row.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(pressed).toHaveBeenCalledTimes(1);
    await settled();
  });
});

describe("UtilityMobileSheet and Forward", () => {
  it("can be put back at full by the history it made a step in", async () => {
    const wrapper = await mountSheet();
    expect(back.id).toBe("utility-sheet");

    back.reopen();
    await settled();
    expect(api(wrapper).snap()).toBe("full");
    expect(back.isOpen()).toBe(true);

    back.close();
    await settled();
    expect(api(wrapper).snap()).toBe("half");
  });
});

describe("UtilityMobileSheet at the peek", () => {
  it("goes down to a strip on a swipe down from half, and no further", async () => {
    const wrapper = await mountSheet();

    await drag(handle(), 500, 200, SLOW);
    expect(api(wrapper).snap()).toBe("peek");
    expect(offsetOf()).toBe(PEEK);
    expect(card().style.height).toBe(`${88 - 28}px`);
    expect(back.isOpen()).toBe(false);

    pointer(handle(), "pointerdown", 730);
    pointer(handle(), "pointermove", 740);
    pointer(handle(), "pointermove", 790);
    expect(offsetOf()).toBe(PEEK);
    await sleep(FLICK);
    pointer(handle(), "pointerup", 790);
    await settled();
    expect(api(wrapper).snap()).toBe("peek");
    expect(offsetOf()).toBe(PEEK);
  });

  it("shows only the strip there, and it can still be pressed", async () => {
    await mountSheet();
    const pressed = vi.fn();
    strip().querySelector(".type")!.addEventListener("click", pressed);

    expect(strip().style.opacity).toBe("0");
    expect(strip().hasAttribute("inert")).toBe(true);
    expect(card().hasAttribute("inert")).toBe(false);

    await drag(handle(), 500, 200, SLOW);
    expect(strip().style.opacity).toBe("1");
    expect(strip().hasAttribute("inert")).toBe(false);
    expect(strip().querySelectorAll("button")).toHaveLength(2);
    expect(card().style.opacity).toBe("0");
    expect(card().hasAttribute("inert")).toBe(true);
    expect(card().classList.contains("invisible")).toBe(true);

    pressLater(strip().querySelector(".type")!);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it("fades the strip in with the sheet on the way down", async () => {
    await mountSheet();

    pointer(handle(), "pointerdown", 500);
    pointer(handle(), "pointermove", 510);
    pointer(handle(), "pointermove", 616);
    await flushPromises();
    expect(offsetOf()).toBe((HALF + PEEK) / 2);
    expect(Number(strip().style.opacity)).toBeCloseTo(0.5);
    expect(Number(card().style.opacity)).toBeCloseTo(0.5);
    pointer(handle(), "pointerup", 616);
    await settled();
  });

  it("steps one place at a time on a flick, in the direction it was thrown", async () => {
    const wrapper = await mountSheet();

    await drag(handle(), 500, 40, FLICK);
    expect(api(wrapper).snap()).toBe("peek");

    await drag(handle(), 730, -40, FLICK);
    expect(api(wrapper).snap()).toBe("half");

    await drag(handle(), 500, -40, FLICK);
    expect(api(wrapper).snap()).toBe("full");
    expect(back.isOpen()).toBe(true);

    await drag(handle(), 90, 40, FLICK);
    expect(api(wrapper).snap()).toBe("half");
    expect(back.isOpen()).toBe(false);
  });

  it("comes back up to the list on a tap of the handle", async () => {
    const wrapper = await mountSheet();
    await drag(handle(), 500, 200, SLOW);

    pressLater(handle());
    await settled();
    expect(api(wrapper).snap()).toBe("half");
    expect(back.isOpen()).toBe(false);
  });

  it("rises for the page from the peek and goes back down to it after", async () => {
    const wrapper = await mountSheet();
    await drag(handle(), 500, 200, SLOW);

    api(wrapper).hold();
    await settled();
    expect(api(wrapper).snap()).toBe("full");
    expect(offsetOf()).toBe(0);
    expect(back.isOpen()).toBe(false);

    api(wrapper).release();
    await settled();
    expect(api(wrapper).snap()).toBe("peek");
    expect(offsetOf()).toBe(PEEK);
  });

  it("stays where a hand had raised it when the page lets go", async () => {
    const wrapper = await mountSheet();
    handle().click();
    await settled();
    expect(back.isOpen()).toBe(true);

    api(wrapper).hold();
    await settled();
    api(wrapper).release();
    await settled();
    expect(api(wrapper).snap()).toBe("full");
    expect(back.isOpen()).toBe(true);
  });

  it("keeps the step a hand made, and its height, through a lineup lowered by hand", async () => {
    const wrapper = await mountSheet();
    handle().click();
    await settled();
    api(wrapper).hold();
    await settled();

    // Lowered to look at the map while the lineup is open: the step made
    // before it is under the lineup's, so it cannot be taken back out now.
    await drag(handle(), 90, 300, SLOW);
    expect(api(wrapper).snap()).toBe("half");
    expect(back.isOpen()).toBe(true);

    // Back closes the lineup onto the list as it was, at full; the next one
    // lowers the sheet. Neither lands on something that looks the same.
    api(wrapper).release();
    await settled();
    expect(api(wrapper).snap()).toBe("full");

    back.close();
    await settled();
    expect(api(wrapper).snap()).toBe("half");
    expect(back.isOpen()).toBe(false);
  });

  it("does not make a step for Back of a hand putting it back while the page holds it", async () => {
    const wrapper = await mountSheet();
    api(wrapper).hold();
    await settled();

    await drag(handle(), 90, 300, SLOW);
    expect(api(wrapper).snap()).toBe("half");
    await drag(handle(), 500, -300, SLOW);
    expect(api(wrapper).snap()).toBe("full");
    expect(back.isOpen()).toBe(false);
  });

  it("goes back down to where it was raised from when Back says so", async () => {
    const wrapper = await mountSheet();
    await drag(handle(), 500, 200, SLOW);
    expect(api(wrapper).snap()).toBe("peek");

    await drag(handle(), 730, -600, 1600);
    expect(api(wrapper).snap()).toBe("full");
    expect(back.isOpen()).toBe(true);

    back.close();
    await settled();
    expect(api(wrapper).snap()).toBe("peek");
  });

  it("has only half and full when there is nothing to show in a strip", async () => {
    const wrapper = await mountSheet(false);

    await drag(handle(), 500, 200, SLOW);
    expect(api(wrapper).snap()).toBe("half");
    expect(strip()).toBeNull();
  });
});
