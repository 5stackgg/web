import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityLineupStills from "~/components/utility/UtilityLineupStills.vue";

const STILLS = {
  landing: "https://cdn.test/landing.webp",
  aim_close: "https://cdn.test/aim_close.webp",
  aim_pin: "https://cdn.test/aim_pin.webp",
  aim: "https://cdn.test/aim.webp",
  stance_eyes: "https://cdn.test/stance_eyes.jpg",
  stance: "https://cdn.test/stance.jpg",
};

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

const stage = (wrapper: Wrapper) => wrapper.find("[role=group]");
const shownImage = (wrapper: Wrapper) => stage(wrapper).find("img");
const shownSrc = (wrapper: Wrapper) => shownImage(wrapper).attributes("src");
const caption = (wrapper: Wrapper) =>
  stage(wrapper)
    .findAll(".bg-gradient-to-t span")
    .map((span) => span.text())
    .join(" ");
const zoomControls = (wrapper: Wrapper) =>
  stage(wrapper).find("button[aria-label='Zoom In']");
const stepper = (wrapper: Wrapper, side: "previous" | "next") =>
  wrapper.findAll("section > div:last-child > button")[
    side === "previous" ? 0 : 1
  ];

async function mount(stills: Record<string, string> = STILLS) {
  return await mountSuspended(UtilityLineupStills, {
    props: { stills },
    attachTo: document.body,
  });
}

