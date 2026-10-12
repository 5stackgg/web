import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const MAP_NAMES = [
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_train",
];

const maps = MAP_NAMES.map((name) => ({
  id: `map-${name}`,
  name,
  label: name.replace("de_", ""),
  type: "Competitive",
  poster: null,
  patch: null,
  workshop_map_id: null,
}));

const seededPool = { id: "seeded-pool", type: "Competitive", maps };
const tournamentPool = {
  id: "tournament-pool",
  type: "Custom",
  maps: maps.slice(0, 5),
};

function tournamentOptions(overrides: Record<string, unknown> = {}) {
  return {
    id: "options-1",
    type: "Competitive",
    mr: 12,
    best_of: 1,
    tv_delay: 115,
    veto_pick_timeout: 60,
    region_veto: true,
    regions: [],
    check_in_setting: "Captains",
    ready_setting: "Players",
    tech_timeout_setting: "Admin",
    match_mode: "auto",
    knife_round: true,
    default_models: true,
    overtime: true,
    coaches: true,
    number_of_substitutes: 0,
    timeout_setting: "Admin",
    map_pool_id: tournamentPool.id,
    map_pool: tournamentPool,
    ...overrides,
  };
}

function stage(options: Record<string, unknown> | null) {
  return {
    id: "stage-1",
    type: "SingleElimination",
    order: 1,
    groups: 1,
    min_teams: 4,
    max_teams: 8,
    default_best_of: 3,
    third_place_match: false,
    decider_best_of: null,
    max_rounds: null,
    swiss_no_elimination: false,
    final_map_advantage: 0,
    settings: null,
    options,
  };
}

let unmount: (() => void) | null = null;
const mutate = vi.fn(respond);
const drawnBrackets = { value: [] as Array<{ id: string }> };
const query = vi.fn(async () => ({
  data: { tournament_brackets: drawnBrackets.value },
}));

// The Options API components call this.$apollo.mutate and .query, which the
// test app does not install; the Nuxt $apollo they fall back to has neither.
beforeEach(() => {
  (useNuxtApp() as any).$apollo.mutate = mutate;
  (useNuxtApp() as any).$apollo.query = query;
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Organizer",
    role: e_player_roles_enum.administrator,
  } as ReturnType<typeof useAuthStore>["me"];
});

afterEach(() => {
  delete (useNuxtApp() as any).$apollo.mutate;
  delete (useNuxtApp() as any).$apollo.query;
  mutate.mockClear();
  query.mockClear();
  drawnBrackets.value = [];
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
});

async function mountStageForm(
  existing: ReturnType<typeof stage> | null,
  pool: { id: string; type: string; maps: any[] } = tournamentPool,
) {
  const wrapper = await mountSuspended(TournamentStageForm, {
    props: {
      order: 1,
      stage: existing ?? undefined,
      tournament: {
        id: "tournament-1",
        status: "Setup",
        options: tournamentOptions({ map_pool_id: pool.id, map_pool: pool }),
        stages: existing ? [existing] : [],
      },
    },
    global: { stubs: { SettingsSaveBar: true } },
  });
  unmount = () => wrapper.unmount();
  const vm = wrapper.vm as any;
  vm.map_pools = [seededPool];
  vm.maps = maps;
  vm.e_tournament_stage_types = [
    { value: "SingleElimination", description: "Single Elimination" },
    { value: "RoundRobin", description: "Round Robin" },
  ];
  await flushPromises();
  return wrapper;
}

function mutations() {
  return mutate.mock.calls.map(([options]: [any]) => ({
    body: print(options.mutation),
    variables: options.variables ?? {},
  }));
}

async function respond({ mutation }: { mutation: any }) {
  const body = print(mutation);
  if (body.includes("insert_map_pools_one")) {
    return { data: { insert_map_pools_one: { id: "new-custom-pool" } } };
  }
  if (body.includes("insert_match_options_one")) {
    return { data: { insert_match_options_one: { id: "new-options" } } };
  }
  if (body.includes("insert_tournament_stages_one")) {
    return { data: { insert_tournament_stages_one: { id: "new-stage" } } };
  }
  return { data: {} };
}

