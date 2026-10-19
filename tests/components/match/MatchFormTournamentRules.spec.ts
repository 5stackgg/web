import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import MatchForm from "~/components/match/MatchForm.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";
import {
  answerMatchOptionsQueries,
  seededPools,
} from "../../helpers/matchOptionsQueries";

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: vi.fn(),
}));

const RULES_LOCKED =
  "Every match in a stage plays the same rules: format, maps, rounds, overtime, timeouts and substitutes. Region, TV delay, check-in and timers can still change.";

const match = (is_tournament_match: boolean) => ({
  id: "match-1",
  status: "Scheduled",
  is_organizer: true,
  is_tournament_match,
  lineup_1: { id: "lineup-1", team_id: "team-1" },
  lineup_2: { id: "lineup-2", team_id: "team-2" },
  options: {
    id: "options-1",
    type: "Competitive",
    mr: 15,
    best_of: 3,
    map_veto: true,
    tv_delay: 115,
    veto_pick_timeout: 60,
    region_veto: true,
    regions: [],
    check_in_setting: "Captains",
    ready_setting: "Players",
    timeout_setting: "Admin",
    tech_timeout_setting: "Admin",
    match_mode: "auto",
    knife_round: true,
    default_models: true,
    overtime: true,
    coaches: false,
    number_of_substitutes: 1,
    round_restart_delay: 3,
    halftime_pausematch: true,
    map_pool_id: "stale-seed-pool",
    map_pool: { ...seededPools.Competitive, id: "stale-seed-pool" },
  },
});

describe("MatchForm on a tournament match", () => {
  let unmount: (() => void) | null = null;
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useAuthStore().me = {
      steam_id: "76561198000000001",
      role: e_player_roles_enum.administrator,
    } as any;
    answerMatchOptionsQueries();
    mutate = vi.fn().mockResolvedValue({ data: {} });
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "mutate",
    ).mockImplementation(mutate);
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    useAuthStore().me = undefined;
    vi.restoreAllMocks();
  });

  async function mountForm(value: ReturnType<typeof match>) {
    const wrapper = await mountSuspended(MatchForm, {
      props: { match: value },
      global: {
        mixins: (useNuxtApp().vueApp as any)._context.mixins,
        stubs: { SettingsSaveBar: true, TeamSearch: true },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  type Wrapper = Awaited<ReturnType<typeof mountForm>>;

  const lockedWith = (wrapper: Wrapper, text: string) =>
    wrapper
      .findAll("fieldset[disabled]")
      .some((fieldset) => fieldset.text().includes(text));

  function sentOptions() {
    return mutate.mock.calls
      .map(([options]: [any]) => ({
        body: print(options.mutation),
        variables: options.variables ?? {},
      }))
      .find(({ body }) => body.includes("update_match_options_by_pk("))
      ?.variables;
  }

  it("locks the rules and says why, leaving region and TV delay open", async () => {
    const wrapper = await mountForm(match(true));

    expect(wrapper.find(`[aria-label="${RULES_LOCKED}"]`).exists()).toBe(true);
    expect(lockedWith(wrapper, "Overtime")).toBe(true);
    expect(lockedWith(wrapper, "Max Rounds")).toBe(true);
    expect(lockedWith(wrapper, "TV Delay")).toBe(false);
    expect(lockedWith(wrapper, "Region Settings")).toBe(false);
  });

  it("shows the stored rules instead of the match type's defaults", async () => {
    const wrapper = await mountForm(match(true));
    const values = (wrapper.vm as any).form.values;

    expect(values.mr).toBe("15");
    expect(values.map_pool_id).toBe("stale-seed-pool");
  });

  it("sends the stored rules back with a TV delay change, whatever the form holds", async () => {
    const wrapper = await mountForm(match(true));

    (wrapper.vm as any).form.setFieldValue("mr", "8");
    (wrapper.vm as any).form.setFieldValue("number_of_substitutes", 4);
    (wrapper.vm as any).form.setFieldValue("map_pool_id", "seeded-competitive");
    (wrapper.vm as any).form.setFieldValue("tv_delay", 30);
    await flushPromises();
    await (wrapper.vm as any).updateMatch();
    await flushPromises();

    expect(sentOptions()).toMatchObject({
      mr: 15,
      best_of: 3,
      number_of_substitutes: 1,
      round_restart_delay: 3,
      halftime_pausematch: true,
      map_pool_id: "stale-seed-pool",
      tv_delay: 30,
    });
    expect(
      mutate.mock.calls.some(([options]: [any]) =>
        print(options.mutation).includes("insert_map_pools_one"),
      ),
    ).toBe(false);
  });

  it("leaves the bracket's teams out of the form", async () => {
    const wrapper = await mountForm(match(true));

    expect(wrapper.findComponent({ name: "TeamSearch" }).exists()).toBe(false);
  });

  it("keeps every setting of a match outside a tournament open", async () => {
    const wrapper = await mountForm(match(false));

    expect(wrapper.find(`[aria-label="${RULES_LOCKED}"]`).exists()).toBe(
      false,
    );
    expect(lockedWith(wrapper, "Overtime")).toBe(false);
    expect(wrapper.findComponent({ name: "TeamSearch" }).exists()).toBe(true);
  });
});
