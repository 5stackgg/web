import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MessageRequestsRailButton from "~/components/hub/MessageRequestsRailButton.vue";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | null = null;

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

async function badgeFor(count: number) {
  wrapper = await mountSuspended(MessageRequestsRailButton, {
    props: { count },
  });
  return wrapper.find("button > span:last-child").text();
}

describe("MessageRequestsRailButton badge", () => {
  it("counts up to 100 in full, like every other badge", async () => {
    expect(await badgeFor(99)).toBe("99");
    wrapper!.unmount();
    expect(await badgeFor(100)).toBe("100");
  });

  it("caps at 100+", async () => {
    expect(await badgeFor(101)).toBe("100+");
    wrapper!.unmount();
    expect(await badgeFor(4000)).toBe("100+");
  });

  it("stays amber, since a request isn't owed an answer", async () => {
    await badgeFor(3);

    const badge = wrapper!.find("button > span:last-child");
    expect(badge.classes()).toContain("bg-[hsl(var(--tac-amber))]");
    expect(badge.classes()).not.toContain("bg-red-500");
  });
});
