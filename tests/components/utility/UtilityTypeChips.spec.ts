import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { h } from "vue";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";

const counts = { Smoke: 12, Flash: 3, Molotov: 0, HighExplosive: 1, Decoy: 0 };

async function mountChips(props: Record<string, unknown>) {
  return mountSuspended({
    render: () =>
      h("div", { class: "flex" }, [
        h(UtilityTypeChips, { modelValue: [], ...props }),
      ]),
  });
}

describe("UtilityTypeChips", () => {
  for (const fill of [false, true]) {
    it(`never cuts a type's name short${fill ? " when it fills its row" : ""}`, async () => {
      const wrapper = await mountChips({ counts, fill });
      const names = wrapper.findAll("[data-type-name]");

      expect(names.map((name) => name.text())).toEqual([
        "Smoke",
        "Flash",
        "Molotov",
        "HE",
        "Decoy",
      ]);
      for (const name of names) {
        // The name holds its width and stays on one line; nothing clips it
        // with an ellipsis.
        expect(name.classes()).toContain("shrink-0");
        expect(name.classes()).toContain("whitespace-nowrap");
        expect(name.classes()).not.toContain("truncate");
        expect(name.element.closest(".truncate")).toBeNull();
      }
      for (const chip of wrapper.findAll("button")) {
        expect(chip.classes()).not.toContain("min-w-0");
      }
    });
  }

  it("gives up the count before the name when the row is tight", async () => {
    const wrapper = await mountChips({ counts, fill: true });
    const line = wrapper.find("[data-type-name]").element.parentElement!;

    // One line high and wrapping: the count is what drops out of sight.
    expect(line.classList.contains("flex-wrap")).toBe(true);
    expect(line.classList.contains("overflow-hidden")).toBe(true);
    expect(line.className).toContain("h-[1.4em]");
    expect(line.children).toHaveLength(2);
    expect(line.children[1].textContent?.trim()).toBe("12");
  });

  it("says what each one is to a screen reader, pressed or not", async () => {
    const wrapper = await mountChips({ modelValue: ["Smoke"] });
    const chips = wrapper.findAll("button");

    expect(chips[0].attributes("aria-pressed")).toBe("true");
    expect(chips[1].attributes("aria-pressed")).toBe("false");
    expect(chips[0].text()).toBe("Smoke");
  });
});
