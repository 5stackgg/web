import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TournamentMatchOptionsForm from "~/components/tournament/TournamentMatchOptionsForm.vue";
import MatchOptions from "~/components/MatchOptions.vue";
import {
  answerMatchOptionsQueries,
  competitiveMaps,
  seededPools,
  wingmanMaps,
} from "../../helpers/matchOptionsQueries";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: toastMock,
}));

const tournament = (status: string, substitutes_enabled = true) => ({
  id: "tournament-1",
  status,
  auto_start: true,
  scheduling_mode: "auto",
  substitutes_enabled,
  options: {
    id: "options-1",
    type: "Competitive",
    mr: 12,
    best_of: 1,
    map_pool: { id: "pool-1", maps: [] },
  },
});

describe("TournamentMatchOptionsForm substitutes switch", () => {
  let unmount: (() => void) | null = null;

  afterEach(() => {
    unmount?.();
    unmount = null;
  });

  async function substitutesSwitch(status: string, enabled = true) {
    const wrapper = await mountSuspended(TournamentMatchOptionsForm, {
      props: { tournament: tournament(status, enabled) },
      global: {
        stubs: {
          MatchOptions: { template: "<div><slot /></div>" },
          SettingsSaveBar: true,
        },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    const row = wrapper
      .findAll("div.flex.flex-row")
      .find((div) => div.text().includes("Allow Substitutes"));
    expect(row).toBeDefined();
    return row!;
  }

  it("can still be turned off while registration is open", async () => {
    const row = await substitutesSwitch("RegistrationOpen");

    expect(row.find("button[role='switch']").attributes("disabled")).toBe(
      undefined,
    );
    expect(row.text()).not.toContain("once registration has closed");
  });

  it("is locked on once registration has closed", async () => {
    const row = await substitutesSwitch("Live");

    expect(
      row.find("button[role='switch']").attributes("disabled"),
    ).toBeDefined();
    expect(row.text()).toContain("once registration has closed");
  });

  it("can still be turned back on after registration has closed", async () => {
    const row = await substitutesSwitch("Live", false);

    expect(row.find("button[role='switch']").attributes("disabled")).toBe(
      undefined,
    );
  });
});

const LOCKED_LABEL = "Match type and map pool";
const LOCKED = "Match type and map pool are locked once the bracket is drawn.";
const DRAWN_WHILE_EDITING =
  "The bracket was drawn while you were editing. Discard your changes to match type and map pool, then save again.";

type Bracket = {
  team_1?: { id: string } | null;
  team_2?: { id: string } | null;
  match?: { id: string } | null;
};

type Pool = { id: string; type: string; maps: typeof competitiveMaps };

const emptySlot = (): Bracket => ({ team_1: null, team_2: null, match: null });

const seated = (): Bracket => ({
  team_1: { id: "team-a" },
  team_2: null,
  match: null,
});

const customPool: Pool = {
  id: "custom-pool",
  type: "Custom",
  maps: competitiveMaps.slice(0, 5),
};

const idsOf = (maps: Array<{ id: string }>) => maps.map(({ id }) => id);

function drawable(
  status: string,
  {
    pool = customPool,
    brackets = [] as Bracket[],
    type = "Competitive",
    mr = 12,
    regions = [] as string[],
  } = {},
) {
  return {
    id: "tournament-1",
    status,
    auto_start: true,
    scheduling_mode: "auto",
    substitutes_enabled: true,
    stages: [{ id: "stage-1", order: 1, brackets }],
    options: {
      id: "options-1",
      type,
      mr,
      best_of: 1,
      map_veto: true,
      tv_delay: 115,
      veto_pick_timeout: 60,
      region_veto: true,
      regions,
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
  };
}

describe("TournamentMatchOptionsForm match type and map pool lock", () => {
  let unmount: (() => void) | null = null;
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastMock.mockClear();
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
    useApplicationSettingsStore().availableRegions = [];
    vi.restoreAllMocks();
  });

  async function mountForm(tournament: ReturnType<typeof drawable>) {
    const wrapper = await mountSuspended(TournamentMatchOptionsForm, {
      props: { tournament },
      global: {
        mixins: (useNuxtApp().vueApp as any)._context.mixins,
        stubs: { SettingsSaveBar: true },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  type Wrapper = Awaited<ReturnType<typeof mountForm>>;

  const values = (wrapper: Wrapper) => (wrapper.vm as any).form.values;

  function expectLock(wrapper: Wrapper, locked: boolean) {
    expect(wrapper.findComponent(MatchOptions).props("lockMapPool")).toBe(
      locked,
    );
    expect(wrapper.find(`[aria-label="${LOCKED}"]`).exists()).toBe(locked);
    expect(wrapper.text().includes(LOCKED_LABEL)).toBe(locked);
  }

  async function clickMap(wrapper: Wrapper, label: string) {
    const tile = wrapper
      .findAll("div.rounded-lg.overflow-hidden")
      .find((div) => div.text().includes(label));
    expect(tile, `${label} tile`).toBeDefined();
    await tile!.trigger("click");
    await flushPromises();
  }

  async function clickButton(wrapper: Wrapper, text: string) {
    const button = wrapper
      .findAll("button")
      .find((candidate) => candidate.text() === text);
    expect(button, `${text} button`).toBeDefined();
    await button!.trigger("click");
    await flushPromises();
  }

  const customPoolSwitch = (wrapper: Wrapper) =>
    wrapper.get("div.justify-end button[role='switch']");

  type Undrawn = { pool?: Pool; mr?: number };

  const mountUndrawn = (options: Undrawn = {}) =>
    mountForm(
      drawable("RegistrationOpen", { ...options, brackets: [emptySlot()] }),
    );

  async function draw(wrapper: Wrapper, options: Undrawn = {}) {
    await wrapper.setProps({
      tournament: drawable("RegistrationOpen", {
        ...options,
        brackets: [seated()],
      }),
    });
    await flushPromises();
  }

  async function save(wrapper: Wrapper) {
    await (wrapper.vm as any).save();
    await flushPromises();
  }

  async function discard(wrapper: Wrapper) {
    (wrapper.vm as any).discardChanges();
    await flushPromises();
  }

  function expectRefused() {
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: DRAWN_WHILE_EDITING,
      }),
    );
    expect(mutate).not.toHaveBeenCalled();
  }

  function sent(name: string) {
    return mutate.mock.calls
      .map(([options]: [any]) => ({
        body: print(options.mutation),
        variables: options.variables ?? {},
      }))
      .find(({ body }) => body.includes(name));
  }

  it("locks the match type and map pool of a live tournament, and says why", async () => {
    const wrapper = await mountForm(drawable("Live"));

    expectLock(wrapper, true);
  });

  it("locks them while registration is open once a team is in a bracket", async () => {
    const wrapper = await mountForm(
      drawable("RegistrationOpen", { brackets: [emptySlot(), seated()] }),
    );

    expectLock(wrapper, true);
  });

  it("leaves them open in Setup, even with a bracket from an earlier draw", async () => {
    const wrapper = await mountForm(
      drawable("Setup", { brackets: [seated()] }),
    );

    expectLock(wrapper, false);
  });

  it("leaves them open while registration is open and no bracket is filled", async () => {
    const wrapper = await mountForm(
      drawable("RegistrationOpen", { brackets: [emptySlot(), emptySlot()] }),
    );

    expectLock(wrapper, false);
  });

  it("locks them as soon as the bracket is drawn under an open form", async () => {
    const wrapper = await mountUndrawn();
    expectLock(wrapper, false);

    await draw(wrapper);

    expectLock(wrapper, true);
  });

  it("saves a drawn tournament's other match rules on the pool it already has", async () => {
    const wrapper = await mountForm(drawable("Live"));
    (wrapper.vm as any).form.setFieldValue("tv_delay", 30);
    await flushPromises();

    await save(wrapper);

    expect(sent("insert_map_pools_one")).toBeUndefined();
    expect(sent("update_match_options_by_pk")?.variables).toMatchObject({
      id: "options-1",
      tv_delay: 30,
      type: "Competitive",
      map_pool_id: "custom-pool",
    });
  });

  it("keeps a drawn tournament on its seeded pool", async () => {
    const wrapper = await mountForm(
      drawable("Live", { pool: seededPools.Competitive }),
    );

    await save(wrapper);

    expect(sent("insert_map_pools_one")).toBeUndefined();
    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      "seeded-competitive",
    );
  });

  it("saves a drawn tournament on a pool that is neither custom nor its type's seeded one", async () => {
    const pool = { ...customPool, id: "older-pool", type: "Competitive" };
    const wrapper = await mountForm(drawable("Live", { pool }));
    expect(values(wrapper)).toMatchObject({
      custom_map_pool: true,
      map_pool: idsOf(pool.maps),
    });
    (wrapper.vm as any).form.setFieldValue("tv_delay", 30);
    await flushPromises();

    await save(wrapper);

    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
    expect(sent("insert_map_pools_one")).toBeUndefined();
    expect(sent("update_match_options_by_pk")?.variables).toMatchObject({
      tv_delay: 30,
      map_pool_id: "older-pool",
    });
  });

  it("refuses a save that holds a match type picked before the bracket was drawn", async () => {
    const seeded = { pool: seededPools.Competitive };
    const wrapper = await mountUndrawn(seeded);
    await clickButton(wrapper, "Wingman");
    await clickMap(wrapper, "overpass");
    await clickMap(wrapper, "vertigo");

    await draw(wrapper, seeded);
    await save(wrapper);

    expectRefused();
    expect(values(wrapper)).toMatchObject({
      type: "Wingman",
      map_pool: idsOf(wingmanMaps),
    });
    expect((wrapper.vm as any).isDirty).toBe(true);
  });

  it("refuses a save that holds a map toggled before the bracket was drawn", async () => {
    const wrapper = await mountUndrawn();
    await clickMap(wrapper, "nuke");

    await draw(wrapper);
    await save(wrapper);

    expectRefused();
    expect(values(wrapper).map_pool).toHaveLength(6);
  });

  it("refuses a save that holds a custom pool switched off before the bracket was drawn", async () => {
    const wrapper = await mountUndrawn();
    await customPoolSwitch(wrapper).trigger("click");
    await flushPromises();
    expect(values(wrapper).custom_map_pool).toBe(false);

    await draw(wrapper);
    await save(wrapper);

    expectRefused();
  });

  it("refuses a save that holds a custom pool switched on before the bracket was drawn", async () => {
    const seeded = { pool: seededPools.Competitive };
    const wrapper = await mountUndrawn(seeded);
    await customPoolSwitch(wrapper).trigger("click");
    await flushPromises();
    expect(values(wrapper).custom_map_pool).toBe(true);

    await draw(wrapper, seeded);
    await save(wrapper);

    expectRefused();
  });

  it("saves a drawn tournament again once a stale match type is discarded", async () => {
    const saved = { mr: 15 };
    const wrapper = await mountUndrawn(saved);
    await clickButton(wrapper, "Wingman");
    await draw(wrapper, saved);
    await save(wrapper);
    expectRefused();

    await discard(wrapper);
    (wrapper.vm as any).form.setFieldValue("tv_delay", 30);
    await flushPromises();
    toastMock.mockClear();
    await save(wrapper);

    expect(sent("insert_map_pools_one")).toBeUndefined();
    expect(sent("update_match_options_by_pk")?.variables).toMatchObject({
      type: "Competitive",
      mr: "15",
      tv_delay: 30,
      map_pool_id: "custom-pool",
    });
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it.each([
    ["custom", customPool, idsOf(customPool.maps)],
    ["seeded", seededPools.Competitive, []],
  ])(
    "puts the saved type, max rounds and %s pool back when a picked type is discarded",
    async (_kind, pool, selection) => {
      const wrapper = await mountForm(drawable("Setup", { pool, mr: 15 }));
      await save(wrapper);
      const untouched = sent("update_match_options_by_pk")?.variables;
      mutate.mockClear();

      await clickButton(wrapper, "Wingman");
      expect(values(wrapper)).toMatchObject({ type: "Wingman", mr: "8" });
      await discard(wrapper);

      expect(values(wrapper)).toMatchObject({
        type: "Competitive",
        mr: "15",
        custom_map_pool: pool.type === "Custom",
        map_pool_id: pool.id,
        map_pool: selection,
      });
      expect((wrapper.vm as any).isDirty).toBe(false);

      await save(wrapper);

      expect(sent("insert_map_pools_one")).toBeUndefined();
      expect(sent("update_match_options_by_pk")?.variables).toEqual(untouched);
      expect(untouched).toMatchObject({ mr: "15", map_pool_id: pool.id });
    },
  );

  it("puts the saved regions back when a region veto change is discarded", async () => {
    useApplicationSettingsStore().availableRegions = [
      { value: "eu", description: "Europe", is_lan: false },
      { value: "na", description: "North America", is_lan: false },
    ] as ReturnType<typeof useApplicationSettingsStore>["availableRegions"];
    const wrapper = await mountForm(
      drawable("Setup", { regions: ["eu", "na"] }),
    );
    (wrapper.vm as any).form.setFieldValue("region_veto", false);
    await flushPromises();
    expect(values(wrapper).regions).toEqual(["eu"]);

    await discard(wrapper);

    expect(values(wrapper)).toMatchObject({
      region_veto: true,
      regions: ["eu", "na"],
    });
    expect((wrapper.vm as any).isDirty).toBe(false);
  });

  it("shows a tournament whose type, max rounds and pool changed under a clean form", async () => {
    const wrapper = await mountForm(drawable("Setup"));
    const pool = { ...customPool, id: "wingman-pool", maps: wingmanMaps };

    await wrapper.setProps({
      tournament: drawable("Setup", { pool, type: "Wingman", mr: 12 }),
    });
    await flushPromises();

    expect(values(wrapper)).toMatchObject({
      type: "Wingman",
      mr: "12",
      custom_map_pool: true,
      map_pool_id: "wingman-pool",
      map_pool: idsOf(wingmanMaps),
    });
    expect((wrapper.vm as any).isDirty).toBe(false);
  });

  it.each([1, 2, 3])(
    "ends on the latest tournament when it changes again mid-reload, %i microtask(s) in",
    async (microtasks) => {
      const saved = drawable("Setup", { mr: 15 });
      const wrapper = await mountForm(saved);
      const pool = { ...customPool, id: "wingman-pool", maps: wingmanMaps };

      wrapper.setProps({
        tournament: drawable("Setup", { pool, type: "Wingman", mr: 12 }),
      });
      for (let tick = 0; tick < microtasks; tick++) {
        await Promise.resolve();
      }
      wrapper.setProps({ tournament: saved });
      await flushPromises();

      expect(values(wrapper)).toMatchObject({
        type: "Competitive",
        mr: "15",
        custom_map_pool: true,
        map_pool_id: "custom-pool",
        map_pool: idsOf(customPool.maps),
      });
      expect((wrapper.vm as any).isDirty).toBe(false);
    },
  );

  it("reuses the custom pool when an undrawn tournament is saved with the same maps", async () => {
    const wrapper = await mountForm(drawable("Setup"));
    (wrapper.vm as any).form.setFieldValue("tv_delay", 30);
    await flushPromises();

    await save(wrapper);

    expect(sent("insert_map_pools_one")).toBeUndefined();
    expect(sent("update_match_options_by_pk")?.variables).toMatchObject({
      tv_delay: 30,
      map_pool_id: "custom-pool",
    });
  });

  it("reuses the custom pool when the same maps are picked in another order", async () => {
    const wrapper = await mountForm(drawable("Setup"));
    await clickMap(wrapper, "ancient");
    await clickMap(wrapper, "ancient");
    expect(values(wrapper).map_pool).not.toEqual(idsOf(customPool.maps));
    expect([...values(wrapper).map_pool].sort()).toEqual(
      idsOf(customPool.maps).sort(),
    );

    await save(wrapper);

    expect(sent("insert_map_pools_one")).toBeUndefined();
    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      "custom-pool",
    );
  });

  it("saves a new custom pool once the selected maps change", async () => {
    const wrapper = await mountForm(drawable("Setup"));
    await clickMap(wrapper, "nuke");

    await save(wrapper);

    expect(
      idsOf(sent("insert_map_pools_one")?.variables.map_pool.maps.data),
    ).toEqual([...idsOf(customPool.maps), "map-de_nuke"]);
    expect(sent("insert_map_pools_one")?.variables.map_pool.type).toBe(
      "Custom",
    );
    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      "new-pool",
    );
  });

  it("saves a new custom pool when the selection shrinks to maps the old pool had", async () => {
    const wrapper = await mountForm(drawable("Setup"));
    await clickMap(wrapper, "mirage");

    await save(wrapper);

    expect(
      idsOf(sent("insert_map_pools_one")?.variables.map_pool.maps.data),
    ).toEqual(idsOf(customPool.maps.slice(0, 4)));
    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      "new-pool",
    );
  });

  it("saves a new custom pool on a switch from the seeded pool, even to the same maps", async () => {
    const wrapper = await mountForm(
      drawable("Setup", { pool: seededPools.Competitive }),
    );
    expect(values(wrapper).custom_map_pool).toBe(false);

    await customPoolSwitch(wrapper).trigger("click");
    await flushPromises();
    for (const { label } of competitiveMaps) {
      await clickMap(wrapper, label);
    }

    await save(wrapper);

    expect(
      idsOf(sent("insert_map_pools_one")?.variables.map_pool.maps.data),
    ).toEqual(idsOf(competitiveMaps));
    expect(sent("update_match_options_by_pk")?.variables.map_pool_id).toBe(
      "new-pool",
    );
  });
});
