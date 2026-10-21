import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import CheckIntoMatch from "~/components/match/CheckIntoMatch.vue";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

function match(overrides: Record<string, any> = {}, checkedIn = false) {
  return {
    id: "m-1",
    can_check_in: true,
    cancels_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    min_players_per_lineup: 5,
    options: { check_in_setting: "Players", camera_required: false },
    tournament_brackets: [],
    lineup_1: {
      lineup_players: [
        { steam_id: "76561198000000001", checked_in: checkedIn },
      ],
    },
    lineup_2: { lineup_players: [] },
    ...overrides,
  };
}

async function mountCheckIn(theMatch: Record<string, any>) {
  useAuthStore().me = { steam_id: "76561198000000001" } as any;
  wrapper = await mountSuspended(CheckIntoMatch, {
    props: { match: theMatch },
  });
  await flushPromises();
  return wrapper.find('[role="timer"]');
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  useAuthStore().me = undefined;
});

describe("the check-in deadline", () => {
  it("warns that a scrim is canceled when the timer runs out", async () => {
    const timer = await mountCheckIn(match());

    expect(timer.attributes("title")).toContain(
      "The match is automatically canceled",
    );
  });

  it("warns that a tournament match is forfeited, coin-tossed if neither team checked in", async () => {
    const timer = await mountCheckIn(
      match({
        tournament_brackets: [{ stage: { tournament: { id: "t-1" } } }],
        options: {
          check_in_setting: "Players",
          camera_required: false,
          match_mode: "auto",
        },
      }),
    );

    expect(timer.attributes("title")).toContain(
      "a team with everyone required checked in wins by forfeit. If neither has, a coin toss picks the winner.",
    );
    expect(timer.attributes("title")).not.toContain("canceled");
  });

  it("leaves an admin-mode tournament match to the organizers when neither team checked in", async () => {
    const timer = await mountCheckIn(
      match({
        tournament_brackets: [{ stage: { tournament: { id: "t-1" } } }],
        options: {
          check_in_setting: "Players",
          camera_required: false,
          match_mode: "admin",
        },
      }),
    );

    expect(timer.attributes("title")).toContain(
      "If neither has, the tournament organizers decide.",
    );
  });

  it("tells a checked-in scrim player when the match auto-cancels", async () => {
    const timer = await mountCheckIn(match({}, true));

    expect(timer.attributes("aria-label")).toMatch(/^Auto-cancels in /);
  });

  it("tells a checked-in tournament player the deadline, not a cancel", async () => {
    const timer = await mountCheckIn(
      match(
        { tournament_brackets: [{ stage: { tournament: { id: "t-1" } } }] },
        true,
      ),
    );

    expect(timer.attributes("aria-label")).toMatch(/^Deadline in /);
  });
});
