import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: toastMock,
}));

const LOCKED = "Type, teams and groups are locked once the bracket is drawn.";
const MATCH_SETTINGS_LOCKED =
  "Match settings are locked once this stage has matches.";
const MATCH_SETTINGS_LOCKED_BUT_MODE =
  "Match settings are locked once this stage has matches. Match mode can still change.";
const DRAWN_WHILE_EDITING =
  "The bracket was drawn while you were editing. Discard the changes that are now locked, then save again.";
const MATCHES_DRAWN =
  "This stage's matches are already drawn, so its match settings can't change.";

const tournamentOptions = {
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
  map_pool: {
    id: "pool-1",
    type: "Competitive",
    maps: [
      "de_ancient",
      "de_anubis",
      "de_dust2",
      "de_inferno",
      "de_mirage",
      "de_nuke",
      "de_train",
    ].map((name) => ({
      id: `map-${name}`,
      name,
      label: null,
      type: "Competitive",
    })),
  },
};

const stage = (options: Record<string, unknown> | null) => ({
  id: "stage-1",
  order: 1,
  type: "SingleElimination",
  groups: 1,
  min_teams: 8,
  max_teams: 8,
  default_best_of: 1,
  third_place_match: false,
  decider_best_of: null,
  max_rounds: null,
  swiss_no_elimination: false,
  final_map_advantage: 0,
  settings: { round_best_of: {} },
  options,
});

let unmount: (() => void) | null = null;
let mutate: ReturnType<typeof vi.fn>;
let query: ReturnType<typeof vi.fn>;

const noMatches = { data: { tournament_brackets: [] } };
const aMatch = { data: { tournament_brackets: [{ id: "bracket-1" }] } };

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Organizer",
    role: e_player_roles_enum.administrator,
  } as ReturnType<typeof useAuthStore>["me"];
  // Under mountSuspended this component's `this.$apollo` is the nuxt
  // `{ clients, defaultClient }` object, not vue-apollo's, so the form's
  // `this.$apollo.mutate` is given one here.
  mutate = vi.fn(async ({ mutation }: { mutation: any }) =>
    print(mutation).includes("insert_match_options_one")
      ? { data: { insert_match_options_one: { id: "new-options" } } }
      : { data: {} },
  );
  query = vi.fn().mockResolvedValue(noMatches);
  toastMock.mockClear();
  (useNuxtApp() as any).$apollo.mutate = mutate;
  (useNuxtApp() as any).$apollo.query = query;
});

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  delete (useNuxtApp() as any).$apollo.mutate;
  delete (useNuxtApp() as any).$apollo.query;
});

const poolOf = (id: string, count: number) => ({
  id,
  type: "Custom",
  maps: tournamentOptions.map_pool.maps.slice(0, count),
});

const ownPoolOptions = (count: number) => ({
  ...tournamentOptions,
  id: "stage-options-1",
  map_pool_id: "stage-pool",
  map_pool: poolOf("stage-pool", count),
});

