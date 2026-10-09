import { describe, expect, it } from "vitest";
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
