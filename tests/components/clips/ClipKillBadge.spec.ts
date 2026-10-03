import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import type { DOMWrapper } from "@vue/test-utils";
import ClipKillBadge from "~/components/clips/ClipKillBadge.vue";

const marks = (
  wrapper: Awaited<ReturnType<typeof mountSuspended>>,
): DOMWrapper<Element>[] => wrapper.findAll("span[aria-hidden='true']");

describe("ClipKillBadge", () => {
  it("lights all five marks for an ace", async () => {
    const wrapper = await mountSuspended(ClipKillBadge, {
      props: { kills: 5, round: 22 },
    });
    expect(marks(wrapper)).toHaveLength(5);
    expect(
      marks(wrapper).filter((m) =>
        m.classes().includes("bg-[hsl(var(--tac-amber))]"),
      ),
    ).toHaveLength(5);
    expect(wrapper.text()).toContain("Ace");
  });

  it("lights N of five for a multi-kill round", async () => {
    const wrapper = await mountSuspended(ClipKillBadge, {
      props: { kills: 3, round: 7 },
    });
    expect(
      marks(wrapper).filter((m) =>
        m.classes().includes("bg-[hsl(var(--tac-amber))]"),
      ),
    ).toHaveLength(3);
    expect(wrapper.text()).toContain("3K");
  });

  it("shows a plain total for a multi-round clip", async () => {
    const wrapper = await mountSuspended(ClipKillBadge, {
      props: { kills: 12, round: null },
    });
    expect(marks(wrapper)).toHaveLength(0);
    expect(wrapper.text()).toContain("12 kills");
  });

  it("renders nothing without kills", async () => {
    const wrapper = await mountSuspended(ClipKillBadge, {
      props: { kills: 0, round: 3 },
    });
    expect(wrapper.text()).toBe("");
  });

  it("matches the tile's chip heights", async () => {
    const sm = await mountSuspended(ClipKillBadge, {
      props: { kills: 4, round: 2 },
    });
    const lg = await mountSuspended(ClipKillBadge, {
      props: { kills: 4, round: 2, size: "lg" },
    });
    expect(sm.find("span").classes()).toContain("h-[26px]");
    expect(lg.find("span").classes()).toContain("sm:h-9");
  });
});
