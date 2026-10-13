import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: toastMock,
}));

const MATCH_SETTINGS_DRAWN =
  "This stage's matches are already drawn, so its match settings can't change.";

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

type Pool = { id: string; type: string; maps: typeof maps };

const tournamentPoolOf = (count: number): Pool => ({
  id: "tournament-pool",
  type: "Custom",
  maps: maps.slice(0, count),
});

const tournamentPool = tournamentPoolOf(5);

// Stages could hold a pool of their own for a short while; some still do.
const ownPools: Record<string, Pool> = {
  "hand-picked": {
    id: "stage-pool",
    type: "Custom",
    maps: [
      ...maps.slice(3, 7),
      {
        id: "map-de_vertigo",
        name: "de_vertigo",
        label: "vertigo",
        type: "Competitive",
        poster: null,
        patch: null,
        workshop_map_id: null,
      },
    ],
  },
  "Active Duty": { id: "seeded-pool", type: "Competitive", maps },
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

const stageWithOwnPool = (
  pool: Pool,
  overrides: Record<string, unknown> = {},
) =>
  stage(
    tournamentOptions({
      id: "stage-options",
      map_pool_id: pool.id,
      map_pool: pool,
      ...overrides,
    }),
  );

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
  toastMock.mockClear();
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
  {
    pool = tournamentPool,
    type = "Competitive",
    saveBar = false,
  }: { pool?: Pool; type?: string; saveBar?: boolean } = {},
) {
  const wrapper = await mountSuspended(TournamentStageForm, {
    props: {
      order: 1,
      stage: existing ?? undefined,
      tournament: {
        id: "tournament-1",
        status: "Setup",
        options: tournamentOptions({
          type,
          map_pool_id: pool.id,
          map_pool: pool,
        }),
        stages: existing ? [existing] : [],
      },
    },
    global: { stubs: { SettingsSaveBar: !saveBar } },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  (wrapper.vm as any).e_tournament_stage_types = [
    { value: "SingleElimination", description: "Single Elimination" },
    { value: "RoundRobin", description: "Round Robin" },
  ];
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountStageForm>>;

function mutations() {
  return mutate.mock.calls.map(([options]: [any]) => ({
    body: print(options.mutation),
    variables: options.variables ?? {},
  }));
}

const sent = (name: string) =>
  mutations().find(({ body }) => body.includes(name));

async function respond({ mutation }: { mutation: any }) {
  const body = print(mutation);
  if (body.includes("insert_match_options_one")) {
    return { data: { insert_match_options_one: { id: "new-options" } } };
  }
  if (body.includes("insert_tournament_stages_one")) {
    return { data: { insert_tournament_stages_one: { id: "new-stage" } } };
  }
  return { data: {} };
}

async function edit(wrapper: Wrapper, values: Record<string, unknown>) {
  (wrapper.vm as any).form.setValues(values);
  await flushPromises();
}

async function save(wrapper: Wrapper) {
  await (wrapper.vm as any).updateCreateStage();
  await flushPromises();
}

const addButton = (wrapper: Wrapper) => wrapper.get("button[type='submit']");

const isDisabled = (button: ReturnType<typeof addButton>) =>
  button.attributes("disabled") !== undefined;

async function addButtonReason(wrapper: Wrapper) {
  addButton(wrapper).element.parentElement!.focus();
  await flushPromises();
  return document.body.querySelector('[role="tooltip"]')?.textContent;
}

const saveBarButton = (wrapper: Wrapper) =>
  wrapper.findAll("button").find((button) => button.text().includes("Save"))!;

describe("TournamentStageForm map pool", () => {
  it("has no Map Pool card and no pool selector", async () => {
    const wrapper = await mountStageForm(null);

    expect(wrapper.text()).not.toContain("Map Pool");
    for (const label of ["Same as Tournament", "Active Duty", "Custom"]) {
      expect(
        wrapper.findAll("button").some((button) => button.text() === label),
        label,
      ).toBe(false);
    }
    for (const map of tournamentPool.maps) {
      expect(wrapper.text()).not.toContain(map.label);
    }
  });

  it.each(Object.entries(ownPools))(
    "shows nothing about the %s pool an older stage still holds",
    async (_kind, pool) => {
      const wrapper = await mountStageForm(stageWithOwnPool(pool));

      expect(wrapper.text()).not.toContain("Map Pool");
      for (const map of pool.maps) {
        expect(wrapper.text()).not.toContain(map.label);
        expect(wrapper.find(`[aria-label="${map.label}"]`).exists()).toBe(
          false,
        );
      }
      expect((wrapper.vm as any).isDirty).toBe(false);
    },
  );

  it("gives a new stage no options row when its match settings are the tournament's", async () => {
    const wrapper = await mountStageForm(null);
    await edit(wrapper, { min_teams: "4", max_teams: "8" });

    await save(wrapper);

    expect(sent("insert_tournament_stages_one")).toBeDefined();
    expect(sent("insert_match_options_one")).toBeUndefined();
  });

  it("writes the tournament's pool into a new stage's options row", async () => {
    const wrapper = await mountStageForm(null);
    await edit(wrapper, { min_teams: "4", max_teams: "8", tv_delay: 30 });

    await save(wrapper);

    expect(sent("insert_match_options_one")?.variables).toMatchObject({
      tv_delay: 30,
      map_pool_id: "tournament-pool",
    });
    expect(sent("insert_map_pools")).toBeUndefined();
  });

  it("writes the tournament's pool into the options row an existing stage gains", async () => {
    const wrapper = await mountStageForm(stage(null));
    await edit(wrapper, { tv_delay: 30 });

    await save(wrapper);

    expect(sent("insert_match_options_one")?.variables).toMatchObject({
      tv_delay: 30,
      map_pool_id: "tournament-pool",
    });
    expect(sent("insert_map_pools")).toBeUndefined();
  });

  it("keeps the tournament's pool on an options row that is saved again", async () => {
    const wrapper = await mountStageForm(
      stage(tournamentOptions({ id: "stage-options", tv_delay: 30 })),
    );
    await edit(wrapper, { tv_delay: 45 });

    await save(wrapper);

    expect(sent("update_match_options_by_pk")?.variables).toMatchObject({
      id: "stage-options",
      tv_delay: 45,
      map_pool_id: "tournament-pool",
    });
  });

  it.each(Object.entries(ownPools))(
    "puts a stage that held its own %s pool back on the tournament's",
    async (_kind, pool) => {
      const wrapper = await mountStageForm(
        stageWithOwnPool(pool, { tv_delay: 30 }),
      );
      await edit(wrapper, { default_best_of: "1" });

      await save(wrapper);

      expect(sent("update_match_options_by_pk")?.variables).toMatchObject({
        id: "stage-options",
        tv_delay: 30,
        map_pool_id: "tournament-pool",
      });
      expect(sent("insert_map_pools")).toBeUndefined();
      expect(sent("delete_match_options_by_pk")).toBeUndefined();
    },
  );

  it.each(Object.entries(ownPools))(
    "removes the options row of a stage whose %s pool was its only difference",
    async (_kind, pool) => {
      const wrapper = await mountStageForm(stageWithOwnPool(pool));
      await edit(wrapper, { default_best_of: "1" });

      await save(wrapper);

      expect(sent("update_match_options_by_pk")).toBeUndefined();
      expect(sent("insert_map_pools")).toBeUndefined();
      expect(sent("delete_match_options_by_pk")?.body ?? "").toContain(
        '"stage-options"',
      );
      const stageUpdates = mutations().filter(({ body }) =>
        body.includes("update_tournament_stages_by_pk"),
      );
      expect(stageUpdates.length).toBeGreaterThan(0);
      for (const update of stageUpdates) {
        expect(update.body).toContain("match_options_id: null");
      }
    },
  );

  it("leaves a drawn stage's own pool where it is, and says the matches are drawn", async () => {
    drawnBrackets.value = [{ id: "bracket-1" }];
    const wrapper = await mountStageForm(
      stageWithOwnPool(ownPools["hand-picked"]),
    );
    await edit(wrapper, { default_best_of: "1" });

    await save(wrapper);

    expect(mutate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: MATCH_SETTINGS_DRAWN }),
    );
  });

  it("does not give a stage whose matches are already drawn an options row", async () => {
    drawnBrackets.value = [{ id: "bracket-1" }];
    const wrapper = await mountStageForm(stage(null));
    await edit(wrapper, { tv_delay: 30 });

    await save(wrapper);

    expect(mutate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: MATCH_SETTINGS_DRAWN }),
    );
  });

  it("drops per-round formats that don't apply once the stage type changes", async () => {
    const wrapper = await mountStageForm(null);
    const vm = wrapper.vm as any;
    await edit(wrapper, { min_teams: "8", max_teams: "8" });
    vm.roundBestOf = { "WB:3": "5" };
    await flushPromises();

    const roundRobin = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Round Robin"));
    await roundRobin!.trigger("click");
    await flushPromises();

    expect(vm.roundBestOf).toEqual({});
  });
});

