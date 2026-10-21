import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import BansPage from "~/pages/bans.vue";
import { useAuthStore } from "~/stores/AuthStore";

const schema = vi.hoisted(() => ({ available: true }));
const query = vi.hoisted(() => vi.fn());
vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useApolloClient: () => ({ client: { query, mutate: vi.fn() } }),
}));
vi.mock("~/utilities/schemaHasType", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  schemaHasType: vi.fn(async () => schema.available),
}));

const DAY = 24 * 60 * 60 * 1000;

const row = {
  steam_id: "76561198000000002",
  banned_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  banned_at_source: "5stack",
  steam_banned_on: null,
  vac_ban_count: 0,
  game_ban_count: 0,
  sanction_id: "s1",
  sanction_kind: "staff",
  banned_here: true,
  first_match_at: new Date(Date.now() - 300 * DAY).toISOString(),
  last_match_at: new Date(Date.now() - DAY).toISOString(),
  last_match_map: "de_mirage",
  matches_played: 188,
  matches_since_steam_ban: null,
  arrived_banned: false,
  shared_matches: [],
  player: {
    steam_id: "76561198000000002",
    name: "xX_Kowalczyk_The_Unbannable_Xx",
    role: "user",
  },
  sanction: {
    id: "s1",
    reason: "Cheating: aimlock confirmed",
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    remove_sanction_date: null,
    sanctioned_by: { steam_id: "1", name: "Luke" },
  },
};

function rootField(query: any): string | undefined {
  return query.definitions[0]?.selectionSet?.selections[0]?.name?.value;
}

let mounted: { unmount: () => void } | null = null;
let calls: any[] = [];

async function mountPage({
  role,
  rows = [row],
}: { role?: string; rows?: any[] } = {}) {
  useAuthStore().me = role
    ? ({ steam_id: "76561198000000001", role } as any)
    : undefined;
  calls = [];
  query.mockImplementation(async (options: any) => {
    calls.push(options);
    if (rootField(options.query) === "recently_banned_players") {
      return {
        data: {
          recently_banned_players: rows,
          recently_banned_players_aggregate: {
            aggregate: { count: rows.length },
          },
        },
      };
    }
    return {
      data: { recently_banned_players_aggregate: { aggregate: { count: 2 } } },
    };
  });
  const wrapper = await mountSuspended(BansPage);
  mounted = wrapper;
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 400));
  await flushPromises();
  return wrapper;
}

const listCalls = () =>
  calls.filter((call) => rootField(call.query) === "recently_banned_players");

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  schema.available = true;
  useAuthStore().me = undefined;
  query.mockReset();
});

describe("/bans", () => {
  it("lists recent bans with the default window and every kind", async () => {
    const wrapper = await mountPage({ role: "user" });

    expect(wrapper.text()).toContain("xX_Kowalczyk_The_Unbannable_Xx");
    expect(wrapper.text()).toContain("1 player banned in the last 30 days");
    const [first] = listCalls();
    expect(first.variables.args).toMatchObject({
      _window_days: 30,
      _status: "any",
    });
    expect(first.variables.args).not.toHaveProperty("_kinds");
    expect(first.variables.order_by).toEqual([
      { banned_at: "desc" },
      { steam_id: "asc" },
    ]);
    expect(first.context).toEqual({ optional: true });
  });

  it("narrows to Steam kinds from the source switch", async () => {
    const wrapper = await mountPage({ role: "user" });
    const steam = wrapper
      .findAll("button")
      .find((button) => button.text() === "Steam");
    await steam!.trigger("click");
    await flushPromises();

    expect(listCalls().at(-1)!.variables.args._kinds).toBe("{vac,game}");
  });

  it("offers Played with me only when signed in", async () => {
    const guest = await mountPage();
    expect(guest.text()).not.toContain("Played with me");
    guest.unmount();
    mounted = null;

    const player = await mountPage({ role: "user" });
    expect(player.text()).toContain("Played with me");
  });

  it("points moderators at Steam-banned players who can still play", async () => {
    const wrapper = await mountPage({ role: "administrator" });

    expect(wrapper.text()).toContain(
      "2 Steam-banned players can still play here",
    );
    const gaps = calls.find(
      (call) => rootField(call.query) === "recently_banned_players_aggregate",
    );
    expect(gaps.variables.args).toEqual({
      _window_days: 30,
      _status: "not_banned_here",
    });
  });

  it("shows the empty page and asks nothing when the api lacks the view", async () => {
    schema.available = false;
    const wrapper = await mountPage({ role: "user" });

    expect(listCalls()).toHaveLength(0);
    expect(wrapper.text()).toContain("No one has been banned recently");
  });
});
