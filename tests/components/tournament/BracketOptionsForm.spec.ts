import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import BracketOptionsForm from "~/components/tournament/BracketOptionsForm.vue";
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

const options = (id: string) => ({
  id,
  type: "Competitive",
  mr: 15,
  best_of: 1,
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
  map_pool_id: seededPools.Competitive.id,
  map_pool: seededPools.Competitive,
});

describe("BracketOptionsForm", () => {
  let unmount: (() => void) | null = null;
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useAuthStore().me = {
      steam_id: "76561198000000001",
      role: e_player_roles_enum.administrator,
    } as any;
    answerMatchOptionsQueries();
    mutate = vi.fn().mockImplementation(async ({ mutation }: any) =>
      print(mutation).includes("clone_tournament_bracket_options")
        ? {
            data: {
              clone_tournament_bracket_options: [
                { match_options_id: "own-options" },
              ],
            },
          }
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
    useAuthStore().me = undefined;
    vi.restoreAllMocks();
  });

  async function mountForm(bracket: Record<string, unknown>) {
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "query",
    ).mockResolvedValue({ data: { tournament_brackets_by_pk: bracket } });
    const wrapper = await mountSuspended(BracketOptionsForm, {
      props: { bracketId: "bracket-1" },
      global: {
        mixins: (useNuxtApp().vueApp as any)._context.mixins,
        stubs: { SettingsSaveBar: true },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  const sent = () =>
    mutate.mock.calls.map(([call]: [any]) => ({
      body: print(call.mutation),
      variables: call.variables ?? {},
    }));

  const inheriting = {
    match_options_id: null,
    options: null,
    stage: {
      options: null,
      tournament: { options: options("tournament-options") },
    },
  };

  it("copies the stage's settings onto the bracket on the first save, then writes only what is open", async () => {
    const wrapper = await mountForm(inheriting);

    (wrapper.vm as any).form.setFieldValue("mr", "8");
    (wrapper.vm as any).form.setFieldValue("ready_setting", "Admin");
    await flushPromises();
    await (wrapper.vm as any).save();
    await flushPromises();

    const calls = sent();
    expect(calls[0].body).toContain("clone_tournament_bracket_options");
    expect(calls[0].variables).toEqual({ bracketId: "bracket-1" });
    const update = calls.find(({ body }) =>
      body.includes("update_match_options_by_pk("),
    );
    expect(update?.variables).toMatchObject({
      id: "own-options",
      ready_setting: "Admin",
    });
    for (const column of ["mr", "type", "best_of", "map_pool_id"]) {
      expect(update?.variables).not.toHaveProperty(column);
      expect(update?.body).not.toContain(`${column}:`);
    }
  });

  it("edits the bracket's own settings in place", async () => {
    const wrapper = await mountForm({
      match_options_id: "own-options",
      options: options("own-options"),
      stage: { options: null, tournament: { options: options("t") } },
    });

    (wrapper.vm as any).form.setFieldValue("tv_delay", 30);
    await flushPromises();
    await (wrapper.vm as any).save();
    await flushPromises();

    const calls = sent();
    expect(
      calls.some(({ body }) =>
        body.includes("clone_tournament_bracket_options"),
      ),
    ).toBe(false);
    expect(
      calls.find(({ body }) => body.includes("update_match_options_by_pk("))
        ?.variables,
    ).toMatchObject({ id: "own-options", tv_delay: 30 });
  });

  it("offers the stage's settings back only to a bracket with its own", async () => {
    const inherited = await mountForm(inheriting);
    expect(inherited.text()).not.toContain("Use stage settings");
    inherited.unmount();

    const own = await mountForm({
      match_options_id: "own-options",
      options: options("own-options"),
      stage: { options: null, tournament: { options: options("t") } },
    });
    await own
      .findAll("button")
      .find((button) => button.text() === "Use stage settings")!
      .trigger("click");
    await flushPromises();

    expect(
      sent().find(({ body }) => body.includes("update_tournament_brackets_by_pk"))
        ?.body,
    ).toContain("match_options_id: null");
  });
});
