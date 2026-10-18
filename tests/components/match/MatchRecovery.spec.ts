import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchFixProblemDialog from "~/components/match/MatchFixProblemDialog.vue";
import MatchRestartDialog from "~/components/match/MatchRestartDialog.vue";
import MatchRestoreRoundDialog from "~/components/match/MatchRestoreRoundDialog.vue";

let mutate: ReturnType<typeof vi.fn>;
let query: ReturnType<typeof vi.fn>;
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

const sent = () =>
  mutate.mock.calls.map(([{ mutation, variables }]) => ({
    document: print(mutation),
    variables,
  }));

function match(overrides: Record<string, any> = {}) {
  return {
    id: "m-1",
    status: "Live",
    is_organizer: true,
    winning_lineup_id: null,
    lineup_1_id: "l-1",
    lineup_2_id: "l-2",
    options: { type: "Competitive", map_veto: true, best_of: 1, mr: 12 },
    match_maps: [{ id: "map-1", is_current_map: true, status: "Live" }],
    lineup_1: { id: "l-1", name: "Kestrel" },
    lineup_2: { id: "l-2", name: "Riptide" },
    tournament_brackets: [],
    ...overrides,
  };
}

function round(number: number, backup = true) {
  return {
    round: number,
    lineup_1_score: number,
    lineup_2_score: 0,
    lineup_1_side: "CT",
    lineup_2_side: "TERRORIST",
    winning_side: "CT",
    winning_reason: "CTsWin",
    lineup_1_timeouts: 3,
    lineup_2_timeouts: 3,
    next_lineup_1_side: "CT",
    next_lineup_2_side: "TERRORIST",
    has_backup: backup,
    players: [
      {
        steam_id: "1",
        name: "vexa",
        lineup: 1,
        cash: 4100 + number,
        armor: 100,
        helmet: true,
        alive: true,
        weapons: ["weapon_glock", "weapon_ak47"],
        kills: number,
        deaths: 0,
      },
    ],
  };
}

function restoreRounds(overrides: Record<string, any> = {}) {
  return {
    data: {
      getMatchRestoreRounds: {
        map_name: "de_mirage",
        restorable: true,
        blocked_reason: null,
        live_round: 14,
        economy_hidden: false,
        connected_players: 10,
        expected_players: 10,
        disconnected: [],
        rounds: Array.from({ length: 13 }, (_, index) => round(index + 1)),
        ...overrides,
      },
    },
  };
}

const body = () => document.body;

function button(text: string) {
  return Array.from(body().querySelectorAll("button")).find((element) =>
    element.textContent?.trim().startsWith(text),
  ) as HTMLButtonElement | undefined;
}

