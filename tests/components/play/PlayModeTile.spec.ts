import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import type { DOMWrapper } from "@vue/test-utils";
import PlayModeTile from "~/components/play/PlayModeTile.vue";

const competitive = {
  title: "Competitive",
  description: "The classic 5 vs 5",
  expected: 10,
  inQueue: 14,
  party: 3,
  canQueue: true,
  selected: false,
  locked: false,
};

function amberSeats(
  wrapper: Awaited<ReturnType<typeof mountSuspended>>,
): DOMWrapper<Element>[] {
  return wrapper
    .findAll("i")
    .filter((seat) => seat.classes().includes("!bg-[hsl(var(--tac-amber))]"));
}

describe("PlayModeTile", () => {
  it("shows the format and queue count, and no line when the party fits", async () => {
    const wrapper = await mountSuspended(PlayModeTile, {
      props: competitive,
    });

    expect(wrapper.text()).toContain("5v5");
    expect(wrapper.text()).toContain("14");
    expect(wrapper.text()).not.toContain("party of 3");
    expect(amberSeats(wrapper)).toHaveLength(3);
  });

  it("selects on click and marks itself checked", async () => {
    const wrapper = await mountSuspended(PlayModeTile, {
      props: { ...competitive, selected: true },
    });

    expect(wrapper.attributes("aria-checked")).toBe("true");
    await wrapper.trigger("click");
    expect(wrapper.emitted("select")).toHaveLength(1);
  });

  it("blocks a mode the party is too big for and says why", async () => {
    const wrapper = await mountSuspended(PlayModeTile, {
      props: {
        ...competitive,
        title: "Wingman",
        expected: 4,
        canQueue: false,
        selected: true,
      },
    });

    expect(wrapper.text()).toContain("A party of 3 is too big for Wingman");
    expect(wrapper.attributes("aria-checked")).toBe("false");
    expect(wrapper.attributes("aria-disabled")).toBe("true");
    expect(amberSeats(wrapper)).toHaveLength(2);
    await wrapper.trigger("click");
    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("hides counts and party fit from a guest", async () => {
    const wrapper = await mountSuspended(PlayModeTile, {
      props: { ...competitive, inQueue: null, party: 0 },
    });

    expect(wrapper.text()).not.toContain("in queue");
    expect(wrapper.text()).not.toContain("Fits your party");
    expect(amberSeats(wrapper)).toHaveLength(0);
  });

  it("doesn't let a party member change the mode", async () => {
    const wrapper = await mountSuspended(PlayModeTile, {
      props: { ...competitive, locked: true },
    });

    await wrapper.trigger("click");
    expect(wrapper.emitted("select")).toBeUndefined();
  });
});
