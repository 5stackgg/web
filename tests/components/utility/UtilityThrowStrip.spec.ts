import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityThrowStrip from "~/components/utility/UtilityThrowStrip.vue";

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

const visibleText = (wrapper: Wrapper) =>
  wrapper.text().replace(/\s+/g, " ").trim();

const lines = (wrapper: Wrapper) =>
  wrapper
    .findAll(".leading-\\[1\\.15\\] span")
    .map((line) => line.text().trim());

describe("UtilityThrowStrip", () => {
  it("is one strip: the stance, its word, and a mouse with no words", async () => {
    const wrapper = await mountSuspended(UtilityThrowStrip, {
      props: { technique: "WalkJump", strength: "Full" },
    });

    expect(lines(wrapper)).toEqual(["Walk Jump"]);
    expect(visibleText(wrapper)).not.toMatch(/LMB|Left click|Throw/);
    const mouse = wrapper.find("svg[role=img]");
    expect(mouse.attributes("aria-label")).toBe("Left click");
    expect(mouse.attributes("data-buttons")).toBe("left");
  });

  it("adds the run-up under the stance only when one was recorded", async () => {
    const bare = await mountSuspended(UtilityThrowStrip, {
      props: { technique: "RunJump", strength: "Full" },
    });
    expect(lines(bare)).toEqual(["Run Jump"]);

    const withRunUp = await mountSuspended(UtilityThrowStrip, {
      props: {
        technique: "RunJump",
        strength: "Full",
        runUp: {
          keys: ["D"],
          walk: false,
          crouch: false,
          jump: true,
          ms: 400,
          capped: false,
        },
      },
    });
    expect(lines(withRunUp)).toEqual(["Run Jump", "Hold D 0.4s first"]);
  });

  it("falls back to the technique note when there is no run-up", async () => {
    const wrapper = await mountSuspended(UtilityThrowStrip, {
      props: {
        technique: "Stationary",
        strength: "Half",
        techniqueNote: "8 of 9 throws agree",
      },
    });

    expect(lines(wrapper)).toEqual(["Standing", "8 of 9 throws agree"]);
    expect(wrapper.find("svg[role=img]").attributes("data-buttons")).toBe(
      "both",
    );
  });
});
