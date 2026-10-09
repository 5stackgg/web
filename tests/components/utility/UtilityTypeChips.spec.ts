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

// What cuts text short or lets a box be narrower than what is in it. There is
// no layout engine under these tests, so a clipped name cannot be measured
// here (it was, in a browser at 320 and 390px); what can be checked is that
// nothing between a name and its row is able to do the clipping.
const CUTS_TEXT = /^(truncate|text-ellipsis|text-clip|line-clamp-.+)$/;
const NARROWER_THAN_CONTENT =
  /^(min-w-0|w-(?!full$|auto$|fit$|max$).+|max-w-.+|basis-.+|flex-1|flex-initial|size-.+)$/;

function pathToRow(name: Element, row: Element) {
  const path: Element[] = [];
  for (let node: Element | null = name; node && node !== row; ) {
    path.push(node);
    node = node.parentElement;
  }
  return path;
}

describe("UtilityTypeChips", () => {
  for (const fill of [false, true]) {
    it(`never cuts a type's name short${fill ? " when it fills its row" : ""}`, async () => {
      const wrapper = await mountChips({ counts, fill });
      const row = wrapper.element;
      const names = wrapper.findAll("[data-type-name]");

      expect(names.map((name) => name.text())).toEqual([
        "Smoke",
        "Flash",
        "Molotov",
        "HE",
        "Decoy",
      ]);
      for (const name of names) {
        expect(name.classes()).toEqual(
          expect.arrayContaining(["shrink-0", "whitespace-nowrap"]),
        );
        // Nothing it sits in, up to the row, can cut text or be made
        // narrower than its content.
        for (const box of pathToRow(name.element, row)) {
          for (const token of Array.from(box.classList)) {
            expect(token).not.toMatch(CUTS_TEXT);
            expect(token).not.toMatch(NARROWER_THAN_CONTENT);
          }
        }
      }
    });
  }

  it("gives up the count, not the name, when the row is tight", async () => {
    const wrapper = await mountChips({ counts, fill: true });
    const line = wrapper.find("[data-type-line]").element;
    const [name, count] = Array.from(line.children);

    // The name and its count share a line that wraps and shows one row of
    // text: with no room beside the name the count is what goes to the row
    // that is not shown. The name comes first, so it is never the one.
    expect(name.hasAttribute("data-type-name")).toBe(true);
    expect(count.textContent?.trim()).toBe("12");
    expect(line.classList.contains("flex-wrap")).toBe(true);
    expect(line.classList.contains("overflow-hidden")).toBe(true);
    expect(line.className).toContain("h-[1.4em]");
  });

  it("says what each one is to a screen reader, pressed or not", async () => {
    const wrapper = await mountChips({ modelValue: ["Smoke"] });
    const chips = wrapper.findAll("button");

    expect(chips[0].attributes("aria-pressed")).toBe("true");
    expect(chips[1].attributes("aria-pressed")).toBe("false");
    expect(chips[0].text()).toBe("Smoke");
  });
});
