import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: vi.fn(),
}));

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;
let query: ReturnType<typeof vi.fn>;

const loadedMatch = {
  id: "match-1",
  status: "Scheduled",
  is_tournament_match: true,
  lineup_1: { id: "lineup-1", team_id: "team-1" },
  lineup_2: { id: "lineup-2", team_id: "team-2" },
  options: {
    id: "options-1",
    type: "Competitive",
    mr: 12,
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
    number_of_substitutes: 0,
    map_pool_id: "pool-1",
    map_pool: { id: "pool-1", type: "Competitive", maps: [] },
  },
};

function bracket(status: string) {
  return {
    id: "bracket-1",
    round: 1,
    match_number: 1,
    group: 1,
    path: "WB",
    bye: false,
    finished: false,
    team_1_seed: 1,
    team_2_seed: 8,
    team_1: { id: "tt-1", name: "Iron Wolves" },
    team_2: { id: "tt-2", name: "Night Owls" },
    feeding_brackets: [],
    parent_bracket: null,
    loser_bracket: null,
    match: {
      id: "match-1",
      status,
      lineup_1_id: "lineup-1",
      lineup_2_id: "lineup-2",
      match_maps: [],
    },
  };
}

async function mountCard(
  status: string,
  value: Record<string, unknown> = bracket(status),
) {
  wrapper = await mountSuspended(TournamentMatch, {
    props: {
      round: 1,
      brackets: [value] as any,
      stage: { type: "SingleElimination", max_teams: 8, groups: 1 },
      tournament: { is_organizer: true, status: "Live" },
    },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

async function openMenu() {
  document
    .querySelector<HTMLElement>("button[aria-haspopup=menu]")!
    .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await flushPromises();
}

const menuItem = (label: string) =>
  Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((item) => item.textContent?.includes(label));

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role: e_player_roles_enum.user,
  } as any;
  query = vi.fn().mockImplementation(async ({ variables }: any) =>
    variables.bracketId
      ? {
          data: {
            tournament_brackets_by_pk: {
              match_options_id: null,
              options: null,
              stage: {
                options: null,
                tournament: { options: loadedMatch.options },
              },
            },
          },
        }
      : { data: { matches_by_pk: loadedMatch } },
  );
  (useNuxtApp() as any).$apollo.query = query;
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  useAuthStore().me = undefined;
  delete (useNuxtApp() as any).$apollo.query;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("bracket match settings", () => {
  it.each(["PickingPlayers", "Scheduled", "WaitingForCheckIn"])(
    "offers an organizer the settings of a %s match",
    async (status) => {
      await mountCard(status);
      await openMenu();

      expect(menuItem("Match Settings")).toBeDefined();
      expect(menuItem("Reset winner")).toBeDefined();
    },
  );

  it.each(["Veto", "WaitingForServer", "Live", "Finished"])(
    "leaves them to the match page once the match is %s",
    async (status) => {
      await mountCard(status);
      await openMenu();

      expect(menuItem("Match Settings")).toBeUndefined();
      expect(menuItem("Reset winner")).toBeDefined();
    },
  );

  async function openSettings() {
    await openMenu();
    menuItem("Match Settings")!.click();
    await flushPromises();
    return document.body.querySelector('[role="dialog"]');
  }

  it("opens them beside the bracket, for that match, with its rules locked", async () => {
    await mountCard("Scheduled");
    const sheet = await openSettings();

    expect(sheet?.textContent).toContain("Match Settings");
    expect(sheet?.textContent).toContain("Iron Wolves vs Night Owls");
    expect(sheet?.textContent).toContain("Rules locked");
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { matchId: "match-1" } }),
    );
  });

  it("offers an organizer the settings of a bracket still waiting for its teams", async () => {
    await mountCard("Scheduled", {
      ...bracket("Scheduled"),
      team_1: null,
      team_2: null,
      match: null,
    });
    const sheet = await openSettings();

    expect(sheet?.textContent).toContain("Match Settings");
    expect(sheet?.textContent).not.toContain(" vs ");
    expect(sheet?.textContent).toContain("Rules locked");
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { bracketId: "bracket-1" } }),
    );
  });

  it("leaves a bracket whose teams are known to its match", async () => {
    await mountCard("Scheduled", { ...bracket("Scheduled"), match: null });
    await openMenu();

    expect(menuItem("Match Settings")).toBeUndefined();
  });

  it("loads the match again each time they open", async () => {
    await mountCard("Scheduled");
    const sheet = await openSettings();
    sheet!
      .querySelector<HTMLElement>("button.absolute.right-4")!
      .click();
    await flushPromises();

    await openSettings();

    expect(query).toHaveBeenCalledTimes(2);
  });
});
