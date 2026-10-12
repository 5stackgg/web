import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

const roster = (size: number) =>
  Array.from({ length: size }, (_, index) => ({
    role: "Member",
    player: { steam_id: `7656119800000000${index}`, name: `player-${index}` },
  }));

async function mountTeam(options: {
  rosterSize: number;
  eligible?: boolean;
  checkedIn?: boolean;
  registration?: Record<string, unknown> | null;
}) {
  const wrapper = await mountSuspended(TournamentTeam, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "RegistrationClosed",
        min_players_per_lineup: 5,
        max_players_per_lineup: 7,
        teams: [],
      },
      team: {
        id: "team-1",
        name: "Rookies",
        can_manage: false,
        eligible_at: options.eligible ? "2026-10-12T10:00:00Z" : null,
        checked_in_at: options.checkedIn ? "2026-10-12T09:00:00Z" : null,
        roster: roster(options.rosterSize),
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
  check_in_ends_at: "2026-10-12T09:30:00Z",
};

function badge(wrapper: Wrapper) {
  return wrapper
    .findAll("header span.rounded")
    .map((span) => span.text())
    .find((text) =>
      /Eligible|Need|Missed|Not Eligible/i.test(text),
    );
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

  it("says Missed Check-in when a full-enough roster missed a required check-in", async () => {
    const wrapper = await mountTeam({
      rosterSize: 5,
      registration: checkInClosed,
    });

    expect(badge(wrapper)).toBe("Missed Check-in");
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
