import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import WatchTicker from "~/components/watch/WatchTicker.vue";

const { subscriptions, queries } = vi.hoisted(() => ({
  subscriptions: [] as Array<{ variables: any; next: (result: any) => void }>,
  queries: [] as Array<{ query: string; variables: any }>,
}));

const finished = (id: string, ended: string) => ({
  id,
  status: "Finished",
  ended_at: ended,
  lineup_1_id: "a",
  lineup_2_id: "b",
  winning_lineup_id: "a",
  lineup_1: { id: "a", name: "Buttah Boyz", team: null, lineup_players: [] },
  lineup_2: { id: "b", name: "Saint's Team", team: null, lineup_players: [] },
  options: { best_of: 1, mr: 12, type: "Competitive" },
  match_maps: [
    { id: `${id}-1`, winning_lineup_id: "a", lineup_1_score: 13, lineup_2_score: 9, map: { label: "Mirage" } },
  ],
  tournament_brackets: [],
  event_links: [],
  streams: [],
});

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: ({ variables }: any) => ({
        subscribe: ({ next }: { next: (result: any) => void }) => {
          subscriptions.push({ variables, next });
          return { unsubscribe() {} };
        },
      }),
      query: async ({ query, variables }: any) => {
        queries.push({ query: print(query), variables });
        return {
          data: {
            matches: [finished("r1", new Date().toISOString())],
          },
        };
      },
    },
  }),
}));

async function mountTicker(live: any[] = []) {
  const wrapper = await mountSuspended(WatchTicker, {
    props: { streamableMatchIds: [] },
    global: { stubs: { NuxtLink: { template: "<a><slot /></a>" } } },
  });
  for (const sub of subscriptions) {
    sub.next({ data: { matches: sub.variables.statuses ? live : [] } });
  }
  await flushPromises();
  return wrapper;
}

function filterButtons(wrapper: any) {
  return wrapper.findAll('[role="group"] button');
}

describe("WatchTicker", () => {
  beforeEach(() => {
    subscriptions.length = 0;
    queries.length = 0;
  });

  it("counts Live and Upcoming but not All or Results", async () => {
    const wrapper = await mountTicker();
    const labels = filterButtons(wrapper).map((b: any) => b.text());

    expect(labels).toEqual(["All", "Live 0", "Upcoming 0", "Results"]);
  });

  it("says nothing is live and still shows results", async () => {
    const wrapper = await mountTicker();

    expect(wrapper.text()).toContain("Nothing live right now");
    expect(wrapper.text()).toContain("Today");
    expect(wrapper.text()).toContain("Buttah Boyz");
  });

  it("switches what the row shows when a filter is picked", async () => {
    const wrapper = await mountTicker();
    await filterButtons(wrapper)[3].trigger("click");

    expect(filterButtons(wrapper)[3].attributes("aria-pressed")).toBe("true");
    expect(wrapper.text()).not.toContain("Nothing live right now");
    expect(wrapper.text()).toContain("Buttah Boyz");
  });

  it("pages results in twelve at a time with an offset", async () => {
    await mountTicker();

    expect(queries[0].variables).toMatchObject({ limit: 12, offset: 0 });
    expect(queries[0].query).toContain("offset: $offset");
  });

  it("shows placeholders and runs no queries for a new server", async () => {
    const wrapper = await mountSuspended(WatchTicker, {
      props: { streamableMatchIds: [], ghost: true },
    });

    expect(wrapper.text()).toContain(
      "Matches show here as they're played, live first, then results.",
    );
    expect(subscriptions).toHaveLength(0);
    expect(queries).toHaveLength(0);
  });
});
