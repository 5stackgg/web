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

const LOCKED =
  "Type, teams and groups are locked once the bracket is drawn. Best-of can still change.";
const MATCH_SETTINGS_LOCKED =
  "Match settings are locked once the bracket is drawn.";
const DRAWN_WHILE_EDITING =
  "The bracket was drawn while you were editing. Discard your changes to type, teams, groups or match settings, then save the best-of.";

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

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Organizer",
    role: e_player_roles_enum.administrator,
  } as ReturnType<typeof useAuthStore>["me"];
  // Under mountSuspended this component's `this.$apollo` is the nuxt
  // `{ clients, defaultClient }` object, not vue-apollo's, so the form's
  // `this.$apollo.mutate` is given one here.
  mutate = vi.fn().mockResolvedValue({ data: {} });
  toastMock.mockClear();
  (useNuxtApp() as any).$apollo.mutate = mutate;
});

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  delete (useNuxtApp() as any).$apollo.mutate;
});

async function mountLocked(
  structureLocked: boolean,
  options: Record<string, unknown> | null = null,
) {
  const wrapper = await mountSuspended(TournamentStageForm, {
    props: {
      order: 1,
      stage: stage(options),
      structureLocked,
      tournament: {
        id: "tournament-1",
        status: "Paused",
        options: tournamentOptions,
        stages: [stage(options)],
      },
    },
    global: { stubs: { SettingsSaveBar: true } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

async function saveBestOf(wrapper: Awaited<ReturnType<typeof mountLocked>>) {
  (wrapper.vm as any).form.setFieldValue("default_best_of", "3");
  await flushPromises();
  await (wrapper.vm as any).updateCreateStage();
  await flushPromises();
  return mutate.mock.calls.map(([options]: any) => ({
    document: print(options.mutation),
    variables: options.variables,
  }));
}

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

  it("says the match settings are locked too", async () => {
    const wrapper = await mountLocked(true);
    const matchSettings = wrapper.find(
      `[aria-label="${MATCH_SETTINGS_LOCKED}"]`,
    );

    expect(matchSettings.exists()).toBe(true);
    expect(
      wrapper.find("fieldset[disabled]").element.textContent,
    ).not.toContain("TV Delay");
    expect(
      wrapper
        .findAll("fieldset[disabled]")
        .some((fieldset) => fieldset.text().includes("TV Delay")),
    ).toBe(true);
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
    const wrapper = await mountLocked(true, {
      ...tournamentOptions,
      id: "stage-options-1",
      map_pool_id: "stage-pool",
      map_pool: {
        id: "stage-pool",
        type: "Custom",
        maps: tournamentOptions.map_pool.maps.slice(0, 3),
      },
    });
    const calls = await saveBestOf(wrapper);

    expect(toastMock).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0].document).toContain("default_best_of: 3");
    expect(calls[0].document).not.toContain("match_options");
    expect(calls[0].document).not.toContain("map_pool");
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
