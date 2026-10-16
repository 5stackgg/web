import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import type { FieldNode, OperationDefinitionNode } from "graphql";
import MatchForm from "~/components/match/MatchForm.vue";
import {
  answerMatchOptionsQueries,
  competitiveMaps,
  seededPools,
} from "../../helpers/matchOptionsQueries";

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: vi.fn(),
}));

type Pool = { id: string; type: string; maps: typeof competitiveMaps };

const sharedCustomPool: Pool = {
  id: "tournament-custom-pool",
  type: "Custom",
  maps: competitiveMaps.slice(0, 3),
};

const match = (pool: Pool, map_veto: boolean) => ({
  id: "match-1",
  status: "PickingPlayers",
  is_organizer: true,
  lineup_1: { id: "lineup-1", team_id: null },
  lineup_2: { id: "lineup-2", team_id: null },
  options: {
    id: "options-1",
    type: "Competitive",
    mr: 12,
    best_of: 1,
    map_veto,
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
    coaches: true,
    number_of_substitutes: 0,
    map_pool_id: pool.id,
    map_pool: pool,
  },
});

function holdMapPoolsLoading() {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  const answer = client.watchQuery.getMockImplementation();

  client.watchQuery.mockImplementation((options: any) => {
    const operation = options.query.definitions[0] as OperationDefinitionNode;
    const field = (operation.selectionSet.selections[0] as FieldNode).name
      .value;

    if (field !== "map_pools") {
      return answer(options);
    }

    return {
      options,
      getCurrentResult: () => ({ loading: true, data: undefined }),
      subscribe: () => ({ closed: false, unsubscribe() {} }),
      refetch: () => new Promise(() => {}),
      setVariables: () => Promise.resolve(),
      setOptions: () => Promise.resolve(),
      stopPolling() {},
      getLastError() {},
      getLastResult() {},
      resetLastResults() {},
    };
  });
}

describe("MatchForm map pool save", () => {
  let unmount: (() => void) | null = null;
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    answerMatchOptionsQueries();
    mutate = vi.fn(async ({ mutation }: { mutation: any }) =>
      print(mutation).includes("insert_map_pools_one")
        ? { data: { insert_map_pools_one: { id: "new-pool" } } }
        : { data: {} },
    );
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "mutate",
    ).mockImplementation(mutate);
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
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

  async function set(wrapper: Wrapper, field: string, value: unknown) {
    (wrapper.vm as any).form.setFieldValue(field, value);
    await flushPromises();
  }

  async function save(wrapper: Wrapper) {
    await (wrapper.vm as any).updateMatch();
    await flushPromises();
  }

  function sent(name: string) {
    return mutate.mock.calls
      .map(([options]: [any]) => ({
        body: print(options.mutation),
        variables: options.variables ?? {},
      }))
      .find(({ body }) => body.includes(`${name}(`));
  }

  it("never rewrites the seeded pool when custom maps are picked before the pools load", async () => {
    holdMapPoolsLoading();
    const wrapper = await mountForm(match(seededPools.Competitive, true));

    await set(wrapper, "map_veto", false);
    await set(wrapper, "map_pool", ["map-de_dust2"]);
    await save(wrapper);

    expect(sent("delete__map_pool")).toBeUndefined();
    expect(sent("insert__map_pool")).toBeUndefined();
    expect(sent("insert_map_pools_one")?.body).toContain("map-de_dust2");
    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      "new-pool",
    );
  });

  it("saves changed maps as a new Custom pool, leaving a pool other matches share untouched", async () => {
    const wrapper = await mountForm(match(sharedCustomPool, false));

    await set(wrapper, "map_pool", ["map-de_nuke"]);
    await save(wrapper);

    expect(sent("delete__map_pool")).toBeUndefined();
    expect(sent("insert__map_pool")).toBeUndefined();
    expect(sent("insert_map_pools_one")?.body).toContain("map-de_nuke");
    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      "new-pool",
    );
  });

  it("keeps the Custom pool when only other settings change", async () => {
    const wrapper = await mountForm(match(sharedCustomPool, false));

    await set(wrapper, "mr", "8");
    await save(wrapper);

    expect(sent("delete__map_pool")).toBeUndefined();
    expect(sent("insert__map_pool")).toBeUndefined();
    expect(sent("insert_map_pools_one")).toBeUndefined();
    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      sharedCustomPool.id,
    );
  });

  it("gives a seeded-pool match turned custom its own Custom pool", async () => {
    const wrapper = await mountForm(match(seededPools.Competitive, true));

    await set(wrapper, "map_veto", false);
    await set(wrapper, "map_pool", ["map-de_dust2"]);
    await save(wrapper);

    expect(sent("delete__map_pool")).toBeUndefined();
    expect(sent("insert_map_pools_one")?.body).toContain("map-de_dust2");
    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      "new-pool",
    );
  });
});
