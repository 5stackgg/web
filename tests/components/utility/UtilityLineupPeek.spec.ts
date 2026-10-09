import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityLineupPeek from "~/components/utility/UtilityLineupPeek.vue";
import UtilityThrowStrip from "~/components/utility/UtilityThrowStrip.vue";
import type { UtilityLineup } from "~/types/utility";

const lineup = {
  id: "l-1",
  name: "Window smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  preview_url: "https://cf.test/clips/utility/l-1/r.mp4",
  preview_stills_url: {
    stance: "https://cdn.test/stance.jpg",
    aim_pin: "https://cdn.test/aim_pin.jpg",
    aim_close: "https://cdn.test/aim_close.jpg",
  },
} as unknown as UtilityLineup;

describe("UtilityLineupPeek", () => {
  it("leads with the aim close-up and never plays the clip", async () => {
    const wrapper = await mountSuspended(UtilityLineupPeek, {
      props: { lineup },
    });

    expect(wrapper.find("[role=group] img").attributes("src")).toBe(
      "https://cdn.test/aim_close.jpg",
    );
    expect(wrapper.find("video").exists()).toBe(false);
  });

  it("lets the pointer hop to where to stand", async () => {
    const wrapper = await mountSuspended(UtilityLineupPeek, {
      props: { lineup },
    });

    await wrapper.findAll("[role=tab]")[0].trigger("click");
    expect(wrapper.find("[role=group] img").attributes("src")).toBe(
      "https://cdn.test/stance.jpg",
    );
  });

  it("shows how to throw it as one strip, with the mouse but no words for it", async () => {
    const wrapper = await mountSuspended(UtilityLineupPeek, {
      props: { lineup },
    });

    expect(wrapper.findComponent(UtilityThrowStrip).exists()).toBe(true);
    expect(wrapper.find("svg[role=img]").attributes("aria-label")).toBe(
      "Left click",
    );
    expect(wrapper.text()).not.toMatch(/LMB|Left click/);
  });

  it("stacks what the throw lands as under the crosshair still", async () => {
    const wrapper = await mountSuspended(UtilityLineupPeek, {
      props: {
        lineup: {
          ...lineup,
          preview_stills_url: {
            ...lineup.preview_stills_url,
            landing: "https://cdn.test/landing.jpg",
          },
        } as UtilityLineup,
      },
    });

    expect(wrapper.find("[role=group] img").attributes("src")).toBe(
      "https://cdn.test/aim_close.jpg",
    );
    const landing = wrapper.find("[data-still-result]");
    expect(landing.find("img").attributes("src")).toBe(
      "https://cdn.test/landing.jpg",
    );
    expect(landing.text()).toBe("Where it lands");
    expect(landing.classes()).toContain("aspect-[2/1]");
    expect(wrapper.find("[role=group] [data-still-result]").exists()).toBe(
      false,
    );
  });

  it("drops the second picture once the landing itself is the still on top", async () => {
    const wrapper = await mountSuspended(UtilityLineupPeek, {
      props: {
        lineup: {
          ...lineup,
          preview_stills_url: {
            ...lineup.preview_stills_url,
            landing: "https://cdn.test/landing.jpg",
          },
        } as UtilityLineup,
      },
    });

    await wrapper.findAll("[role=tab]").at(-1)!.trigger("click");

    expect(wrapper.find("[role=group] img").attributes("src")).toBe(
      "https://cdn.test/landing.jpg",
    );
    expect(wrapper.find("[data-still-result]").exists()).toBe(false);
  });

  it("has no second picture for a lineup with no landing still", async () => {
    const wrapper = await mountSuspended(UtilityLineupPeek, {
      props: { lineup },
    });

    expect(wrapper.find("[data-still-result]").exists()).toBe(false);
  });
});