describe("TournamentStageForm map pool size", () => {
  const FOUR_OF_FIVE =
    "Best of 5 needs at least 5 maps. The tournament's map pool has 4.";

  it("blocks adding a best of 5 stage to a tournament with four maps, and says why", async () => {
    const wrapper = await mountStageForm(null, { pool: tournamentPoolOf(4) });
    await edit(wrapper, {
      min_teams: "4",
      max_teams: "8",
      default_best_of: "5",
    });

    expect(isDisabled(addButton(wrapper))).toBe(true);
    expect(await addButtonReason(wrapper)).toContain(FOUR_OF_FIVE);

    await save(wrapper);

    expect(mutate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: FOUR_OF_FIVE }),
    );
  });

  it("adds a best of 5 stage once the tournament has five maps", async () => {
    const wrapper = await mountStageForm(null, { pool: tournamentPoolOf(5) });
    await edit(wrapper, {
      min_teams: "4",
      max_teams: "8",
      default_best_of: "5",
    });

    expect(isDisabled(addButton(wrapper))).toBe(false);

    await save(wrapper);

    expect(sent("insert_tournament_stages_one")).toBeDefined();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("counts a best of 5 final even when the default is a best of 1", async () => {
    const wrapper = await mountStageForm(null, { pool: tournamentPoolOf(4) });
    await edit(wrapper, { min_teams: "8", max_teams: "8" });
    expect(isDisabled(addButton(wrapper))).toBe(false);

    (wrapper.vm as any).roundBestOf = { "WB:3": "5" };
    await flushPromises();

    expect(isDisabled(addButton(wrapper))).toBe(true);
    expect(await addButtonReason(wrapper)).toContain(FOUR_OF_FIVE);
  });

  it("says the tournament's pool is empty when it has no maps", async () => {
    const wrapper = await mountStageForm(null, { pool: tournamentPoolOf(0) });
    await edit(wrapper, { min_teams: "4", max_teams: "8" });

    expect(isDisabled(addButton(wrapper))).toBe(true);
    expect(await addButtonReason(wrapper)).toContain(
      "The tournament's map pool has no maps.",
    );

    await save(wrapper);

    expect(mutate).not.toHaveBeenCalled();
  });

  it("stays out of the way of a Rush tournament", async () => {
    const wrapper = await mountStageForm(null, {
      pool: tournamentPoolOf(0),
      type: "Rush",
    });
    await edit(wrapper, { min_teams: "4", max_teams: "8" });

    expect(isDisabled(addButton(wrapper))).toBe(false);

    await save(wrapper);

    expect(sent("insert_tournament_stages_one")).toBeDefined();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("blocks saving a stage raised past the tournament's pool", async () => {
    const wrapper = await mountStageForm(stage(null), {
      pool: tournamentPoolOf(4),
      saveBar: true,
    });
    await edit(wrapper, { default_best_of: "5" });

    expect(wrapper.text()).toContain("Invalid settings");
    expect(isDisabled(saveBarButton(wrapper))).toBe(true);

    await save(wrapper);

    expect(mutate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: FOUR_OF_FIVE }),
    );
  });

  it("saves a stage whose best-of the tournament's pool covers", async () => {
    const wrapper = await mountStageForm(stage(null), {
      pool: tournamentPoolOf(5),
      saveBar: true,
    });
    await edit(wrapper, { default_best_of: "5" });

    expect(wrapper.text()).not.toContain("Invalid settings");
    expect(isDisabled(saveBarButton(wrapper))).toBe(false);

    await save(wrapper);

    expect(sent("update_tournament_stages_by_pk")).toBeDefined();
  });

  it("measures the tournament's pool, not the bigger pool an older stage still holds", async () => {
    const wrapper = await mountStageForm(
      stageWithOwnPool(ownPools["Active Duty"]),
      { pool: tournamentPoolOf(2), saveBar: true },
    );
    await edit(wrapper, { tv_delay: 30 });

    expect(isDisabled(saveBarButton(wrapper))).toBe(true);

    await save(wrapper);

    expect(mutate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "Best of 3 needs at least 3 maps. The tournament's map pool has 2.",
      }),
    );
  });

  it("measures the tournament's pool, not the smaller pool an older stage still holds", async () => {
    const small = { ...ownPools["hand-picked"], maps: maps.slice(0, 2) };
    const wrapper = await mountStageForm(stageWithOwnPool(small), {
      saveBar: true,
    });
    await edit(wrapper, { tv_delay: 30 });

    expect(isDisabled(saveBarButton(wrapper))).toBe(false);

    await save(wrapper);

    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      "tournament-pool",
    );
  });
});
