import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

const roster = (size: number, checkedIn = 0) =>
  Array.from({ length: size }, (_, index) => ({
    role: "Member",
    checked_in_at: index < checkedIn ? "2026-10-12T09:10:00Z" : null,
    player: { steam_id: `7656119800000000${index}`, name: `player-${index}` },
  }));

async function mountTeam(options: {
  rosterSize: number;
  eligible?: boolean;
  checkedIn?: boolean;
  rosterCheckedIn?: number;
  registration?: Record<string, unknown> | null;
  tournament?: Record<string, unknown>;
  expanded?: boolean;
}) {
  const wrapper = await mountSuspended(TournamentTeam, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "RegistrationClosed",
        min_players_per_lineup: 5,
        max_players_per_lineup: 7,
        teams: [],
        ...options.tournament,
      },
      team: {
        id: "team-1",
        name: "Rookies",
        can_manage: false,
        eligible_at: options.eligible ? "2026-10-12T10:00:00Z" : null,
        checked_in_at: options.checkedIn ? "2026-10-12T09:00:00Z" : null,
        roster: roster(options.rosterSize, options.rosterCheckedIn),
        invites: [],
      },
      registration: options.registration ?? null,
      expanded: options.expanded ?? false,
    },
    global: {
      stubs: { TournamentTeamMemberRow: true },
      mocks: { e_team_roles: [{ value: "Member", description: "Member" }] },
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountTeam>>;

const checkInClosed = {
  check_in_required: true,
  check_in_started: true,
  check_in_open: false,
  check_in_ends_at: "2026-10-12T09:30:00Z",
};

const checkInOpen = {
  ...checkInClosed,
  check_in_open: true,
};

function status(wrapper: Wrapper) {
  return wrapper
    .find("[data-team-status]")
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function buttons(wrapper: Wrapper) {
  return wrapper.findAll("button").map((button) => button.text());
}

describe("TournamentTeam ledger status", () => {
  it("counts the players a team needs up to the minimum lineup, not the roster cap", async () => {
    const wrapper = await mountTeam({ rosterSize: 4 });

    expect(status(wrapper)).toBe("Needs 1 player");
  });

  it("says players in the plural past one", async () => {
    const wrapper = await mountTeam({ rosterSize: 3 });

    expect(status(wrapper)).toBe("Needs 2 players");
  });

  it("keeps the counter and the empty slots at the roster cap", async () => {
    const wrapper = await mountTeam({ rosterSize: 4, expanded: true });

    expect(wrapper.text()).toContain("4/7");
    expect(wrapper.findAll(".roster-slot").length).toBe(3);
  });

  it("says Ready once the team is eligible", async () => {
    const wrapper = await mountTeam({ rosterSize: 5, eligible: true });

    expect(status(wrapper)).toBe("Ready");
  });

  it("says Not eligible when the roster is full and check-in is not the reason", async () => {
    const wrapper = await mountTeam({ rosterSize: 5 });

    expect(status(wrapper)).toBe("Not eligible");
  });

  it("says Not checked in while the window is open", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      registration: checkInOpen,
    });

    expect(status(wrapper)).toBe("Not checked in");
  });

  it("counts confirmed players in every-player mode", async () => {
    const wrapper = await mountTeam({
      rosterSize: 6,
      rosterCheckedIn: 2,
      eligible: true,
      registration: { ...checkInOpen, check_in_setting: "Players" },
    });

    expect(status(wrapper)).toBe("2 of 5 checked in");
  });

  it("shows when the team checked in", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      checkedIn: true,
      registration: checkInOpen,
    });

    expect(status(wrapper)).toMatch(/^Checked in \d/);
  });

  it("says Missed check-in once a window that opened has closed", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      registration: checkInClosed,
    });

    expect(status(wrapper)).toBe("Missed check-in");
  });

  it("says Needs when the roster is short, even if check-in was missed too", async () => {
    const wrapper = await mountTeam({
      rosterSize: 4,
      registration: checkInClosed,
    });

    expect(status(wrapper)).toBe("Needs 1 player");
  });

  it("does not blame check-in when a window never opened", async () => {
    const wrapper = await mountTeam({
      rosterSize: 6,
      registration: { ...checkInClosed, check_in_ends_at: null },
    });

    expect(status(wrapper)).toBe("Not eligible");
  });

  it("leaves the status to the bracket once the tournament is live", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      checkedIn: true,
      registration: checkInClosed,
      tournament: { status: "Live" },
    });

    expect(wrapper.find("[data-team-status]").exists()).toBe(false);
  });
});

describe("TournamentTeam ledger check-in controls", () => {
  it("offers no controls to someone who is not an organizer", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      registration: checkInOpen,
    });

    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
  });

  it("gives an organizer a present switch while the window is open", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      registration: checkInOpen,
      tournament: { is_organizer: true },
    });

    const toggle = wrapper.find('[role="switch"]');
    expect(toggle.exists()).toBe(true);
    expect(toggle.attributes("aria-checked")).toBe("false");
  });

  it("shows a checked-in team as switched on", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      checkedIn: true,
      registration: checkInOpen,
      tournament: { is_organizer: true },
    });

    expect(
      wrapper.find('[role="switch"]').attributes("aria-checked"),
    ).toBe("true");
  });

  it("takes the switch away once the window has closed", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      checkedIn: true,
      registration: checkInClosed,
      tournament: { is_organizer: true },
    });

    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
  });

  it("lets an organizer re-admit a team that missed check-in", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      registration: checkInClosed,
      tournament: { is_organizer: true },
    });

    expect(buttons(wrapper)).toContain("Re-admit");
  });
});
