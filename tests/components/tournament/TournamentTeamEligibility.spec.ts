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

function badge(wrapper: Wrapper) {
  return wrapper
    .findAll("header span.rounded")
    .map((span) => span.text())
    .find((text) => /Eligible|Need|Missed|Not Eligible/i.test(text));
}

function checkInBadge(wrapper: Wrapper) {
  return wrapper
    .findAll("header span.rounded")
    .map((span) => span.text())
    .find((text) => /checked in|Missed/i.test(text));
}

function buttons(wrapper: Wrapper) {
  return wrapper.findAll("header button").map((button) => button.text());
}

function emptySlots(wrapper: Wrapper) {
  return wrapper.findAll(".roster-slot").length;
}

describe("TournamentTeam eligibility badge", () => {
  it("counts the players a team needs up to the minimum lineup, not the roster cap", async () => {
    const wrapper = await mountTeam({ rosterSize: 4 });

    expect(badge(wrapper)).toBe("Need 1 more player");
  });

  it("says players in the plural past one", async () => {
    const wrapper = await mountTeam({ rosterSize: 3 });

    expect(badge(wrapper)).toBe("Need 2 more players");
  });

  it("keeps the counter and the empty slots at the roster cap", async () => {
    const wrapper = await mountTeam({ rosterSize: 4 });

    expect(wrapper.find("header").text()).toContain("4/7");
    expect(emptySlots(wrapper)).toBe(3);
  });

  // The check-in badge says it, so eligibility doesn't repeat it.
  it("leaves Missed Check-in to the check-in badge when a full-enough roster missed it", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      registration: checkInClosed,
    });

    expect(badge(wrapper)).toBe("Not Eligible");
    expect(checkInBadge(wrapper)).toBe("Missed Check-in");
  });

  it("says Need when the roster is short, even if check-in was missed too", async () => {
    const wrapper = await mountTeam({
      rosterSize: 4,
      registration: checkInClosed,
    });

    expect(badge(wrapper)).toBe("Need 1 more player");
  });

  it("says Not Eligible when the roster is full enough and check-in is not the reason", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      checkedIn: true,
      registration: checkInClosed,
    });

    expect(badge(wrapper)).toBe("Not Eligible");
  });

  it("does not blame check-in before a check-in window ever opened", async () => {
    const wrapper = await mountTeam({
      rosterSize: 6,
      registration: { check_in_required: true, check_in_ends_at: null },
    });

    expect(badge(wrapper)).toBe("Not Eligible");
  });

  it("says Eligible once the team is eligible", async () => {
    const wrapper = await mountTeam({ rosterSize: 5, eligible: true });

    expect(badge(wrapper)).toBe("Eligible");
  });
});

describe("TournamentTeam check-in badge", () => {
  it("shows nothing when the tournament does not require check-in", async () => {
    const wrapper = await mountTeam({ rosterSize: 5, eligible: true });

    expect(checkInBadge(wrapper)).toBeUndefined();
  });

  it("shows nothing before the window starts", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      registration: { check_in_required: true, check_in_started: false },
    });

    expect(checkInBadge(wrapper)).toBeUndefined();
  });

  it("says not checked in while the window is open", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      registration: checkInOpen,
    });

    expect(checkInBadge(wrapper)).toBe("not checked in");
  });

  it("counts confirmed players in Players mode", async () => {
    const wrapper = await mountTeam({
      rosterSize: 6,
      rosterCheckedIn: 2,
      eligible: true,
      registration: { ...checkInOpen, check_in_setting: "Players" },
    });

    expect(checkInBadge(wrapper)).toBe("2 of 5 checked in");
  });

  it("shows when the team checked in", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      checkedIn: true,
      registration: checkInOpen,
    });

    expect(checkInBadge(wrapper)).toMatch(/^checked in · /);
  });

  it("does not blame check-in when a window never opened", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      registration: { ...checkInClosed, check_in_ends_at: null },
    });

    expect(checkInBadge(wrapper)).toBeUndefined();
  });

  it("goes away once the tournament is live", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      checkedIn: true,
      registration: checkInClosed,
      tournament: { status: "Live" },
    });

    expect(checkInBadge(wrapper)).toBeUndefined();
  });

  it("offers no controls to someone who is not an organizer", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      registration: checkInOpen,
    });

    expect(buttons(wrapper)).not.toContain("Mark present");
  });

  it("lets an organizer mark a team present while the window is open", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      registration: checkInOpen,
      tournament: { is_organizer: true },
    });

    expect(buttons(wrapper)).toContain("Mark present");
  });

  it("lets an organizer undo a check-in while the window is open", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      checkedIn: true,
      registration: checkInOpen,
      tournament: { is_organizer: true },
    });

    expect(buttons(wrapper)).toContain("Undo");
  });

  it("offers no undo once the window has closed", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      eligible: true,
      checkedIn: true,
      registration: checkInClosed,
      tournament: { is_organizer: true },
    });

    expect(buttons(wrapper)).not.toContain("Undo");
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
