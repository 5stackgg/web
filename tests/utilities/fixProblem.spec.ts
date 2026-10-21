// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fixProblemItems, type FixProblemState } from "~/utilities/fixProblem";

const t = (key: string) => key;

function menu(overrides: Partial<FixProblemState> = {}) {
  return fixProblemItems(t, {
    status: "Live",
    stepLabel: "Live",
    hasWinner: false,
    currentMapStatus: "Live",
    mapsStarted: true,
    rush: false,
    bracket: false,
    mapVeto: true,
    vetoPicks: 9,
    vetoTeam: null,
    vetoClockRunning: false,
    lastPick: null,
    canSetWinner: true,
    canReboot: true,
    canReparse: true,
    ...overrides,
  });
}

const keys = (items: Array<{ key: string }>) => items.map((item) => item.key);

describe("Fix a Problem", () => {
  it("leads with restoring a round while a map is being played", () => {
    const live = menu();
    expect(keys(live.now)).toEqual(["restore", "restart_map"]);
    expect(keys(live.anytime)).toEqual(["reboot", "restart", "forfeit"]);
    expect(live.later).toBe("match.fix_menu.later_results");
  });

  it("starts the map over from the knife round, but restores nothing there", () => {
    expect(keys(menu({ currentMapStatus: "Knife" }).now)).toEqual([
      "restart_map",
    ]);
    expect(keys(menu({ currentMapStatus: "UploadingDemo" }).now)).toEqual([]);
  });

  it("leaves restoring out of Rush instead of showing it greyed", () => {
    expect(keys(menu({ rush: true }).now)).toEqual(["restart_map"]);
  });

  it("offers every veto fix while the veto runs", () => {
    const veto = menu({
      status: "Veto",
      currentMapStatus: null,
      mapsStarted: false,
      vetoPicks: 4,
      vetoTeam: "Ironside",
      vetoClockRunning: true,
      lastPick: { team: "Ironside", map: "Mirage" },
    });
    expect(keys(veto.now)).toEqual([
      "undo_last",
      "mispick",
      "redo",
      "act",
      "time",
    ]);
    expect(veto.later).toBe("match.fix_menu.later_rounds");
  });

  it("has nothing to take back before the first veto step", () => {
    const veto = menu({
      status: "Veto",
      currentMapStatus: null,
      mapsStarted: false,
      vetoPicks: 0,
      vetoTeam: "Kestrel",
      vetoClockRunning: false,
    });
    expect(keys(veto.now)).toEqual(["act"]);
  });

  it("keeps a finished veto fixable until the first map starts", () => {
    const waiting = menu({
      status: "WaitingForServer",
      currentMapStatus: "Scheduled",
      mapsStarted: false,
    });
    expect(keys(waiting.now)).toEqual(["mispick", "redo"]);

    const started = menu({ currentMapStatus: "Warmup", mapsStarted: true });
    expect(keys(started.now)).not.toContain("mispick");
  });

  it("offers to reopen a canceled match", () => {
    const canceled = menu({ status: "Canceled", currentMapStatus: null });
    expect(keys(canceled.now)).toEqual(["restart", "winner"]);
    expect(canceled.anytime).toEqual([]);
  });

  it("only replays a finished match that belongs to a tournament", () => {
    const scrim = menu({ status: "Finished", hasWinner: true });
    expect(keys(scrim.now)).toEqual(["winner", "reparse"]);

    const bracket = menu({
      status: "Finished",
      hasWinner: true,
      bracket: true,
    });
    expect(keys(bracket.now)).toEqual(["restart", "winner", "reparse"]);
    expect(bracket.later).toBeUndefined();
  });

  it("leaves out what the organizer isn't allowed to do", () => {
    const limited = menu({
      canSetWinner: false,
      canReboot: false,
      canReparse: false,
    });
    expect(keys(limited.anytime)).toEqual(["restart"]);
  });
});
