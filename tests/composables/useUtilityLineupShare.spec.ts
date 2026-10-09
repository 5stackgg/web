import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useUtilityLineupShare } from "~/composables/useUtilityLineupShare";

async function mountShare() {
  let state!: ReturnType<typeof useUtilityLineupShare>;
  await mountSuspended(
    defineComponent({
      setup() {
        state = useUtilityLineupShare();
        return () => h("div");
      },
    }),
  );
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useUtilityLineupShare", () => {
  it("copies the lineup's page, not its mp4, and flashes that lineup", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const share = await mountShare();

    await share.shareLineup("de_mirage", "l-1");

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/utility/de_mirage?lineup=l-1`,
    );
    expect(share.copiedLineupId.value).toBe("l-1");
  });
});
