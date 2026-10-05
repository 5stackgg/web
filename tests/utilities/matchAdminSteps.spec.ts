import { describe, expect, it } from "vitest";
import { e_player_roles_enum } from "~/generated/zeus";
import { roleOrder } from "~/stores/AuthStore";
import {
  currentMatchAdminStep,
  matchAdminSteps,
  upcomingAdminActions,
} from "~/utilities/matchAdminSteps";

const roleAtLeast =
  (mine: e_player_roles_enum) => (needed: e_player_roles_enum) =>
    roleOrder.indexOf(mine) >= roleOrder.indexOf(needed);

function match(status: string, mapStatus?: string, mapVeto = true) {
  return {
    status,
    options: { map_veto: mapVeto, region_veto: false },
    match_maps: mapStatus ? [{ is_current_map: true, status: mapStatus }] : [],
  };
}

describe("matchAdminSteps", () => {
  it("drops the veto step when the match runs no veto", () => {
    expect(
      matchAdminSteps(match("WaitingForCheckIn", undefined, false)),
    ).toEqual(["check_in", "warmup", "live", "finished"]);
  });

  it.each([
    ["WaitingForCheckIn", undefined, "check_in"],
    ["PickingPlayers", undefined, "check_in"],
    ["Veto", undefined, "veto"],
    ["WaitingForServer", undefined, "warmup"],
    ["Live", "Warmup", "warmup"],
    ["Live", "Scheduled", "warmup"],
    ["Live", "Knife", "live"],
    ["Live", "Paused", "live"],
    ["Finished", "Finished", "finished"],
    ["Canceled", undefined, "finished"],
  ])("puts a %s match (map %s) on the %s step", (status, mapStatus, step) => {
    expect(currentMatchAdminStep(match(status, mapStatus))).toBe(step);
  });
});

describe("upcomingAdminActions", () => {
  it("leaves out what a plain organizer can never use", () => {
    const keys = upcomingAdminActions(
      match("WaitingForCheckIn"),
      roleAtLeast(e_player_roles_enum.user),
    ).map((action) => action.key);

    expect(keys).toEqual(["veto_override", "live_stream"]);
  });

  it("lists the later steps' tools for an administrator", () => {
    const keys = upcomingAdminActions(
      match("Live", "Warmup"),
      roleAtLeast(e_player_roles_enum.administrator),
    ).map((action) => action.key);

    expect(keys).toEqual(["pause", "highlights", "reparse"]);
  });

  it("has nothing left once the match is finished", () => {
    expect(
      upcomingAdminActions(
        match("Finished", "Finished"),
        roleAtLeast(e_player_roles_enum.administrator),
      ),
    ).toEqual([]);
  });
});