beforeEach(() => {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn().mockResolvedValue({ data: {} });
  query = vi.fn().mockResolvedValue(restoreRounds());
  vi.spyOn(client, "mutate").mockImplementation(mutate);
  vi.spyOn(client, "query").mockImplementation(query);
  vi.spyOn(client, "subscribe").mockImplementation(() => ({
    subscribe: () => ({ unsubscribe() {}, closed: false }),
  }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
});

describe("restore round", () => {
  async function mountRestore(data = restoreRounds()) {
    query.mockResolvedValue(data);
    wrapper = await mountSuspended(MatchRestoreRoundDialog, {
      props: { match: match(), open: true },
    });
    await flushPromises();
  }

  it("replays the live round by loading the backup taken after the round before it", async () => {
    await mountRestore();

    expect(body().textContent).toContain("Replay round 14 from the start");
    button("Replay Round 14")!.click();
    await flushPromises();

    expect(sent()[0].document).toContain("restoreMatchRound");
    expect(sent()[0].variables).toEqual({ matchId: "m-1", round: 13 });
  });

  it("labels an earlier pick by the round that gets played again", async () => {
    await mountRestore();

    (
      body().querySelector('button[aria-label^="Round 12:"]') as HTMLElement
    ).click();
    await flushPromises();

    expect(body().textContent).toContain("Back to the start of round 12");
    expect(body().textContent).toContain(
      "Undoes rounds 12–13 and the round in progress",
    );
    button("Restore to Round 12")!.click();
    await flushPromises();

    expect(sent()[0].variables).toEqual({ matchId: "m-1", round: 11 });
  });

  it("waits for a missing player instead of sending the restore", async () => {
    await mountRestore(
      restoreRounds({ connected_players: 9, disconnected: ["osk"] }),
    );

    expect(body().textContent).toContain(
      "Waiting for players to reconnect (9/10): osk",
    );
    expect(button("Replay Round 14")!.disabled).toBe(true);
  });

  it("doesn't wait for a benched substitute once enough players are in", async () => {
    await mountRestore(restoreRounds({ disconnected: ["bench"] }));

    expect(body().textContent).not.toContain("Waiting for players");
    expect(button("Replay Round 14")!.disabled).toBe(false);
  });

  it("tells an organizer on one of the teams to ask someone else", async () => {
    await mountRestore(
      restoreRounds({ blocked_reason: "team_member", economy_hidden: true }),
    );

    expect(body().textContent).toContain(
      "You're on one of the teams, so another organizer has to restore rounds.",
    );
    expect(button("Replay Round")).toBeUndefined();
  });

  it("says why there is nothing to restore in a Rush match", async () => {
    await mountRestore(
      restoreRounds({ blocked_reason: "rush", restorable: false, rounds: [] }),
    );

    expect(body().textContent).toContain("Rush matches can't restore rounds.");
    expect(button("Replay Round")).toBeUndefined();
  });
});

describe("restart match", () => {
  it("cancels and reopens check-in for a live match", async () => {
    wrapper = await mountSuspended(MatchRestartDialog, {
      props: { match: match(), open: true },
    });
    await flushPromises();

    expect(body().textContent).toContain(
      "Both teams veto again, so maps already played are cleared.",
    );
    button("Restart Match")!.click();
    await flushPromises();

    expect(sent()[0].document).toContain("restartMatch");
  });

  it("shows why a round robin result can no longer be taken back", async () => {
    mutate.mockRejectedValueOnce(
      new Error("the next stage was already seeded from these standings"),
    );
    wrapper = await mountSuspended(MatchRestartDialog, {
      props: {
        match: match({
          status: "Finished",
          winning_lineup_id: "l-1",
          is_tournament_match: true,
        }),
        open: true,
      },
    });
    await flushPromises();

    expect(body().textContent).toContain("This match can't be restarted");
    expect(body().textContent).toContain(
      "The next stage was already seeded from these standings",
    );
    expect(button("Restart Match")).toBeUndefined();
  });
});

describe("fix a problem", () => {
  async function rows(overrides: Record<string, any>) {
    wrapper = await mountSuspended(MatchFixProblemDialog, {
      props: {
        match: match(overrides),
        open: true,
        canSetWinner: true,
        canReboot: false,
        canReparse: false,
      },
    });
    await flushPromises();
    return Array.from(
      body().querySelectorAll('[role="dialog"] button[aria-disabled]'),
    ).map((row) => ({
      text: row.textContent ?? "",
      blocked: row.getAttribute("aria-disabled") === "true",
    }));
  }

  it("leads with restoring a round while a map is being played", async () => {
    const list = await rows({});

    expect(list[0].text).toContain("A round went wrong");
    expect(list[0].blocked).toBe(false);
    expect(list.find((row) => row.text.includes("wrong team"))?.blocked).toBe(
      true,
    );
  });

  it("offers to reopen a canceled match", async () => {
    const list = await rows({ status: "Canceled" });

    expect(list.map((row) => row.text)).toEqual([
      expect.stringContaining("The match still needs to be played"),
      expect.stringContaining("The wrong team got the win"),
    ]);
  });

  it("only replays a finished match that belongs to a tournament", async () => {
    const scrim = await rows({ status: "Finished", winning_lineup_id: "l-1" });
    expect(
      scrim.find((row) => row.text.includes("played again"))?.blocked,
    ).toBe(true);

    wrapper?.unmount();
    const bracket = await rows({
      status: "Finished",
      winning_lineup_id: "l-1",
      is_tournament_match: true,
    });
    expect(
      bracket.find((row) => row.text.includes("played again"))?.blocked,
    ).toBe(false);
  });

  it("hands the chosen fix to the dock", async () => {
    await rows({});

    (
      body().querySelector(
        '[role="dialog"] button[aria-disabled="false"]',
      ) as HTMLElement | null
    )?.click();

    expect(wrapper!.emitted("select")?.[0]).toEqual(["restore"]);
  });
});

describe("the dock", () => {
  async function mountDock(overrides: Record<string, any> = {}) {
    wrapper = await mountSuspended(MatchActions, {
      props: {
        match: match({
          is_in_lineup: false,
          is_server_online: true,
          can_cancel: true,
          can_start: false,
          server_id: "server-1",
          streams: [],
          ...overrides,
        }),
        dock: true,
      },
      global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    });
    await flushPromises();
    return wrapper.vm as any;
  }

  it("forfeits to the team the organizer picks", async () => {
    const actions = await mountDock();

    await actions.onFixSelect("forfeit");
    expect(actions.confirmOpen).toBe(true);
    actions.confirmChoice = { value: "l-2", label: "Riptide" };
    await actions.runConfirm();

    expect(sent()[0].document).toContain("forfeitMatch");
    expect(sent()[0].document).toContain("l-2");
  });

  it("opens the restore dialog from Fix a Problem", async () => {
    const actions = await mountDock();

    await actions.onFixSelect("restore");

    expect(actions.restoreOpen).toBe(true);
  });
});
