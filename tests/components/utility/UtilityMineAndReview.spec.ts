import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityReviewTile from "~/components/utility/UtilityReviewTile.vue";
import metadata from "~/public/radars/metadata.json";
import type { UtilityLineup } from "~/types/utility";

const base = {
  id: "l-1",
  name: "Window smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  side: "TERRORIST",
  technique: "WalkJump",
  throw_strength: "Full",
  origin_x: -1200,
  origin_y: -1300,
  origin_z: -160,
  land_x: -800,
  land_y: -600,
  land_z: -160,
  flight_time_ms: 4200,
  tags: [],
  progress: [],
  visibility: "Private",
  upvotes: 4,
  can_edit: true,
  author_steam_id: "9",
  author: { steam_id: "9", name: "rawr", avatar_url: null },
  created_at: new Date().toISOString(),
} as unknown as UtilityLineup;

const auth = vi.hoisted(() => ({ me: { steam_id: "9" } }));
vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => ({ ...auth, isRoleAbove: () => false }),
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function mine(lineup: Partial<UtilityLineup>) {
  const wrapper = await mountSuspended(UtilityLineupCard, {
    props: {
      lineup: { ...base, ...lineup } as UtilityLineup,
      mode: "row",
      menu: false,
      ownState: true,
    },
  });
  await flushPromises();
  return wrapper;
}

describe("UtilityLineupCard on Mine", () => {
  it.each([
    [{}, "private"],
    [{ visibility: "Team" }, "team"],
    [{ public_requested_at: new Date().toISOString() }, "review"],
    [{ visibility: "Public" }, "public"],
    [{ public_review_note: "Doesn't land" }, "rejected"],
    [{ archived_at: new Date().toISOString() }, "archived"],
  ])("wears one icon for where it stands (%o)", async (lineup, state) => {
    const wrapper = await mine(lineup as Partial<UtilityLineup>);

    expect(wrapper.findAll("[data-state-icon]")).toHaveLength(1);
    expect(wrapper.find("[data-state-icon]").attributes("data-state")).toBe(
      state,
    );
  });

  it("says why it was turned down on its third line", async () => {
    const wrapper = await mine({ public_review_note: "Doesn't land" });

    expect(wrapper.find("[data-state-line]").text()).toBe(
      "Declined: Doesn't land",
    );
  });

  it("counts upvotes on a public one, with no separate score column", async () => {
    const wrapper = await mine({ visibility: "Public" });

    expect(wrapper.find("[data-state-line]").text()).toBe("4 upvotes");
    expect(wrapper.find("[data-upvote]").exists()).toBe(false);
  });
});

describe("UtilityReviewTile", () => {
  async function tile(lineup: Partial<UtilityLineup> = {}) {
    const wrapper = await mountSuspended(UtilityReviewTile, {
      props: {
        lineup: {
          ...base,
          author_steam_id: "7",
          author: { steam_id: "7", name: "nyx", avatar_url: null },
          public_requested_at: new Date().toISOString(),
          description: "Ramp-side jungle for when palace is held.",
          ...lineup,
        } as UtilityLineup,
      },
    });
    await flushPromises();
    return wrapper;
  }

  it("shows who sent it, the air time and their note", async () => {
    const wrapper = await tile();

    expect(wrapper.find("[data-submitter]").text()).toContain("nyx");
    expect(wrapper.text()).toContain("4.2s");
    expect(wrapper.text()).toContain("Ramp-side jungle");
  });

  it("approves from the rail without opening it", async () => {
    const wrapper = await tile();

    await wrapper.find("[data-approve]").trigger("click");

    expect(wrapper.emitted("review")?.[0]).toEqual(["l-1", true, null]);
    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("asks why before it declines, and sends the reason", async () => {
    const wrapper = await tile();

    await wrapper.find("[data-decline]").trigger("click");
    expect(wrapper.emitted("review")).toBeUndefined();

    await wrapper.find("[data-reason=no_land]").trigger("click");

    expect(wrapper.emitted("review")?.[0]).toEqual([
      "l-1",
      false,
      "Doesn't land",
    ]);
  });
});
