import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import metadata from "~/public/radars/metadata.json";
import type { UtilityLineup } from "~/types/utility";

const base = {
  id: "l-1",
  name: "Window smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  side: "T",
  technique: "WalkJump",
  throw_strength: "Full",
  origin_x: -1200,
  origin_y: -1300,
  origin_z: -160,
  land_x: -800,
  land_y: -600,
  land_z: -160,
  tags: [],
  progress: [],
} as unknown as UtilityLineup;

const CLIP = "https://cf.5stack.gg/clips/utility/l-1/r-1.mp4";

const renders = vi.hoisted(() => ({
  rendering: new Set<string>(),
  percent: null as number | null,
}));
vi.mock("~/composables/useUtilityRendersInFlight", () => ({
  useUtilityRendersInFlight: () => ({
    count: { value: renders.rendering.size },
    isRendering: (id: string) => renders.rendering.has(id),
    percent: () => renders.percent,
  }),
}));

const auth = vi.hoisted(() => ({ me: { steam_id: "9" } }));
vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => ({ ...auth, isRoleAbove: () => false }),
}));

beforeEach(() => {
  renders.rendering.clear();
  renders.percent = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

async function mountRow(
  lineup: Partial<UtilityLineup> = {},
  props: Record<string, unknown> = {},
) {
  const wrapper = await mountSuspended(UtilityLineupCard, {
    props: {
      lineup: { ...base, ...lineup } as UtilityLineup,
      mode: "row",
      menu: false,
      ...props,
    },
  });
  await flushPromises();
  return wrapper;
}

describe("UtilityLineupCard row", () => {
  it("keeps the radar thumb and no badge for a lineup with no clip", async () => {
    const wrapper = await mountRow({
      preview_stills_url: { landing: "https://cdn.test/landing.webp" },
    });

    expect(wrapper.find("img[data-thumb]").exists()).toBe(false);
    expect(wrapper.find("[data-has-video]").exists()).toBe(false);
  });

  it("wears what the throw lands as, with a play badge, once it has a clip", async () => {
    const wrapper = await mountRow({
      preview_url: CLIP,
      preview_thumbnail_url: "https://cdn.test/thumb.jpg",
      preview_stills_url: { landing: "https://cdn.test/landing.webp" },
    });

    const thumb = wrapper.find("img[data-thumb]");
    expect(thumb.attributes("src")).toBe("https://cdn.test/landing.webp");
    expect(thumb.attributes("loading")).toBe("lazy");
    expect(wrapper.find("[data-has-video]").text()).toBe("Has video");
  });

  it("falls back to the clip's thumbnail, then to the radar if that will not load", async () => {
    const wrapper = await mountRow({
      preview_url: CLIP,
      preview_thumbnail_url: "https://cdn.test/thumb.jpg",
    });

    expect(wrapper.find("img[data-thumb]").attributes("src")).toBe(
      "https://cdn.test/thumb.jpg",
    );

    await wrapper.find("img[data-thumb]").trigger("error");
    expect(wrapper.find("img[data-thumb]").exists()).toBe(false);
    expect(wrapper.find("[data-has-video]").exists()).toBe(true);
  });

  it("draws the throw as the mouse and keeps the technique's word", async () => {
    const wrapper = await mountRow();

    const mouse = wrapper.find("svg[role=img]");
    expect(mouse.attributes("aria-label")).toBe("Left click");
    expect(wrapper.text()).toContain("Walk Jump");
    expect(wrapper.text()).not.toContain("LMB");
  });

  it("shows a render under way in place of the play badge", async () => {
    renders.rendering.add("l-1");
    renders.percent = 42;
    const wrapper = await mountRow({ preview_url: CLIP });

    expect(wrapper.find("[data-rendering]").text()).toBe(
      "Rendering preview… 42%",
    );
    expect(wrapper.find("[data-has-video]").exists()).toBe(false);
  });

  it("marks nothing on a recorded lineup, and a triangle on an estimated one", async () => {
    const recorded = await mountRow({ confidence: "exact" });
    expect(recorded.find("[data-confidence-mark]").exists()).toBe(false);
    expect(recorded.find(".text-success").exists()).toBe(false);

    const derived = await mountRow({ confidence: "derived" });
    const mark = derived.find("[data-confidence-mark]");
    expect(mark.attributes("data-confidence-mark")).toBe("derived");
    expect(mark.attributes("tabindex")).toBe("0");
    expect(mark.attributes("aria-label")).toContain("From a demo");
    expect(derived.text()).not.toContain("From a demo");
  });

  it("wears where it stands in the same corner on every list", async () => {
    const everybody = await mountRow({ visibility: "Public" });
    const yours = await mountRow({ visibility: "Public" }, { ownState: true });

    for (const wrapper of [everybody, yours]) {
      const icon = wrapper.find("[data-state-icon]");
      expect(icon.attributes("data-state")).toBe("public");
      expect(icon.classes()).toContain("row-start-1");
    }
  });

  it("asks before its lock submits your own private lineup for public", async () => {
    const wrapper = await mountRow(
      { visibility: "Private", can_edit: true } as Partial<UtilityLineup>,
      { ownState: true },
    );

    await wrapper.find("[data-state-icon]").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("request-public")).toBeUndefined();
    expect(wrapper.emitted("select")).toBeUndefined();

    (document.querySelector("[data-submit-public]") as HTMLElement).click();
    await flushPromises();

    expect(wrapper.emitted("request-public")?.[0]).toEqual([base.id]);
  });

  it("counts upvotes only on a public lineup, beside the same player count", async () => {
    const hidden = await mountRow(
      { visibility: "Private" },
      { ownState: true, metaThrowers: 5 },
    );
    expect(hidden.find("[data-upvote]").exists()).toBe(false);
    expect(hidden.find("[data-tallies]").text()).toContain("5");

    const shown = await mountRow(
      { visibility: "Public" },
      { metaThrowers: 5 },
    );
    expect(shown.find("[data-tallies] [data-upvote]").exists()).toBe(true);
  });
});