describe("UtilityLineupStills", () => {
  it("opens on the aim close-up, cropped in on the crosshair", async () => {
    const wrapper = await mount();

    expect(shownSrc(wrapper)).toBe(STILLS.aim_close);
    expect(caption(wrapper)).toBe("Aim close-up 5 / 6");
    expect(shownImage(wrapper).attributes("style")).toContain("scale(1.8)");
  });

  it("puts nothing on the still but its caption, and the steps beside the rail", async () => {
    const wrapper = await mount();

    expect(
      stage(wrapper)
        .findAll("button")
        .filter((button) => button.text().length > 0),
    ).toHaveLength(0);
    expect(stepper(wrapper, "previous").attributes("aria-label")).toBe(
      "View Lineup",
    );
    expect(stepper(wrapper, "next").attributes("aria-label")).toBe(
      "View Where it lands",
    );

    await stepper(wrapper, "next").trigger("click");
    expect(shownSrc(wrapper)).toBe(STILLS.landing);
    expect(caption(wrapper)).toBe("Where it lands 6 / 6");
    expect(stepper(wrapper, "next").attributes("disabled")).toBeDefined();
  });

  it("names each rail segment for its tooltip and switches on a press", async () => {
    const wrapper = await mount();
    const tabs = wrapper.findAll("[role=tab]");

    expect(tabs.map((tab) => tab.attributes("aria-label"))).toEqual([
      "Where to stand",
      "From the spot",
      "Aim",
      "Lineup",
      "Aim close-up",
      "Where it lands",
    ]);
    expect(tabs[0].classes()).toContain("h-6");

    await tabs[0].trigger("click");
    expect(shownSrc(wrapper)).toBe(STILLS.stance);
    expect(
      wrapper
        .findAll("[role=tab]")
        .map((tab) => tab.attributes("aria-selected")),
    ).toEqual(["true", "false", "false", "false", "false", "false"]);
  });

  it("zooms only the two crosshair shots", async () => {
    const wrapper = await mount();
    expect(zoomControls(wrapper).exists()).toBe(true);

    await stage(wrapper).trigger("keydown", { key: "ArrowLeft" });
    expect(shownSrc(wrapper)).toBe(STILLS.aim_pin);
    expect(zoomControls(wrapper).exists()).toBe(true);

    await stage(wrapper).trigger("keydown", { key: "ArrowLeft" });
    expect(shownSrc(wrapper)).toBe(STILLS.aim);
    expect(zoomControls(wrapper).exists()).toBe(false);
    expect(shownImage(wrapper).attributes("style")).toContain("scale(1)");
  });

  it("zooms from the keyboard and goes back to the crop on reset", async () => {
    const wrapper = await mount();

    await stage(wrapper).trigger("keydown", { key: "+" });
    expect(shownImage(wrapper).attributes("style")).toContain("scale(2.7");

    await stage(wrapper).trigger("keydown", { key: "0" });
    expect(shownImage(wrapper).attributes("style")).toContain("scale(1.8)");
  });

  it("stays a single still in the panel", async () => {
    const wrapper = await mount();

    expect(wrapper.find("[data-still-result]").exists()).toBe(false);
  });

  it("does not open anything when the still is clicked", async () => {
    const wrapper = await mount();

    await shownImage(wrapper).trigger("click");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("leads with the lineup shot, then the aim, when a render has no close-up", async () => {
    const { aim_close: _close, ...noClose } = STILLS;
    const pin = await mount(noClose);
    expect(shownSrc(pin)).toBe(STILLS.aim_pin);

    const aim = await mount({ stance: STILLS.stance, aim: STILLS.aim });
    expect(shownSrc(aim)).toBe(STILLS.aim);
  });
});

// The same viewer on a screen that is touched: no hover to read a name from,
// nothing 6px tall to hit.
describe("UtilityLineupStills under a finger", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  async function mountTouch(stills: Record<string, string> = STILLS) {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query.includes("coarse"),
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    const wrapper = await mount(stills);
    await flushPromises();
    return wrapper;
  }

  const tabs = (wrapper: Wrapper) => wrapper.findAll("[data-still-tab]");
  const active = (wrapper: Wrapper) =>
    tabs(wrapper)
      .filter((tab) => tab.attributes("aria-selected") === "true")
      .map((tab) => tab.text());

  function swipe(wrapper: Wrapper, dx: number, dy = 0, ms = 160) {
    const target = stage(wrapper).element;
    const at = (type: string, x: number, y: number, timeStamp: number) => {
      const event = new PointerEvent(type, {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        clientX: x,
        clientY: y,
        bubbles: true,
      });
      Object.defineProperty(event, "timeStamp", { value: timeStamp });
      target.dispatchEvent(event);
    };
    at("pointerdown", 200, 100, 1000);
    at("pointerup", 200 + dx, 100 + dy, 1000 + ms);
  }

  it("names every still on a button big enough to press", async () => {
    const wrapper = await mountTouch();

    expect(tabs(wrapper).map((tab) => tab.text())).toEqual([
      "Where to stand",
      "From the spot",
      "Aim",
      "Lineup",
      "Aim close-up",
      "Where it lands",
    ]);
    for (const tab of tabs(wrapper)) {
      expect(tab.classes()).toContain("min-h-11");
      expect(tab.classes()).not.toContain("truncate");
    }
    // Three across, so six are two rows and each name has a third of the
    // width to itself.
    expect(
      (tabs(wrapper)[0].element.parentElement as HTMLElement).style
        .gridTemplateColumns,
    ).toBe("repeat(3, minmax(0, 1fr))");
    // The pointer's rail and its steppers are not drawn as well.
    expect(wrapper.findAll("[role=tab]")).toHaveLength(6);
    expect(wrapper.find("button[aria-label='Previous']").exists()).toBe(false);
  });

  it("says which one is showing, and switches on a press", async () => {
    const wrapper = await mountTouch();
    expect(active(wrapper)).toEqual(["Aim close-up"]);

    await tabs(wrapper)[0].trigger("click");
    expect(active(wrapper)).toEqual(["Where to stand"]);
    expect(shownSrc(wrapper)).toBe(STILLS.stance);
  });

  it("puts nothing over the picture, so the crosshair is never covered", async () => {
    const wrapper = await mountTouch();

    expect(stage(wrapper).find(".bg-gradient-to-t").exists()).toBe(false);
    // What is left on it is the zoom, in its corner.
    const overlays = stage(wrapper)
      .findAll(".absolute")
      .filter((element) => element.element.tagName !== "IMG");
    expect(overlays).toHaveLength(1);
    expect(overlays[0].classes()).toEqual(
      expect.arrayContaining(["right-2", "top-2"]),
    );
  });

  it("steps through the stills on a swipe across the picture", async () => {
    const wrapper = await mountTouch();
    await tabs(wrapper)[2].trigger("click");
    expect(active(wrapper)).toEqual(["Aim"]);

    swipe(wrapper, -90);
    await flushPromises();
    expect(active(wrapper)).toEqual(["Lineup"]);

    swipe(wrapper, 90);
    await flushPromises();
    expect(active(wrapper)).toEqual(["Aim"]);

    // Up and down is the page's, and a nudge is not a swipe.
    swipe(wrapper, -20, 90);
    swipe(wrapper, -12);
    await flushPromises();
    expect(active(wrapper)).toEqual(["Aim"]);
  });

  it("stops at either end instead of wrapping round", async () => {
    const wrapper = await mountTouch();
    await tabs(wrapper)[5].trigger("click");

    swipe(wrapper, -90);
    await flushPromises();
    expect(active(wrapper)).toEqual(["Where it lands"]);
  });

  it("leaves a zoomed-in still to be moved about rather than passed", async () => {
    const wrapper = await mountTouch();
    expect(active(wrapper)).toEqual(["Aim close-up"]);
    await zoomControls(wrapper).trigger("click");

    swipe(wrapper, -90);
    await flushPromises();
    expect(active(wrapper)).toEqual(["Aim close-up"]);
  });
});
