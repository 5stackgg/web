import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityMetaPanel from "~/components/utility/UtilityMetaPanel.vue";
import metadata from "~/public/radars/metadata.json";

function spot(key: string, lineups: number) {
  return {
    key,
    utilityType: "Smoke",
    side: "T",
    technique: "Jump",
    throwStrength: "Full",
    throwers: 95,
    throws: 300,
    matches: 40,
    lineups,
    viewYaw: null,
    viewPitch: null,
    firstSeenAt: null,
    lastSeenAt: null,
    refreshedAt: null,
    origin: { x: -1200, y: -1300, z: -160 },
    landing: { x: -800, y: -600, z: -160 },
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

async function mountPanel() {
  const wrapper = await mountSuspended(UtilityMetaPanel, {
    props: {
      mapName: "de_mirage",
      spots: [spot("written", 2), spot("unwritten", 0)] as any,
      written: null,
      busiest: 95,
      types: [],
      scope: "all",
      scopeCounts: { all: 2, unwritten: 1, written: 1 },
      threshold: "5",
      thresholdOptions: [{ key: "5", label: "5+" }],
      hoveredKey: null,
    },
  });
  await flushPromises();
  return wrapper;
}

describe("UtilityMetaPanel rows", () => {
  it("says what a dashed row means on the spot nobody has written up", async () => {
    const wrapper = await mountPanel();

    const dashed = wrapper.find("#utility-meta-unwritten");
    expect(dashed.classes()).toContain("border-dashed");
    expect(dashed.find("[data-unwritten]").attributes("aria-label")).toBe(
      "Nobody has written this up. Load in, throw it, then save it.",
    );
    expect(dashed.find("[data-unwritten]").attributes("tabindex")).toBe("0");

    const solid = wrapper.find("#utility-meta-written");
    expect(solid.classes()).not.toContain("border-dashed");
    expect(solid.find("[data-unwritten]").exists()).toBe(false);
  });

  it("draws the throw as the mouse, as the lineup rows do", async () => {
    const wrapper = await mountPanel();

    const row = wrapper.find("#utility-meta-unwritten");
    expect(row.find("svg[role=img]").attributes("aria-label")).toBe(
      "Left click",
    );
    expect(row.text()).not.toContain("LMB");
  });
});
