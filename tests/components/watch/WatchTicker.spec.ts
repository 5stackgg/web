import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import WatchTicker from "~/components/watch/WatchTicker.vue";
import { useWatchStage } from "~/composables/useWatchStage";

const { subscriptions, queries } = vi.hoisted(() => ({
  subscriptions: [] as Array<{
    client: string;
    query: string;
    variables: any;
    next: (result: any) => void;
  }>,
  queries: [] as Array<{ client: string; query: string; variables: any }>,
}));

const myRoles = vi.hoisted(() => ({ state: null as any }));

// Fresh per test: tickers from earlier tests are still mounted.
vi.mock("~/composables/useMyMatchRoles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/composables/useMyMatchRoles")>()),
  useMyMatchRoles: () => myRoles.state,
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
    {
      id: `${id}-1`,
      winning_lineup_id: "a",
      lineup_1_score: 13,
      lineup_2_score: 9,
      map: { label: "Mirage" },
    },
  ],
  tournament_brackets: [],
  event_links: [],
  streams: [],
});

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: (id = "default") => ({
    client: {
      subscribe: ({ query, variables }: any) => ({
        subscribe: ({ next }: { next: (result: any) => void }) => {
          subscriptions.push({
            client: id,
            query: print(query),
            variables,
            next,
          });
          return { unsubscribe() {} };
        },
      }),
      query: async ({ query, variables }: any) => {
        if (print(query).includes("SchemaTypeFields")) {
          return { data: { __type: { fields: [{ name: "active_matches" }] } } };
        }
        queries.push({ client: id, query: print(query), variables });
        return {
          data: {
            matches: [finished("r1", new Date().toISOString())],
          },
        };
      },
    },
  }),
}));

async function mountTicker(
  live: any[] = [],
  streamableMatchIds: string[] = [],
) {
  const wrapper = await mountSuspended(WatchTicker, {
    props: { streamableMatchIds },
    global: {
      stubs: {
        NuxtLink: {
          props: ["to"],
          template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
        },
      },
    },
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
    myRoles.state = {
      ready: ref<boolean | null>(false),
      roles: ref(new Map()),
    };
  });

  it("follows live and upcoming from active_matches", async () => {
    await mountTicker();

    expect(subscriptions.map((sub) => sub.variables)).toEqual([
      { statuses: ["Live", "WaitingForServer", "Veto", "WaitingForCheckIn"] },
      { status: "Scheduled" },
    ]);
    for (const sub of subscriptions) {
      expect(sub.query).toMatch(/^\s*matches: active_matches\(/m);
    }
  });

  it("follows live and upcoming on the viewer's own session when it can't read as a guest", async () => {
    await mountTicker();

    expect(subscriptions.map((sub) => sub.client)).toEqual([
      "default",
      "default",
    ]);
  });

  // Live and upcoming are the same for every viewer, so a signed-in one reads
  // them as a guest and shares the poll; results stay a one-off query.
  it("follows live and upcoming as a guest once the viewer's own matches are known", async () => {
    myRoles.state.ready.value = null;
    await mountTicker();

    expect(subscriptions).toHaveLength(0);

    myRoles.state.ready.value = true;
    await flushPromises();

    expect(subscriptions.map((sub) => sub.client)).toEqual([
      "public",
      "public",
    ]);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((query) => query.client === "default")).toBe(true);
  });

  it("marks the viewer's own live match from their roles", async () => {
    myRoles.state.ready.value = true;
    myRoles.state.roles.value = new Map([
      ["mine", { is_in_lineup: true, is_coach: false }],
    ]);
    const live = (id: string) => ({
      ...finished(id, new Date().toISOString()),
      status: "Live",
      ended_at: null,
      winning_lineup_id: null,
      is_in_lineup: false,
    });
    const wrapper = await mountTicker([live("mine"), live("theirs")]);
    const cells = wrapper
      .findAll("a")
      .filter((a) => a.attributes("data-to")?.includes('"id"'));
    const you = (id: string) =>
      cells
        .find((a) => JSON.parse(a.attributes("data-to")!).params?.id === id)!
        .text()
        .includes("You");

    expect(you("mine")).toBe(true);
    expect(you("theirs")).toBe(false);
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

    // Live and upcoming are seeded over HTTP too, so find the results page.
    const results = queries.find((q) => q.query.includes("offset: $offset"));
    expect(results?.variables).toMatchObject({ limit: 12, offset: 0 });
  });

  it("takes forfeits and surrenders as results only with a winner", async () => {
    await mountTicker();

    const results = queries.find((q) => q.query.includes("offset: $offset"));
    expect(results?.query).toContain(
      "_or: [{status: {_eq: Finished}}, {status: {_in: [Forfeit, Surrendered]}, winning_lineup_id: {_is_null: false}}]",
    );
  });

  it("links a streamed live match to its match page", async () => {
    useWatchStage().setStage("m1");
    const wrapper = await mountTicker(
      [
        {
          ...finished("m1", new Date().toISOString()),
          status: "Live",
          ended_at: null,
          winning_lineup_id: null,
          streams: [{ id: "s1", link: "https://twitch.tv/x" }],
        },
      ],
      ["m1"],
    );
    const cell = wrapper.find('a[aria-current="true"]');

    expect(cell.text()).toContain("On stage");
    expect(JSON.parse(cell.attributes("data-to")!)).toEqual({
      name: "matches-id",
      params: { id: "m1" },
    });
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
