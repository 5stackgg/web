import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { valueFromASTUntyped } from "graphql";
import type {
  DocumentNode,
  FieldNode,
  OperationDefinitionNode,
} from "graphql";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const ME = "76561198000000001";
const SOMEONE_ELSE = "76561198000000002";
const LEAVES_POOL =
  "You're signed up as a free agent. Registering a team takes you out of the free agent pool.";
const KEEP_PERMANENT = "Keep as a Permanent Team";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  toast.mockReset();
  vi.restoreAllMocks();
});

async function mountJoinForm(options: {
  isOrganizer?: boolean;
  canJoin?: boolean;
  tournamentOwners: string[];
  rostered?: string[];
  myFreeAgent?: Record<string, unknown>;
}) {
  useAuthStore().me = {
    steam_id: ME,
    name: "Player",
    role: e_player_roles_enum.user,
    teams: [
      { id: "mine", name: "Mine", owner_steam_id: ME },
      { id: "theirs", name: "Theirs", owner_steam_id: SOMEONE_ELSE },
    ],
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(TournamentJoinForm, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "RegistrationOpen",
        can_join: options.canJoin ?? true,
        is_organizer: options.isOrganizer ?? false,
        min_players_per_lineup: 5,
        teams: options.tournamentOwners.map((owner, index) => ({
          id: `entry-${index}`,
          team_id: `registered-${index}`,
          owner_steam_id: owner,
          roster:
            index === 0
              ? (options.rostered ?? []).map((steam_id) => ({
                  player: { steam_id },
                }))
              : [],
        })),
      },
      myFreeAgent: options.myFreeAgent ?? null,
    },
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: { TeamSearch: true },
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

async function startNewTeam(
  wrapper: Awaited<ReturnType<typeof mountJoinForm>>,
  values: Record<string, unknown> = {},
) {
  const vm = wrapper.vm as any;
  vm.form.setFieldValue("new_team", true);
  await flushPromises();
  for (const [field, value] of Object.entries(values)) {
    vm.form.setFieldValue(field, value);
  }
  await flushPromises();
  return vm;
}

async function clickKeepPermanent(
  wrapper: Awaited<ReturnType<typeof mountJoinForm>>,
) {
  const card = wrapper
    .findAll("div.cursor-pointer")
    .find((element) => element.text().includes(KEEP_PERMANENT));
  expect(card, "Keep as a Permanent Team switch").toBeDefined();
  await card!.trigger("click");
  await flushPromises();
}

function serve(existingTeams: Array<{ id: string }> = []) {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  const mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(client, "mutate").mockImplementation(mutate);
  vi.spyOn(client, "query").mockResolvedValue({
    data: { teams: existingTeams },
  });
  return mutate;
}

async function registeredEntry(
  wrapper: Awaited<ReturnType<typeof mountJoinForm>>,
  values: Record<string, unknown>,
  permanent = false,
) {
  const mutate = serve();

  const vm = await startNewTeam(wrapper, values);
  if (permanent) {
    await clickKeepPermanent(wrapper);
  }
  await vm.joinTournament();
  await flushPromises();

  expect(mutate).toHaveBeenCalledTimes(1);
  const document = mutate.mock.calls[0][0].mutation as DocumentNode;
  const operation = document.definitions[0] as OperationDefinitionNode;
  const insert = operation.selectionSet.selections[0] as FieldNode;
  const object = insert.arguments?.find((arg) => arg.name.value === "object");
  return valueFromASTUntyped(object!.value) as Record<string, any>;
}

function ineligible(wrapper: Awaited<ReturnType<typeof mountJoinForm>>) {
  return wrapper.findComponent(TeamSearch).props("ineligible") as Record<
    string,
    string
  >;
}

describe("TournamentJoinForm", () => {
  it("offers a new team to a player who has no team in the tournament", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [SOMEONE_ELSE] });

    expect(wrapper.text()).toContain("Create New Team");
    expect(ineligible(wrapper).mine).toBeUndefined();
    expect(wrapper.text()).not.toContain(LEAVES_POOL);
  });

  it("tells a free agent that registering a team takes them out of the pool", async () => {
    const wrapper = await mountJoinForm({
      tournamentOwners: [SOMEONE_ELSE],
      myFreeAgent: { id: "agent-1", status: "registered" },
    });

    expect(wrapper.text()).toContain("Create New Team");
    expect(wrapper.text()).toContain(LEAVES_POOL);
  });

  it("lets a player who owns a team here enter another they own", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [ME] });

    expect(wrapper.text()).toContain("Create New Team");
    expect(ineligible(wrapper).mine).toBeUndefined();
    expect(ineligible(wrapper).theirs).toBeUndefined();
  });

  it("offers a managed team whose owner already has a team here", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [SOMEONE_ELSE] });

    expect(ineligible(wrapper).theirs).toBeUndefined();
  });

  it("does not offer a new team to a player already on a roster here", async () => {
    const wrapper = await mountJoinForm({
      tournamentOwners: [SOMEONE_ELSE],
      rostered: [ME],
    });

    expect(wrapper.text()).not.toContain("Create New Team");
    expect(ineligible(wrapper).mine).toBeUndefined();
  });

  it("lets an organizer add as many teams as they need", async () => {
    const wrapper = await mountJoinForm({
      isOrganizer: true,
      tournamentOwners: [ME, SOMEONE_ELSE],
    });

    expect(wrapper.text()).toContain("Create New Team");
    expect(ineligible(wrapper)).toEqual({
      "registered-0": "Already entered in this tournament.",
      "registered-1": "Already entered in this tournament.",
    });
  });

  it("offers to keep a new team the registrant plays on", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [SOMEONE_ELSE] });

    await startNewTeam(wrapper);

    expect(wrapper.text()).toContain(KEEP_PERMANENT);
  });

  it("does not offer it when the registrant cannot play on the team", async () => {
    const wrapper = await mountJoinForm({
      tournamentOwners: [SOMEONE_ELSE],
      canJoin: false,
    });

    await startNewTeam(wrapper);

    expect(wrapper.text()).toContain("Create New Team");
    expect(wrapper.text()).not.toContain(KEEP_PERMANENT);
  });

  it("does not offer it for a team an organizer builds for another player", async () => {
    const wrapper = await mountJoinForm({
      isOrganizer: true,
      tournamentOwners: [],
    });

    await startNewTeam(wrapper);

    expect(wrapper.text()).not.toContain(KEEP_PERMANENT);
  });

  it("creates the permanent team in the same insert that enters it", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [SOMEONE_ELSE] });

    const entry = await registeredEntry(
      wrapper,
      { team_name: "Ultima Ratio" },
      true,
    );

    expect(entry.team).toEqual({
      data: { name: "Ultima Ratio", short_name: "UR" },
    });
    expect(entry).not.toHaveProperty("team_id");
    expect(entry).not.toHaveProperty("name");
    expect(entry.captain_steam_id).toBe(ME);
    expect(entry.roster.data).toEqual([
      expect.objectContaining({ player_steam_id: ME }),
    ]);
  });

  it("keeps a new team tournament-only unless asked", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [SOMEONE_ELSE] });

    const entry = await registeredEntry(wrapper, {
      team_name: "Ultima Ratio",
    });

    expect(entry).not.toHaveProperty("team");
    expect(entry.team_id).toBeNull();
    expect(entry.name).toBe("Ultima Ratio");
    expect(entry.short_name).toBe("UR");
  });

  it("stops before saving when another team already has the name", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [SOMEONE_ELSE] });
    const mutate = serve([{ id: "taken" }]);
    const vm = await startNewTeam(wrapper, { team_name: "Mix" });
    await clickKeepPermanent(wrapper);

    await vm.joinTournament();
    await flushPromises();

    expect(mutate).not.toHaveBeenCalled();
    expect(vm.form.errors.team_name).toBe(
      "A team called Mix already exists. Pick another name, or turn off Keep as a Permanent Team.",
    );
  });
});
