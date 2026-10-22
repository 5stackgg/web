import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import WatchHighlights from "~/components/watch/WatchHighlights.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ClipTile from "~/components/clips/ClipTile.vue";

const { query, mobile } = vi.hoisted(() => ({
  query: vi.fn(),
  mobile: { value: false },
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ query }),
}));

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(mobile.value) }),
}));

beforeEach(() => {
  mobile.value = false;
  query.mockReset();
  query.mockResolvedValue({ data: { match_clips: [] } });
});

describe("WatchHighlights", () => {
  it("picks this week's top play by most kills, then the shortest clip", async () => {
    await mountSuspended(WatchHighlights);
    await flushPromises();

    const [options] = query.mock.calls[0];
    expect(print(options.query).replace(/\s+/g, "")).toContain(
      "order_by:[{kills_count:desc_nulls_last},{duration_ms:asc_nulls_last},{views_count:desc_nulls_last},{created_at:desc}]",
    );
    const since = new Date(options.variables.where.created_at._gte);
    const days = (Date.now() - since.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(7);
  });

  it("lays the plays out as one swipeable row on phones", async () => {
    mobile.value = true;
    const clips = ["a", "b", "c"].map((id) => ({
      id,
      title: `Clip ${id}`,
      kills_count: 5,
      round: 3,
      created_at: new Date().toISOString(),
    }));
    query.mockResolvedValue({ data: { match_clips: clips } });

    const wrapper = await mountSuspended(WatchHighlights);
    await flushPromises();

    const row = wrapper.findComponent(HorizontalScrollRow);
    expect(row.exists()).toBe(true);
    expect(row.findAllComponents(ClipTile)).toHaveLength(3);
    expect(wrapper.findAllComponents(ClipTile)).toHaveLength(3);
    expect(wrapper.find(".watch-bento").exists()).toBe(false);
  });
});