function filterButton(
  wrapper: Awaited<ReturnType<typeof mountStageForm>>,
  label: string,
) {
  const button = wrapper
    .findAll("button")
    .find((candidate) => candidate.text() === label);
  expect(button, label).toBeDefined();
  return button!;
}

async function pickCustom(
  wrapper: Awaited<ReturnType<typeof mountStageForm>>,
  labels: string[],
) {
  await filterButton(wrapper, "Custom").trigger("click");
  await flushPromises();
  for (const label of labels) {
    await wrapper.get(`button[aria-label="${label}"]`).trigger("click");
  }
  await flushPromises();
}

describe("TournamentStageForm map pool", () => {
  it("keeps a stage's own map pool when its other settings are saved", async () => {
    const stagePool = {
      id: "stage-pool",
      type: "Custom",
      maps: maps.slice(2, 7),
    };
    const wrapper = await mountStageForm(
      stage(
        tournamentOptions({
          id: "stage-options",
          tv_delay: 30,
          map_pool_id: stagePool.id,
          map_pool: stagePool,
        }),
      ),
    );

    await (wrapper.vm as any).updateCreateStage();

    const update = mutations().find(({ body }) =>
      body.includes("update_match_options_by_pk"),
    );
    expect(update?.variables.map_pool_id).toBe("stage-pool");
    expect(
      mutations().some(({ body }) => body.includes("insert_map_pools")),
    ).toBe(false);
  });

  it("follows the tournament's pool by default", async () => {
    const wrapper = await mountStageForm(null);

    expect(filterButton(wrapper, "Same as Tournament").classes()).toContain(
      "font-bold",
    );
    for (const map of tournamentPool.maps) {
      expect(wrapper.text()).toContain(map.label);
    }
  });

  it("blocks saving a best of 5 on a four-map custom pool, and says why", async () => {
    const wrapper = await mountStageForm(null);
    (wrapper.vm as any).form.setFieldValue("default_best_of", "5");
    await pickCustom(wrapper, ["ancient", "anubis", "inferno", "mirage"]);

    const warning = wrapper.get(
      '[aria-label="Best of 5 needs at least 5 maps. This pool has 4."]',
    );
    expect(warning.exists()).toBe(true);
    expect(wrapper.get("button[type='submit']").attributes()).toHaveProperty(
      "disabled",
    );

    await wrapper.get('button[aria-label="nuke"]').trigger("click");
    await flushPromises();

    expect(
      wrapper
        .find('[aria-label="Best of 5 needs at least 5 maps. This pool has 4."]')
        .exists(),
    ).toBe(false);
    expect(
      wrapper.get("button[type='submit']").attributes(),
    ).not.toHaveProperty("disabled");
  });

  it("counts a best of 5 final against the pool even when the default is a best of 1", async () => {
    const wrapper = await mountStageForm(null);
    const vm = wrapper.vm as any;
    vm.form.setValues({ min_teams: "8", max_teams: "8" });
    vm.roundBestOf = { "WB:3": "5" };
    await pickCustom(wrapper, ["ancient", "anubis", "inferno"]);

    expect(
      wrapper
        .find('[aria-label="Best of 5 needs at least 5 maps. This pool has 3."]')
        .exists(),
    ).toBe(true);
  });

  it("refuses to save while the pool is too small", async () => {
    const wrapper = await mountStageForm(null);
    const vm = wrapper.vm as any;
    vm.form.setValues({
      min_teams: "4",
      max_teams: "8",
      default_best_of: "3",
    });
    await pickCustom(wrapper, ["ancient", "anubis"]);

    await vm.updateCreateStage();

    expect(mutate).not.toHaveBeenCalled();
  });

  it("saves a custom pool as a new Custom map pool on the stage's options", async () => {
    const wrapper = await mountStageForm(null);
    const vm = wrapper.vm as any;
    vm.form.setValues({ min_teams: "4", max_teams: "8" });
    await pickCustom(wrapper, ["ancient", "anubis", "inferno"]);

    await vm.updateCreateStage();

    const calls = mutations();
    const pool = calls.find(({ body }) =>
      body.includes("insert_map_pools_one"),
    );
    expect(pool?.variables.map_pool).toEqual({
      type: "Custom",
      maps: {
        data: [
          { id: "map-de_ancient" },
          { id: "map-de_anubis" },
          { id: "map-de_inferno" },
        ],
      },
    });
    const options = calls.find(({ body }) =>
      body.includes("insert_match_options_one"),
    );
    expect(options?.variables.map_pool_id).toBe("new-custom-pool");
  });

  it("gives the stage the seeded pool for Active Duty", async () => {
    const wrapper = await mountStageForm(null);
    const vm = wrapper.vm as any;
    vm.form.setValues({ min_teams: "4", max_teams: "8" });
    await filterButton(wrapper, "Active Duty").trigger("click");
    await flushPromises();

    await vm.updateCreateStage();

    const options = mutations().find(({ body }) =>
      body.includes("insert_match_options_one"),
    );
    expect(options?.variables.map_pool_id).toBe("seeded-pool");
  });

  it("drops the stage's own options when it goes back to the tournament's pool and nothing else differs", async () => {
    const stagePool = {
      id: "stage-pool",
      type: "Custom",
      maps: maps.slice(2, 7),
    };
    const wrapper = await mountStageForm(
      stage(
        tournamentOptions({
          id: "stage-options",
          map_pool_id: stagePool.id,
          map_pool: stagePool,
        }),
      ),
    );
    await filterButton(wrapper, "Same as Tournament").trigger("click");
    await flushPromises();

    await (wrapper.vm as any).updateCreateStage();

    const calls = mutations();
    expect(
      calls.some(({ body }) => body.includes("delete_match_options_by_pk")),
    ).toBe(true);
    expect(
      calls.some(({ body }) => body.includes("update_match_options_by_pk")),
    ).toBe(false);
  });

  it("drops per-round formats that don't apply once the stage type changes", async () => {
    const wrapper = await mountStageForm(null);
    const vm = wrapper.vm as any;
    vm.form.setValues({ min_teams: "8", max_teams: "8" });
    vm.roundBestOf = { "WB:3": "5" };
    await flushPromises();

    const roundRobin = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Round Robin"));
    await roundRobin!.trigger("click");
    await flushPromises();

    expect(vm.roundBestOf).toEqual({});
  });

  it("does not create a pool for a stage whose matches are already drawn", async () => {
    drawnBrackets.value = [{ id: "bracket-1" }];
    const wrapper = await mountStageForm(stage(null));
    const vm = wrapper.vm as any;
    await pickCustom(wrapper, ["ancient", "anubis", "inferno"]);

    await vm.updateCreateStage();

    expect(mutate).not.toHaveBeenCalled();
  });

  it("does not offer Active Duty as its own choice when the tournament plays it", async () => {
    const wrapper = await mountStageForm(null, seededPool);

    expect(filterButton(wrapper, "Active Duty").attributes()).toHaveProperty(
      "disabled",
    );
  });

  it("shows a pool map that is no longer playable, so it can be taken out", async () => {
    const retired = {
      id: "map-de_vertigo",
      name: "de_vertigo",
      label: "vertigo",
      type: "Competitive",
      poster: null,
      patch: null,
      workshop_map_id: null,
    };
    const stagePool = {
      id: "stage-pool",
      type: "Custom",
      maps: [...maps.slice(0, 4), retired],
    };
    const wrapper = await mountStageForm(
      stage(
        tournamentOptions({
          id: "stage-options",
          map_pool_id: stagePool.id,
          map_pool: stagePool,
        }),
      ),
    );

    expect(wrapper.text()).toContain("Custom Map Pool (5)");
    await wrapper.get('button[aria-label="vertigo"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Custom Map Pool (4)");
  });

  it("is not dirty after going back to the pool it started with", async () => {
    const wrapper = await mountStageForm(stage(null));
    const vm = wrapper.vm as any;
    await pickCustom(wrapper, ["ancient"]);
    expect(vm.isDirty).toBe(true);

    await filterButton(wrapper, "Same as Tournament").trigger("click");
    await flushPromises();

    expect(vm.isDirty).toBe(false);
  });
});
