import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityThrowIcon from "~/components/utility/UtilityThrowIcon.vue";

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

const lit = (wrapper: Wrapper) =>
  ["left", "right", "wheel"].filter((part) =>
    wrapper
      .find(`[data-part=${part}]`)
      .classes()
      .includes("fill-[hsl(var(--tac-amber))]"),
  );

describe("UtilityThrowIcon", () => {
  it("lights the buttons a throw's strength presses, never the wheel", async () => {
    const full = await mountSuspended(UtilityThrowIcon, {
      props: { strength: "Full" },
    });
    const half = await mountSuspended(UtilityThrowIcon, {
      props: { strength: "Half" },
    });

    expect(lit(full)).toEqual(["left"]);
    expect(lit(half)).toEqual(["left", "right"]);
  });

  it("lights only the wheel for a middle-click throw", async () => {
    const wrapper = await mountSuspended(UtilityThrowIcon, {
      props: { buttons: "middle", label: "Middle click" },
    });

    expect(lit(wrapper)).toEqual(["wheel"]);
    expect(wrapper.attributes("role")).toBe("img");
    expect(wrapper.attributes("aria-label")).toBe("Middle click");
  });

  it("stays out of the accessibility tree without a label", async () => {
    const wrapper = await mountSuspended(UtilityThrowIcon, {
      props: { strength: "Full" },
    });

    expect(wrapper.attributes("aria-hidden")).toBe("true");
  });
});
