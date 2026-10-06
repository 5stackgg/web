import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { useEventMatches } from "~/composables/useEventMatches";

const state = vi.hoisted(() => ({
  restoring: false,
  restoredPage: null as number | null,
  offsets: [] as number[],
}));

vi.mock("~/composables/useScrollRestoration", () => ({
  isRestoringHistory: () => state.restoring,
}));

// Stands in for a back/forward that saved page `restoredPage`.
vi.mock("~/composables/useRestoredState", () => ({
  useRestoredRefs: (_id: string, refs: Record<string, { value: unknown }>) => {
    if (state.restoredPage === null) return false;
    refs.page.value = state.restoredPage;
    return true;
  },
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      query: vi.fn(async ({ variables }: any) => {
        if (typeof variables?.offset === "number") {
          state.offsets.push(variables.offset);
        }
        return {
          data: {
            event_match_links: [],
            event_match_links_aggregate: { aggregate: { count: 60 } },
          },
        };
      }),
    },
  }),
}));

function mountMatches() {
  let page: { value: number } | undefined;
  mount(
    defineComponent({
      setup() {
        page = useEventMatches(ref("event-1")).page;
        return () => h("div");
      },
    }),
  );
  return () => page!.value;
}

beforeEach(() => {
  state.restoring = false;
  state.restoredPage = null;
  state.offsets = [];
});

describe("useEventMatches back/forward", () => {
  it("starts an ordinary visit on the first page", async () => {
    const page = mountMatches();
    await flushPromises();

    expect(page()).toBe(1);
    expect(state.offsets).toEqual([0]);
  });

  it("fetches the restored page instead of starting over", async () => {
    state.restoring = true;
    state.restoredPage = 3;

    const page = mountMatches();
    await flushPromises();

    expect(page()).toBe(3);
    // 10 per page by default: page 3 starts at row 20.
    expect(state.offsets).toEqual([20]);
  });
});
