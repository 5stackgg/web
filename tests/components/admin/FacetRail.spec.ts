import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import FacetRail from "~/components/admin/FacetRail.vue";
import {
  activeFacetCount,
  facetChips,
  facetHits,
  matchesFacets,
  resetFacets,
  toggleFacet,
  type FacetGroup,
} from "~/components/admin/facets";

type Row = { tier: string; tags: string[] };

const rows: Row[] = [
  { tier: "gold", tags: ["recent", "open"] },
  { tier: "gold", tags: ["never"] },
  { tier: "silver", tags: ["recent"] },
];
const values = (row: Row, key: string) =>
  key === "tier" ? row.tier : row.tags;

describe("facet helpers", () => {
  it("ORs inside a group and ANDs across groups", () => {
    const selection = { tier: ["gold", "silver"], status: ["never"] };
    expect(rows.filter((row) => matchesFacets(row, selection, values))).toEqual(
      [rows[1]],
    );
  });

  it("filters nothing for an empty group", () => {
    expect(
      rows.filter((row) => matchesFacets(row, { tier: [] }, values)),
    ).toHaveLength(3);
  });

  it("counts what a value would add with every other group applied", () => {
    const selection = { tier: ["silver"], status: [] };
    // Gold ignores the tier group itself, so both gold rows count.
    expect(facetHits(rows, "tier", "gold", selection, values)).toBe(2);
    expect(facetHits(rows, "status", "recent", selection, values)).toBe(1);
    expect(facetHits(rows, "status", "never", selection, values)).toBe(0);
    expect(
      facetHits(rows, "tier", "gold", {}, values, (row) =>
        row.tags.includes("open"),
      ),
    ).toBe(1);
  });

  it("toggles and resets values", () => {
    const on = toggleFacet({ tier: [] }, "tier", "gold");
    expect(on.tier).toEqual(["gold"]);
    expect(toggleFacet(on, "tier", "gold").tier).toEqual([]);
    expect(
      resetFacets(
        ["state"],
        { state: ["ready"] },
        { state: [], tier: ["gold"] },
      ),
    ).toEqual({ state: ["ready"], tier: ["gold"] });
  });

  it("chips only what was added to a group that starts picked", () => {
    const groups: FacetGroup[] = [
      {
        key: "state",
        label: "Status",
        options: [
          { value: "ready", label: "Ready" },
          { value: "disabled", label: "Disabled" },
        ],
      },
      {
        key: "tier",
        label: "Tier",
        options: [{ value: "gold", label: "Gold" }],
      },
    ];
    const defaults = { state: ["ready"] };

    expect(
      facetChips(groups, { state: ["ready"], tier: [] }, defaults),
    ).toEqual([]);
    expect(
      facetChips(
        groups,
        { state: ["ready", "disabled"], tier: ["gold"] },
        defaults,
      ),
    ).toEqual([
      { key: "state", value: "disabled", label: "Disabled" },
      { key: "tier", value: "gold", label: "Gold" },
    ]);
    expect(
      activeFacetCount(
        groups,
        { state: ["ready", "disabled"], tier: [] },
        defaults,
      ),
    ).toBe(1);
  });
});

describe("FacetRail", () => {
  let unmount: (() => void) | undefined;

  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  const groups: FacetGroup[] = [
    {
      key: "tier",
      label: "Tier",
      options: [
        { value: "gold", label: "Gold", count: 2 },
        { value: "silver", label: "Silver", count: 0 },
      ],
    },
  ];

  async function mount(props: Record<string, unknown>) {
    const wrapper = await mountSuspended(FacetRail, {
      props: { groups, label: "Filter", modelValue: { tier: [] }, ...props },
      slots: { default: () => "rows" },
    });
    unmount = () => wrapper.unmount();
    // Narrow viewports fold the groups behind the Filters button.
    const toggle = wrapper.find("[data-facet-toggle]");
    if (toggle.exists()) {
      await toggle.trigger("click");
    }
    return wrapper;
  }

  it("emits the toggled selection and dims values that return nothing", async () => {
    const wrapper = await mount({ counts: true });

    const silver = wrapper.find('[data-facet-value="silver"]');
    expect(silver.attributes("data-dim")).toBe("true");
    expect(
      wrapper.find('[data-facet-value="gold"]').attributes("data-dim"),
    ).toBeUndefined();
    expect(wrapper.find("[data-facet-count]").text()).toBe("2");

    await wrapper.find('[data-facet-value="gold"] input').trigger("change");
    expect(wrapper.emitted("update:modelValue")?.[0]?.[0]).toEqual({
      tier: ["gold"],
    });
  });

  it("chips picked values and removes them", async () => {
    const wrapper = await mount({ modelValue: { tier: ["gold"] } });

    const chip = wrapper.find("[data-facet-chip]");
    expect(chip.text()).toContain("Gold");
    await chip.find("button").trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]?.[0]).toEqual({
      tier: [],
    });
  });

  it("resets a group to its default", async () => {
    const wrapper = await mount({
      modelValue: { tier: ["gold", "silver"] },
      defaults: { tier: ["gold"] },
    });

    await wrapper.find("[data-facet-reset]").trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]?.[0]).toEqual({
      tier: ["gold"],
    });
  });
});
