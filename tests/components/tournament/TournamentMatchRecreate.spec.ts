import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

const DOWNSTREAM_STARTED =
  "The next round has started, so this match can't be replayed.";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;
let mutate: ReturnType<typeof vi.fn>;

function bracket(overrides: Record<string, any> = {}) {
  return {
    id: "bracket-2",
    round: 1,
    match_number: 2,
    group: 1,
    path: "WB",
    bye: false,
    finished: true,
    team_1_seed: 3,
    team_2_seed: 6,
    team_1: { id: "tt-1", name: "Iron Wolves" },
    team_2: { id: "tt-2", name: "Night Owls" },
    feeding_brackets: [],
    parent_bracket: {
      id: "bracket-9",
      round: 2,
      group: 1,
      match_number: 1,
      path: "WB",
      match: null,
    },
    loser_bracket: null,
    match: null,
    ...overrides,
  };
}

function signIn(role: e_player_roles_enum = e_player_roles_enum.user) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
}

async function mountCard(
  slot: Record<string, any> = {},
  tournament: Record<string, any> = {},
) {
  wrapper = await mountSuspended(TournamentMatch, {
    props: {
      round: 1,
      brackets: [bracket(slot)] as any,
      stage: { type: "SingleElimination", max_teams: 8, groups: 1 },
      tournament: { is_organizer: true, status: "Live", ...tournament },
    },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

const kebab = () =>
  document.querySelector<HTMLElement>("button[aria-haspopup=menu]");

async function openMenu() {
  kebab()!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  await flushPromises();
}

const menuItem = (label: string) =>
  Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((item) => item.textContent?.includes(label));

const dialog = () => document.body.querySelector('[role="alertdialog"]');

const confirmButton = () =>
  Array.from(dialog()?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent?.trim() === "Recreate Match",
  );

async function recreateFromMenu() {
  await openMenu();
  menuItem("Recreate Match")!.click();
  await flushPromises();
  confirmButton()!.click();
  await flushPromises();
}

const sent = () => mutate.mock.calls.map(([{ mutation }]) => print(mutation));

beforeEach(() => {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn().mockResolvedValue({
    data: { recreateTournamentBracketMatch: { success: true } },
  });
  vi.spyOn(client, "mutate").mockImplementation(mutate);
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  useAuthStore().me = undefined;
  document.body.innerHTML = "";
  toast.mockReset();
  vi.restoreAllMocks();
});

describe("bracket slot that lost its match", () => {
  it("offers organizers Recreate Match", async () => {
    signIn();
    await mountCard();
    await openMenu();

    expect(menuItem("Recreate Match")).toBeDefined();
    expect(menuItem("Recreate Match")!.hasAttribute("aria-disabled")).toBe(
      false,
    );
  });

  it("offers administrators Recreate Match on a tournament they do not organize", async () => {
    signIn(e_player_roles_enum.administrator);
    await mountCard({}, { is_organizer: false });
    await openMenu();

    expect(menuItem("Recreate Match")).toBeDefined();
  });

  it("shows players the card as it was, with no menu", async () => {
    signIn();
    await mountCard({}, { is_organizer: false });

    expect(kebab()).toBeNull();
    expect(document.body.textContent).toContain("Iron Wolves");
  });

  it("is not offered on a slot that still has its match", async () => {
    signIn();
    await mountCard({
      finished: false,
      match: {
        id: "m-2",
        status: "Scheduled",
        lineup_1: { id: "l-1" },
        lineup_2: { id: "l-2" },
        match_maps: [],
      },
    });
    await openMenu();

    expect(menuItem("Reset winner")).toBeDefined();
    expect(menuItem("Recreate Match")).toBeUndefined();
  });

  it("is not offered on a slot still waiting for a team", async () => {
    signIn();
    await mountCard({ finished: false, team_2: null });

    expect(kebab()).toBeNull();
  });

  it("is not offered once the tournament is over", async () => {
    signIn();
    await mountCard({}, { status: "Finished" });

    expect(kebab()).toBeNull();
  });

  it("asks first, then recreates the slot's match by its bracket id", async () => {
    signIn();
    await mountCard();
    await openMenu();
    menuItem("Recreate Match")!.click();
    await flushPromises();

    expect(dialog()?.textContent).toContain(
      "Iron Wolves and Night Owls get a new match in this slot.",
    );
    expect(mutate).not.toHaveBeenCalled();

    confirmButton()!.click();
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(sent()[0]).toContain("recreateTournamentBracketMatch");
    expect(sent()[0]).toContain('tournament_bracket_id: "bracket-2"');
  });

  it("says a won slot takes its winner back out of the next round", async () => {
    signIn();
    await mountCard({ finished: true });
    await openMenu();
    menuItem("Recreate Match")!.click();
    await flushPromises();

    expect(dialog()?.textContent).toContain(
      "The team that advanced is taken back out of the next round until it's played.",
    );
  });

  it("shows the api's refusal", async () => {
    signIn();
    mutate.mockRejectedValue(new Error("this bracket's match is not due yet"));
    await mountCard({ finished: false });
    await recreateFromMenu();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "this bracket's match is not due yet",
      }),
    );
  });

  it("is blocked once the next round's match has started", async () => {
    signIn();
    await mountCard({
      parent_bracket: {
        id: "bracket-9",
        round: 2,
        group: 1,
        match_number: 1,
        path: "WB",
        match: { status: "Live" },
      },
    });
    await openMenu();

    const item = menuItem("Recreate Match");
    expect(item!.getAttribute("aria-disabled")).toBe("true");
    expect(
      item!.querySelector("[role='img'][aria-label]")?.getAttribute(
        "aria-label",
      ),
    ).toBe(DOWNSTREAM_STARTED);
  });

  it("opens Recreate rather than the dead Schedule dialog when a won slot is clicked", async () => {
    signIn();
    const card = await mountCard({ finished: true });

    (document.querySelector("[data-bracket-id]") as HTMLElement).click();
    await flushPromises();

    expect(card.emitted("schedule-bracket")).toBeUndefined();
    expect(confirmButton()).toBeDefined();
  });

  it("still opens Schedule when an unfinished slot is clicked", async () => {
    signIn();
    const card = await mountCard({ finished: false });

    (document.querySelector("[data-bracket-id]") as HTMLElement).click();
    await flushPromises();

    expect(card.emitted("schedule-bracket")).toHaveLength(1);
  });
});
