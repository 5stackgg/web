import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import WatchHighlights from "~/components/watch/WatchHighlights.vue";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ query }),
}));

beforeEach(() => {
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
});
