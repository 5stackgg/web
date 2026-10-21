import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchRestartDialog from "~/components/match/MatchRestartDialog.vue";
import MatchRoundsPanel from "~/components/match/rounds/MatchRoundsPanel.vue";
import { useMatchRoundsFocus } from "~/composables/useMatchRoundsFocus";
import {
  isVetoOverrideEnabled,
  useVetoOverride,
} from "~/composables/useVetoOverride";

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
    match_maps: [currentMap()],
    lineup_1: { id: "l-1", name: "Kestrel" },
    lineup_2: { id: "l-2", name: "Riptide" },
    tournament_brackets: [],
    ...overrides,
  };
}

function currentMap(overrides: Record<string, any> = {}) {
  return {
    id: "map-1",
    order: 1,
    is_current_map: true,
    status: "Live",
    map: { name: "de_mirage" },
    rounds: Array.from({ length: 13 }, (_, index) => ({
      round: index + 1,
      lineup_1_score: index + 1,
      lineup_2_score: 0,
      lineup_1_side: "CT",
      lineup_2_side: "TERRORIST",
      winning_side: "CT",
      winning_reason: "CTsWin",
    })),
    ...overrides,
  };
}

function round(number: number, backup = true, undone = false) {
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
    undone,
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

describe("restore round on the Rounds tab", () => {
  async function mountRounds(
    data = restoreRounds(),
    overrides: Record<string, any> = {},
  ) {
    query.mockResolvedValue(data);
    const theMatch = match(overrides);
    wrapper = await mountSuspended(MatchRoundsPanel, {
      props: { match: theMatch, matchMap: theMatch.match_maps[0] },
    });
    await flushPromises();
  }

  const column = (round: number) =>
    wrapper!.find(
      `button[aria-label="Restore from the start of round ${round}"]`,
    );

  async function pick(round: number) {
    await column(round).trigger("click");
    await flushPromises();
  }

  const confirm = (text: string) =>
    wrapper!.findAll("button").find((element) => element.text() === text);

  it("replays the live round by loading the backup taken after the round before it", async () => {
    await mountRounds();
    await pick(14);

    expect(wrapper!.text()).toContain("Replay Round 14 From the Start");
    await confirm("Replay Round 14")!.trigger("click");
    await flushPromises();

    expect(sent()[0].document).toContain("restoreMatchRound");
    expect(sent()[0].variables).toEqual({ matchId: "m-1", round: 13 });
  });

  it("labels an earlier pick by the round that gets played again", async () => {
    await mountRounds();
    await pick(12);

    expect(wrapper!.text()).toContain("Back to the Start of Round 12");
    expect(wrapper!.text()).toContain(
      "Undoes rounds 12–13 and the round in progress",
    );
    await confirm("Restore Round 12")!.trigger("click");
    await flushPromises();

    expect(sent()[0].variables).toEqual({ matchId: "m-1", round: 11 });
  });

  it("goes forward again to rounds a restore undid", async () => {
    await mountRounds(
      restoreRounds({
        live_round: 12,
        rounds: Array.from({ length: 13 }, (_, index) =>
          round(index + 1, true, index + 1 >= 12),
        ),
      }),
    );

    expect(wrapper!.text()).toContain("Rounds 12–13 were undone");
    await pick(14);

    expect(wrapper!.text()).toContain("Forward to the Start of Round 14");
    expect(wrapper!.text()).toContain("Brings back rounds 12–13");
    await confirm("Restore Round 14")!.trigger("click");
    await flushPromises();

    expect(sent()[0].variables).toEqual({ matchId: "m-1", round: 13 });
  });

  it("brings undone rounds back through the same preview", async () => {
    await mountRounds(
      restoreRounds({
        live_round: 12,
        connected_players: 9,
        disconnected: ["osk"],
        rounds: Array.from({ length: 13 }, (_, index) =>
          round(index + 1, true, index + 1 >= 12),
        ),
      }),
    );

    await confirm("Bring Back")!.trigger("click");
    await flushPromises();

    expect(wrapper!.text()).toContain("Forward to the Start of Round 14");
    expect(confirm("Restore Round 14")!.attributes("disabled")).toBeDefined();
    expect(sent()).toEqual([]);
  });

  it("waits for a restarted map to go live before offering its rounds", async () => {
    await mountRounds(
      restoreRounds({
        blocked_reason: "not_live_yet",
        live_round: 1,
        rounds: Array.from({ length: 13 }, (_, index) =>
          round(index + 1, true, true),
        ),
      }),
    );

    expect(wrapper!.text()).toContain(
      "The map isn't live again yet. Once it is, any earlier round can be restored until round 1 is over.",
    );
    expect(column(1).exists()).toBe(false);
  });

  it("waits for a missing player instead of sending the restore", async () => {
    await mountRounds(
      restoreRounds({ connected_players: 9, disconnected: ["osk"] }),
    );
    await pick(14);

    expect(wrapper!.text()).toContain("9/10 connected");
    expect(wrapper!.text()).toContain("Restore unlocks when osk reconnects.");
    expect(confirm("Replay Round 14")!.attributes("disabled")).toBeDefined();
  });

  it("doesn't wait for a benched substitute once enough players are in", async () => {
    await mountRounds(restoreRounds({ disconnected: ["bench"] }));
    await pick(14);

    expect(wrapper!.text()).not.toContain("connected ·");
    expect(confirm("Replay Round 14")!.attributes("disabled")).toBeUndefined();
  });

  it("tells an organizer on one of the teams to ask someone else", async () => {
    await mountRounds(
      restoreRounds({ blocked_reason: "team_member", economy_hidden: true }),
    );

    expect(wrapper!.text()).toContain(
      "You're on one of the teams, so another organizer has to restore rounds.",
    );
    expect(column(14).exists()).toBe(false);
  });

  it("says why there is nothing to restore in a Rush match", async () => {
    await mountRounds(
      restoreRounds({ blocked_reason: "rush", restorable: false, rounds: [] }),
    );

    expect(wrapper!.text()).toContain("Rush matches can't restore rounds.");
  });

  it("opens the live round when Fix a Problem asks for it", async () => {
    useMatchRoundsFocus().focus("m-1");
    await mountRounds();

    expect(wrapper!.text()).toContain("Replay Round 14 From the Start");
    expect(useMatchRoundsFocus().request.value).toBeNull();
  });

  it("opens on the latest round that has a backup when the live one has none", async () => {
    useMatchRoundsFocus().focus("m-1");
    await mountRounds(
      restoreRounds({
        rounds: Array.from({ length: 13 }, (_, index) =>
          round(index + 1, index + 1 < 13),
        ),
      }),
    );

    expect(wrapper!.text()).toContain("Back to the Start of Round 13");
  });

  it("drops a request it can't open instead of opening it later", async () => {
    useMatchRoundsFocus().focus("m-1");
    await mountRounds(
      restoreRounds({ blocked_reason: "not_live_yet", restorable: false }),
    );

    query.mockResolvedValue(restoreRounds());
    const theMatch = match();
    await wrapper!.setProps({
      matchMap: {
        ...theMatch.match_maps[0],
        rounds: [...theMatch.match_maps[0].rounds, { round: 14 }],
      },
    });
    await flushPromises();

    expect(query).toHaveBeenCalledTimes(2);
    expect(wrapper!.text()).not.toContain("Replay Round 14 From the Start");
  });

  it("drops a request made while the map can't be restored yet", async () => {
    await mountRounds(
      restoreRounds({ blocked_reason: "not_live_yet", restorable: false }),
    );
    useMatchRoundsFocus().focus("m-1");
    await flushPromises();

    query.mockResolvedValue(restoreRounds());
    const theMatch = match();
    await wrapper!.setProps({
      matchMap: {
        ...theMatch.match_maps[0],
        rounds: [...theMatch.match_maps[0].rounds, { round: 14 }],
      },
    });
    await flushPromises();

    expect(query).toHaveBeenCalledTimes(2);
    expect(wrapper!.text()).not.toContain("Replay Round 14 From the Start");
  });

  it("keeps the preview open when a reload fails", async () => {
    await mountRounds();
    await pick(12);

    query.mockRejectedValue(new Error("offline"));
    const theMatch = match();
    await wrapper!.setProps({
      matchMap: {
        ...theMatch.match_maps[0],
        rounds: [...theMatch.match_maps[0].rounds, { round: 14 }],
      },
    });
    await flushPromises();

    expect(query).toHaveBeenCalledTimes(2);
    expect(wrapper!.text()).toContain("Back to the Start of Round 12");
  });

  it("sends one restore however many times the button is clicked", async () => {
    await mountRounds();
    await pick(12);
    mutate.mockReturnValue(new Promise(() => {}));

    await confirm("Restore Round 12")!.trigger("click");
    await confirm("Restore Round 12")!.trigger("click");
    await flushPromises();

    expect(sent()).toHaveLength(1);
  });

  it("says why an organizer who is playing sees no money or weapons", async () => {
    await mountRounds(
      restoreRounds({
        economy_hidden: true,
        rounds: Array.from({ length: 13 }, (_, index) => ({
          ...round(index + 1),
          players: [],
        })),
      }),
    );
    await pick(12);

    expect(wrapper!.text()).toContain(
      "Player money and weapons are hidden because you're playing in this match.",
    );
  });

  it("shows the sides each round is played on, from the round data", async () => {
    const sides = (number: number) =>
      number <= 12
        ? { lineup_1_side: "CT", lineup_2_side: "TERRORIST" }
        : { lineup_1_side: "TERRORIST", lineup_2_side: "CT" };
    await mountRounds(
      restoreRounds({
        rounds: Array.from({ length: 13 }, (_, index) => ({
          ...round(index + 1),
          ...sides(index + 1),
        })),
      }),
      { match_maps: [currentMap({ lineup_1_side: "CT" })] },
    );
    const chips = () =>
      wrapper!
        .findAll("span")
        .map((element) => element.text())
        .filter((text) => text === "CT" || text === "T")
        .slice(0, 2);

    expect(chips()).toEqual(["T", "CT"]);
    await pick(12);
    expect(chips()).toEqual(["CT", "T"]);
  });

  it("shows players the rounds without asking for the restore data", async () => {
    await mountRounds(restoreRounds(), { is_organizer: false });

    expect(query).not.toHaveBeenCalled();
    expect(wrapper!.text()).toContain("Round 14 in progress");
    expect(column(12).exists()).toBe(false);
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

  const finishedRoundRobin = () =>
    match({
      status: "Finished",
      winning_lineup_id: "l-1",
      is_tournament_match: true,
    });

  function previewAndStandings(impacts: Array<Record<string, any>> = []) {
    mutate.mockResolvedValueOnce({
      data: {
        PreviewTournamentMatchReset: {
          impacts: [
            { is_source: true, will_delete_match: false, stage_type: "Swiss" },
            ...impacts,
          ],
        },
      },
    });
    query.mockResolvedValueOnce({
      data: {
        tournament_brackets: [
          {
            tournament_team_id_1: "t-1",
            tournament_team_id_2: "t-2",
            stage: {
              type: "Swiss",
              results: [
                { tournament_team_id: "t-1", wins: 2, losses: 0 },
                { tournament_team_id: "t-2", wins: 0, losses: 2 },
              ],
            },
          },
        ],
      },
    });
  }

  it("replays a finished result, showing what it does to the standings", async () => {
    previewAndStandings();
    wrapper = await mountSuspended(MatchRestartDialog, {
      props: { match: finishedRoundRobin(), open: true },
    });
    await flushPromises();

    expect(body().textContent).toContain("2–0 → 1–0");
    expect(body().textContent).toContain("0–2 → 0–1");
    button("Restart Match")!.click();
    await flushPromises();

    expect(sent()[1].document).toContain("ResetTournamentMatch");
    expect(sent()[1].variables).toEqual({
      matchId: "m-1",
      winningLineupId: null,
      resetStatus: "WaitingForCheckIn",
    });
  });

  it("gives the win to the other team without a replay", async () => {
    previewAndStandings();
    wrapper = await mountSuspended(MatchRestartDialog, {
      props: { match: finishedRoundRobin(), open: true },
    });
    await flushPromises();

    (
      body().querySelector('input[type="radio"][value="swap"]') as HTMLElement
    ).click();
    await flushPromises();

    expect(body().textContent).toContain("2–0 → 1–1");
    expect(body().textContent).toContain("0–2 → 1–1");
    button("Change Winner")!.click();
    await flushPromises();

    expect(sent()[1].variables).toMatchObject({ winningLineupId: "l-2" });
  });

  it("warns about playoff matches a final Swiss result already fed", async () => {
    previewAndStandings([
      {
        is_source: false,
        will_delete_match: true,
        stage_type: "SingleElimination",
      },
    ]);
    wrapper = await mountSuspended(MatchRestartDialog, {
      props: { match: finishedRoundRobin(), open: true },
    });
    await flushPromises();

    expect(body().textContent).toContain("2–0 → 1–0");
    expect(body().textContent).toContain(
      "This also resets 1 later bracket match.",
    );
  });

  it("lets a match that reopened mid-preview be restarted", async () => {
    let refuse: (error: Error) => void = () => {};
    mutate.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          refuse = reject;
        }),
    );
    wrapper = await mountSuspended(MatchRestartDialog, {
      props: { match: finishedRoundRobin(), open: true },
    });
    await flushPromises();

    await wrapper.setProps({ match: match({ status: "WaitingForCheckIn" }) });
    await flushPromises();
    refuse(new Error("the next stage was already seeded from these standings"));
    await flushPromises();

    expect(body().textContent).not.toContain("This match can't be restarted");
    expect(button("Restart Match")!.disabled).toBe(false);
  });

  it("forgets an old refusal once the match can be reopened", async () => {
    mutate.mockRejectedValueOnce(
      new Error("the next stage was already seeded from these standings"),
    );
    wrapper = await mountSuspended(MatchRestartDialog, {
      props: { match: finishedRoundRobin(), open: true },
    });
    await flushPromises();
    expect(body().textContent).toContain("This match can't be restarted");

    await wrapper.setProps({ open: false });
    await wrapper.setProps({
      match: match({ status: "WaitingForCheckIn" }),
      open: true,
    });
    await flushPromises();

    expect(body().textContent).not.toContain("This match can't be restarted");
    expect(button("Restart Match")).toBeDefined();
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

  const veto = {
    status: "Veto",
    map_veto_picking_lineup_id: "l-2",
    veto_pick_expires_at: "2026-10-20T12:00:00Z",
    options: {
      type: "Competitive",
      map_veto: true,
      best_of: 3,
      mr: 12,
      map_pool: {
        maps: [
          "nuke",
          "vertigo",
          "mirage",
          "ancient",
          "anubis",
          "inferno",
          "dust2",
        ].map((name) => ({ id: `id-${name}`, name: `de_${name}` })),
      },
    },
    match_maps: [],
  };

  const picks = [
    {
      type: "Ban",
      map: { id: "id-nuke", name: "de_nuke" },
      match_lineup_id: "l-1",
    },
    {
      type: "Ban",
      map: { id: "id-vertigo", name: "de_vertigo" },
      match_lineup_id: "l-2",
    },
    {
      type: "Pick",
      map: { id: "id-mirage", name: "de_mirage" },
      match_lineup_id: "l-1",
    },
    {
      type: "Side",
      side: "CT",
      map: { id: "id-mirage", name: "de_mirage" },
      match_lineup_id: "l-2",
    },
  ];

  it("awards a live match through the winner picker", async () => {
    const actions = await mountDock();

    await actions.onFixSelect("forfeit");
    expect(actions.confirmOpen).toBe(true);
    actions.confirmChoice = { value: "l-2", label: "Riptide" };
    await actions.runConfirm();

    expect(sent()[0].document).toContain("setMatchWinner");
    expect(sent()[0].document).toContain("l-2");
  });

  it("leaves Fix a Problem off a finished scrim that has nothing to fix", async () => {
    const actions = await mountDock({
      status: "Finished",
      winning_lineup_id: "l-1",
    });

    expect(actions.canFixProblems).toBe(false);
  });

  it("restarts the map from warmup once confirmed", async () => {
    const actions = await mountDock();

    await actions.onFixSelect("restart_map");
    expect(actions.confirming.title).toBe("Restart Map");
    await actions.runConfirm();

    expect(sent()[0].document).toContain("restartMatchMap");
    expect(sent()[0].variables).toEqual({ matchId: "m-1" });
  });

  it("sends a round that went wrong to the Rounds tab", async () => {
    const actions = await mountDock();

    await actions.onFixSelect("restore");

    expect(useMatchRoundsFocus().request.value?.matchId).toBe("m-1");
    useMatchRoundsFocus().request.value = null;
  });

  it("offers the veto fixes while the veto is running", async () => {
    const actions = await mountDock(veto);
    actions.vetoPicks = picks;
    await flushPromises();

    expect(actions.fixMenu.now.map((item: any) => item.key)).toEqual([
      "undo_last",
      "mispick",
      "redo",
      "act",
      "time",
    ]);
    expect(actions.fixMenu.now[3].title).toBe("Ban or Pick for Riptide");
    expect(actions.vetoTimeline[2]).toMatchObject({
      step: 3,
      type: "Pick",
      lineup: 1,
      map: "de_mirage",
    });
  });

  it("closes the menu once something is picked", async () => {
    const actions = await mountDock(veto);
    actions.vetoPicks = picks;
    actions.fixOpen = true;

    await actions.onFixSelect("time");

    expect(actions.fixOpen).toBe(false);
  });

  it("undoes the step the organizer was shown, even if a team picks meanwhile", async () => {
    const actions = await mountDock(veto);
    actions.vetoPicks = picks;

    await actions.onFixSelect("undo_last");
    actions.vetoPicks = [
      ...picks,
      {
        type: "Pick",
        map: { id: "id-ancient", name: "de_ancient" },
        match_lineup_id: "l-2",
      },
    ];
    await actions.runConfirm();

    expect(sent()[0].variables).toEqual({
      matchId: "m-1",
      step: 4,
      expected: 4,
    });
  });

  it("sends one rewind while the first is still on its way", async () => {
    const actions = await mountDock(veto);
    actions.vetoPicks = picks;
    mutate.mockReturnValue(new Promise(() => {}));

    void actions.rewindVeto(3);
    await actions.rewindVeto(3);

    expect(sent()).toHaveLength(1);
  });

  it("only follows the veto picks while the veto can still be changed", async () => {
    const live = await mountDock({ ...veto, status: "Live" });
    expect(live.vetoPicksScope).toBe("m-1");
    wrapper?.unmount();

    const started = await mountDock({
      ...veto,
      status: "Live",
      match_maps: [currentMap()],
    });
    expect(started.vetoPicksScope).toBe("");
  });

  it("takes back the last veto step once confirmed", async () => {
    const actions = await mountDock(veto);
    actions.vetoPicks = picks;

    await actions.onFixSelect("undo_last");
    expect(actions.confirming.title).toBe("Undo the Last Step");
    await actions.runConfirm();

    expect(sent()[0].document).toContain("rewindMapVeto");
    expect(sent()[0].variables).toEqual({
      matchId: "m-1",
      step: 4,
      expected: 4,
    });
  });

  it("opens a finished veto at the last ban, since nobody chose the Decider", async () => {
    const actions = await mountDock({ ...veto, status: "Live" });
    actions.vetoPicks = [
      ...picks,
      {
        type: "Pick",
        map: { id: "id-ancient", name: "de_ancient" },
        match_lineup_id: "l-2",
      },
      {
        type: "Side",
        side: "T",
        map: { id: "id-ancient", name: "de_ancient" },
        match_lineup_id: "l-1",
      },
      {
        type: "Ban",
        map: { id: "id-anubis", name: "de_anubis" },
        match_lineup_id: "l-2",
      },
      {
        type: "Ban",
        map: { id: "id-inferno", name: "de_inferno" },
        match_lineup_id: "l-1",
      },
      {
        type: "Decider",
        map: { id: "id-dust2", name: "de_dust2" },
        match_lineup_id: null,
      },
    ];
    await flushPromises();

    expect(actions.fixMenu.now.map((item: any) => item.key)).toContain(
      "mispick",
    );
    await actions.onFixSelect("mispick");
    expect(actions.vetoFixStep).toBe(8);

    await actions.rewindVeto(8);

    expect(sent()[0].variables).toEqual({
      matchId: "m-1",
      step: 8,
      expected: 9,
    });
  });

  it("opens Fix the Veto at the newest step, or the first to redo it", async () => {
    const actions = await mountDock(veto);
    actions.vetoPicks = picks;

    await actions.onFixSelect("mispick");
    expect(actions.vetoFixOpen).toBe(true);
    expect(actions.vetoFixStep).toBe(4);

    await actions.onFixSelect("redo");
    expect(actions.vetoFixStep).toBe(1);

    await actions.rewindVeto(3);
    expect(sent()[0].variables).toEqual({
      matchId: "m-1",
      step: 3,
      expected: 4,
    });
    expect(actions.vetoFixOpen).toBe(false);
  });

  it("gives the team on the clock 30 more seconds", async () => {
    const actions = await mountDock(veto);
    actions.vetoPicks = picks;

    await actions.onFixSelect("time");

    expect(sent()[0].document).toContain("extendVetoClock");
    expect(sent()[0].variables).toEqual({ matchId: "m-1", seconds: 30 });
  });

  it("turns veto override on to act for the team whose turn it is", async () => {
    const actions = await mountDock(veto);
    actions.vetoPicks = picks;

    await actions.onFixSelect("act");

    expect(isVetoOverrideEnabled("m-1")).toBe(true);
    useVetoOverride(() => "m-1").enabled.value = false;
  });
});
