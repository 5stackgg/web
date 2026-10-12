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
const ORPHANED = "This slot's match was deleted. Recreate it to play it again.";
const ORPHANED_BLOCKED =
  "This slot's match was deleted, and the next round has started, so it can't be replayed.";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;
let mutate: ReturnType<typeof vi.fn>;

const slotRef = (id: string, round: number, path = "WB") => ({
  id,
  round,
  group: 1,
  match_number: 1,
  path,
});

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
    parent_bracket: slotRef("bracket-9", 2),
    loser_bracket: null,
    match: null,
    ...overrides,
  };
}

// The next round's slots as the stage query has them, matches included.
function downstream(statuses: Record<string, string | null> = {}) {
  return Object.entries({ "bracket-9": null, ...statuses }).map(
    ([id, status]) => ({
      ...slotRef(id, 2, id.startsWith("lb") ? "LB" : "WB"),
      match: status ? { id: `m-${id}`, status } : null,
    }),
  );
}

function signIn(role: e_player_roles_enum = e_player_roles_enum.user) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
}

async function mountCard(
  slot: Record<string, any> = {},
  tournament: Record<string, any> = {},
  stage: Record<string, any> = {},
) {
  const card = bracket(slot);
  wrapper = await mountSuspended(TournamentMatch, {
    props: {
      round: 1,
      brackets: [card] as any,
      stage: {
        type: "SingleElimination",
        max_teams: 8,
        groups: 1,
        brackets: [card, ...downstream()],
        ...stage,
      },
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

const triangle = () =>
  document.querySelector("[data-bracket-id] [role='img'][aria-label]");

const dialog = () => document.body.querySelector('[role="alertdialog"]');

const confirmButton = () =>
  Array.from(dialog()?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent?.trim() === "Recreate Match",
  );

const clickCard = async () => {
  (document.querySelector("[data-bracket-id]") as HTMLElement).click();
  await flushPromises();
};

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

describe("won elimination slot that lost its match", () => {
  it("offers organizers Recreate Match and says why", async () => {
    signIn();
    await mountCard();
    await openMenu();

    expect(menuItem("Recreate Match")).toBeDefined();
    expect(menuItem("Recreate Match")!.hasAttribute("aria-disabled")).toBe(
      false,
    );
    expect(triangle()?.getAttribute("aria-label")).toBe(ORPHANED);
  });

  it("offers it in a double-elimination stage too", async () => {
    signIn();
    await mountCard({}, {}, { type: "DoubleElimination" });
    await openMenu();

    expect(menuItem("Recreate Match")).toBeDefined();
  });

  it("offers it once registration has closed", async () => {
    signIn();
    await mountCard({}, { status: "RegistrationClosed" });
    await openMenu();

    expect(menuItem("Recreate Match")).toBeDefined();
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
    expect(triangle()).toBeNull();
    expect(document.body.textContent).toContain("Iron Wolves");
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
    expect(dialog()?.textContent).toContain(
      "The team that advanced is taken back out of the next round until it's played.",
    );
    expect(mutate).not.toHaveBeenCalled();

    confirmButton()!.click();
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(sent()[0]).toContain("recreateTournamentBracketMatch");
    expect(sent()[0]).toContain('tournament_bracket_id: "bracket-2"');
  });

  it("shows the api's refusal when a downstream match had already started and was canceled", async () => {
    const refusal =
      "a match downstream of this bracket was already played or went live, even if it was canceled since, so this slot can no longer be replayed";
    signIn();
    mutate.mockRejectedValue(new Error(refusal));
    await mountCard({}, {}, {
      brackets: [bracket(), ...downstream({ "bracket-9": "Canceled" })],
    });
    await openMenu();
    menuItem("Recreate Match")!.click();
    await flushPromises();
    confirmButton()!.click();
    await flushPromises();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: refusal,
      }),
    );
  });

  it("opens Recreate rather than the dead Schedule dialog when clicked", async () => {
    signIn();
    const card = await mountCard();

    await clickCard();

    expect(card.emitted("schedule-bracket")).toBeUndefined();
    expect(confirmButton()).toBeDefined();
  });
});

describe("won slot whose next round has started", () => {
  it("is blocked once the winner's next match has started", async () => {
    signIn();
    await mountCard({}, {}, {
      brackets: [bracket(), ...downstream({ "bracket-9": "Live" })],
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

  it("is blocked once the loser's lower-bracket match has finished", async () => {
    signIn();
    const slot = { loser_bracket: slotRef("lb-1", 1, "LB") };
    await mountCard(slot, {}, {
      type: "DoubleElimination",
      brackets: [bracket(slot), ...downstream({ "lb-1": "Finished" })],
    });
    await openMenu();

    expect(menuItem("Recreate Match")!.getAttribute("aria-disabled")).toBe(
      "true",
    );
  });

  it("no longer tells the organizer to recreate it", async () => {
    signIn();
    await mountCard({}, {}, {
      brackets: [bracket(), ...downstream({ "bracket-9": "Live" })],
    });

    expect(triangle()?.getAttribute("aria-label")).toBe(ORPHANED_BLOCKED);
  });

  it("does nothing when clicked", async () => {
    signIn();
    const card = await mountCard({}, {}, {
      brackets: [bracket(), ...downstream({ "bracket-9": "Live" })],
    });

    await clickCard();

    expect(dialog()).toBeNull();
    expect(card.emitted("schedule-bracket")).toBeUndefined();
  });
});

describe("slots Recreate Match does not apply to", () => {
  it("leaves a slot that still has its match to Reset winner", async () => {
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

  it("leaves an unfinished slot to the scheduler and Schedule", async () => {
    signIn();
    const card = await mountCard({ finished: false });

    expect(kebab()).toBeNull();
    expect(triangle()).toBeNull();

    await clickCard();

    expect(card.emitted("schedule-bracket")).toHaveLength(1);
    expect(dialog()).toBeNull();
  });

  it("is not offered on a slot still waiting for a team", async () => {
    signIn();
    await mountCard({ team_2: null });

    expect(kebab()).toBeNull();
  });

  it.each(["RoundRobin", "Swiss"])(
    "is not offered on a won %s slot, which the api never replays",
    async (type) => {
      signIn();
      await mountCard({}, {}, { type });

      expect(kebab()).toBeNull();
      expect(triangle()).toBeNull();
    },
  );

  it.each(["Paused", "Finished", "Setup"])(
    "is not offered while the tournament is %s",
    async (status) => {
      signIn();
      await mountCard({}, { status });

      expect(kebab()).toBeNull();
      expect(triangle()).toBeNull();
    },
  );
});