async function mountLocked(
  structureLocked: boolean,
  options: Record<string, unknown> | null = null,
  tournamentMaps = 7,
) {
  const wrapper = await mountSuspended(TournamentStageForm, {
    props: {
      order: 1,
      stage: stage(options),
      structureLocked,
      tournament: {
        id: "tournament-1",
        status: "Paused",
        options: {
          ...tournamentOptions,
          map_pool: poolOf("pool-1", tournamentMaps),
        },
        stages: [stage(options)],
      },
    },
    global: { stubs: { SettingsSaveBar: true } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountLocked>>;

const sentCalls = () =>
  mutate.mock.calls.map(([options]: any) => ({
    document: print(options.mutation),
    variables: options.variables,
  }));

async function saveBestOf(wrapper: Wrapper) {
  (wrapper.vm as any).form.setFieldValue("default_best_of", "3");
  await flushPromises();
  await (wrapper.vm as any).updateCreateStage();
  await flushPromises();
  return sentCalls();
}

async function saveMatchMode(wrapper: Wrapper, mode: string) {
  (wrapper.vm as any).form.setFieldValue("match_mode", mode);
  await flushPromises();
  await (wrapper.vm as any).updateCreateStage();
  await flushPromises();
  return sentCalls();
}

const disabledFieldsetWith = (wrapper: Wrapper, text: string) =>
  wrapper
    .findAll("fieldset[disabled]")
    .some((fieldset) => fieldset.text().includes(text));

const matchModeFieldset = (wrapper: Wrapper) =>
  wrapper
    .findAll("fieldset")
    .find(
      (fieldset) =>
        fieldset.text().includes("Match Mode") &&
        !fieldset.text().includes("TV Delay"),
    );

describe("TournamentStageForm with the structure locked", () => {
  it("disables the type, team counts and groups and says why", async () => {
    const wrapper = await mountLocked(true);
    const locked = wrapper.findAll("fieldset[disabled]");

    expect(locked.length).toBeGreaterThan(0);
    expect(locked[0].text()).toContain("Minimum Teams");
    expect(locked[0].text()).toContain("Maximum Teams");
    expect(
      wrapper.find("input[name='groups']").element.closest("fieldset[disabled]"),
    ).not.toBeNull();
    expect(wrapper.find(`[aria-label="${LOCKED}"]`).exists()).toBe(true);
  });

  it("leaves the match settings open while the stage has no matches", async () => {
    const wrapper = await mountLocked(true);

    expect(query).toHaveBeenCalled();
    expect(disabledFieldsetWith(wrapper, "TV Delay")).toBe(false);
    expect(matchModeFieldset(wrapper)?.attributes("disabled")).toBeUndefined();
    expect(
      wrapper.find(`[aria-label="${MATCH_SETTINGS_LOCKED}"]`).exists(),
    ).toBe(false);
  });

  it("locks the match settings once the stage has a match, and says why", async () => {
    query.mockResolvedValue(aMatch);
    const wrapper = await mountLocked(true);

    expect(
      wrapper.find(`[aria-label="${MATCH_SETTINGS_LOCKED}"]`).exists(),
    ).toBe(true);
    expect(
      wrapper.find("fieldset[disabled]").element.textContent,
    ).not.toContain("TV Delay");
    expect(disabledFieldsetWith(wrapper, "TV Delay")).toBe(true);
    expect(matchModeFieldset(wrapper)?.attributes("disabled")).toBeDefined();
  });

  it("keeps the match mode of a started stage with its own options editable", async () => {
    query.mockResolvedValue(aMatch);
    const wrapper = await mountLocked(true, {
      ...tournamentOptions,
      id: "stage-options-1",
      match_mode: "admin",
    });

    expect(
      wrapper.find(`[aria-label="${MATCH_SETTINGS_LOCKED_BUT_MODE}"]`).exists(),
    ).toBe(true);
    expect(disabledFieldsetWith(wrapper, "TV Delay")).toBe(true);
    expect(matchModeFieldset(wrapper)?.attributes("disabled")).toBeUndefined();
  });

  it("switches a drawn stage's own options to Auto in place and keeps its pool", async () => {
    const wrapper = await mountLocked(true, {
      ...ownPoolOptions(7),
      match_mode: "admin",
    });
    const calls = await saveMatchMode(wrapper, "auto");

    expect(toastMock).not.toHaveBeenCalled();
    expect(calls).toHaveLength(2);
    expect(calls[0].document).toContain("update_match_options_by_pk");
    expect(calls[0].variables).toMatchObject({
      id: "stage-options-1",
      match_mode: "auto",
    });
    expect(calls[0].variables).not.toHaveProperty("map_pool_id");
    expect(calls[0].variables).not.toHaveProperty("type");
    expect(calls[1].document).toContain("update_tournament_stages_by_pk");
    expect(calls[1].document).not.toContain("match_options_id");
    expect(wrapper.emitted("updated")).toHaveLength(1);
  });

  it("switches the match mode of a started stage with its own options", async () => {
    query.mockResolvedValue(aMatch);
    const wrapper = await mountLocked(true, {
      ...tournamentOptions,
      id: "stage-options-1",
      match_mode: "admin",
    });
    const calls = await saveMatchMode(wrapper, "auto");

    expect(toastMock).not.toHaveBeenCalled();
    expect(calls[0].variables).toMatchObject({
      id: "stage-options-1",
      match_mode: "auto",
    });
    expect(wrapper.emitted("updated")).toHaveLength(1);
  });

  it("gives a drawn stage with no matches options of its own on the tournament's pool", async () => {
    const wrapper = await mountLocked(true);
    const calls = await saveMatchMode(wrapper, "admin");

    expect(toastMock).not.toHaveBeenCalled();
    expect(calls).toHaveLength(2);
    expect(calls[0].document).toContain("insert_match_options_one");
    expect(calls[0].variables).toMatchObject({
      match_mode: "admin",
      map_pool_id: "pool-1",
      type: "Competitive",
    });
    expect(calls[1].document).toContain("update_tournament_stages_by_pk");
    expect(calls[1].document).toContain('match_options_id: "new-options"');
  });

  it("refuses options of its own for a stage whose first match was drawn meanwhile", async () => {
    const wrapper = await mountLocked(true);
    query.mockResolvedValue(aMatch);
    const calls = await saveMatchMode(wrapper, "admin");

    expect(calls).toHaveLength(0);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: MATCHES_DRAWN }),
    );
    expect(wrapper.emitted("updated")).toBeUndefined();
  });

  it("refuses a match settings change made before the stage started", async () => {
    const wrapper = await mountLocked(true);
    (wrapper.vm as any).form.setFieldValue("tv_delay", 30);
    await flushPromises();

    query.mockResolvedValue(aMatch);
    await (wrapper.vm as any).refreshStageStarted();
    await (wrapper.vm as any).updateCreateStage();
    await flushPromises();

    expect(mutate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: DRAWN_WHILE_EDITING }),
    );
  });

  it("keeps the default best-of editable", async () => {
    const wrapper = await mountLocked(true);
    const bestOf = wrapper
      .findAll("button[role='combobox']")
      .find((trigger) => trigger.text().includes("Best of 1"));

    expect(bestOf).toBeDefined();
    expect(bestOf!.element.closest("fieldset[disabled]")).toBeNull();
  });

  it("saves only the best-of fields", async () => {
    const wrapper = await mountLocked(true);
    const calls = await saveBestOf(wrapper);

    expect(calls).toHaveLength(1);
    expect(calls[0].document).toContain("update_tournament_stages_by_pk");
    expect(calls[0].document).toContain("default_best_of: 3");
    expect(calls[0].document).toContain("settings");
    for (const field of [
      "groups",
      "min_teams",
      "max_teams",
      "type:",
      "order:",
      "third_place_match",
      "decider_best_of",
      "final_map_advantage",
      "match_options_id",
    ]) {
      expect(calls[0].document).not.toContain(field);
    }
  });

  it("refuses to drop structural edits made before the lock, and keeps the form open", async () => {
    const wrapper = await mountLocked(false);
    (wrapper.vm as any).form.setFieldValue("max_teams", "16");
    (wrapper.vm as any).form.setFieldValue("default_best_of", "3");
    await flushPromises();

    await wrapper.setProps({ structureLocked: true });
    await (wrapper.vm as any).updateCreateStage();
    await flushPromises();

    expect(mutate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: DRAWN_WHILE_EDITING }),
    );
    expect(wrapper.emitted("updated")).toBeUndefined();
    expect((wrapper.vm as any).form.values.max_teams).toBe("16");
    expect((wrapper.vm as any).isDirty).toBe(true);
  });

  it("saves the best-of of a stage that still holds a pool of its own, and leaves that pool alone", async () => {
    const wrapper = await mountLocked(true, ownPoolOptions(3));
    const calls = await saveBestOf(wrapper);

    expect(toastMock).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0].document).toContain("default_best_of: 3");
    expect(calls[0].document).not.toContain("match_options");
    expect(calls[0].document).not.toContain("map_pool");
  });

  it("refuses a best of 3 the stage's own two-map pool can't play, and names that pool", async () => {
    const reason =
      "Best of 3 needs at least 3 maps. This stage's map pool has 2.";
    const wrapper = await mountLocked(true, ownPoolOptions(2));
    const calls = await saveBestOf(wrapper);

    expect(calls).toHaveLength(0);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: reason }),
    );
    const bar = wrapper.findComponent(SettingsSaveBar);
    expect(bar.props("invalid")).toBe(true);
    expect(bar.props("invalidReason")).toBe(reason);
  });

  it("saves a best of 3 the stage's own seven-map pool can play, whatever the tournament's holds", async () => {
    const wrapper = await mountLocked(true, ownPoolOptions(7), 2);
    const calls = await saveBestOf(wrapper);

    expect(toastMock).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SettingsSaveBar).props("invalid")).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].document).toContain("default_best_of: 3");
    expect(calls[0].document).not.toContain("match_options");
  });

  it("names the tournament's pool when the stage's options row holds it", async () => {
    const wrapper = await mountLocked(
      true,
      {
        ...tournamentOptions,
        id: "stage-options-1",
        map_pool: poolOf("pool-1", 2),
      },
      2,
    );
    const calls = await saveBestOf(wrapper);

    expect(calls).toHaveLength(0);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "Best of 3 needs at least 3 maps. The tournament's map pool has 2.",
      }),
    );
  });

  it("saves the best-of once the structural edits are discarded", async () => {
    const wrapper = await mountLocked(false);
    (wrapper.vm as any).form.setFieldValue("max_teams", "16");
    await flushPromises();
    await wrapper.setProps({ structureLocked: true });

    (wrapper.vm as any).discardChanges();
    await flushPromises();
    (wrapper.vm as any).form.setFieldValue("default_best_of", "3");
    await flushPromises();
    await (wrapper.vm as any).updateCreateStage();
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("updated")).toHaveLength(1);
  });

  it("leaves the stage's own match options alone", async () => {
    const wrapper = await mountLocked(true, {
      ...tournamentOptions,
      id: "stage-options-1",
    });
    const calls = await saveBestOf(wrapper);

    expect(calls).toHaveLength(1);
    expect(calls[0].document).not.toContain("match_options");
  });

  it("saves the whole stage when the structure is open", async () => {
    const wrapper = await mountLocked(false);

    expect(wrapper.find("fieldset[disabled]").exists()).toBe(false);
    expect(wrapper.find(`[aria-label="${LOCKED}"]`).exists()).toBe(false);

    const calls = await saveBestOf(wrapper);
    const update = calls.find((call) =>
      call.document.includes("update_tournament_stages_by_pk"),
    );

    expect(update?.document).toContain("groups");
    expect(update?.document).toContain("max_teams");
  });
});
