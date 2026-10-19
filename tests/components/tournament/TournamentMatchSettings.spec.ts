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

async function mountCard(status: string) {
  wrapper = await mountSuspended(TournamentMatch, {
    props: {
      round: 1,
      brackets: [bracket(status)] as any,
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
  query = vi.fn().mockResolvedValue({ data: { matches_by_pk: null } });
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
  it.each(["PickingPlayers", "Scheduled", "WaitingForCheckIn", "WaitingForServer"])(
    "offers an organizer the settings of a %s match",
    async (status) => {
      await mountCard(status);
      await openMenu();

      expect(menuItem("Match Settings")).toBeDefined();
      expect(menuItem("Reset winner")).toBeDefined();
    },
  );

  it.each(["Veto", "Live", "Finished"])(
    "leaves them to the match page once the match is %s",
    async (status) => {
      await mountCard(status);
      await openMenu();

      expect(menuItem("Match Settings")).toBeUndefined();
      expect(menuItem("Reset winner")).toBeDefined();
    },
  );

  it("opens them beside the bracket, for that match", async () => {
    await mountCard("Scheduled");
    await openMenu();
    menuItem("Match Settings")!.click();
    await flushPromises();

    const sheet = document.body.querySelector('[role="dialog"]');
    expect(sheet?.textContent).toContain("Match Settings");
    expect(sheet?.textContent).toContain("Iron Wolves vs Night Owls");
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { matchId: "match-1" } }),
    );
  });
});
