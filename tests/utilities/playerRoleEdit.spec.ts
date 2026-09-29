import { describe, expect, it } from "vitest";
import { e_player_roles_enum } from "~/generated/zeus";
import { roleOrder } from "~/stores/AuthStore";
import { canEditPlayerRole } from "~/utilities/playerRoleEdit";

function viewer(role: e_player_roles_enum) {
  return (target: e_player_roles_enum) => {
    const targetIndex = roleOrder.indexOf(target);
    return targetIndex !== -1 && roleOrder.indexOf(role) >= targetIndex;
  };
}

describe("canEditPlayerRole", () => {
  it.each([
    e_player_roles_enum.user,
    e_player_roles_enum.verified_user,
    e_player_roles_enum.streamer,
    e_player_roles_enum.moderator,
  ])("denies a %s viewer even on a plain user", (role) => {
    expect(canEditPlayerRole(viewer(role), e_player_roles_enum.user)).toBe(
      false,
    );
  });

  it("lets a match organizer edit players at or below their own role", () => {
    const isRoleAbove = viewer(e_player_roles_enum.match_organizer);

    expect(canEditPlayerRole(isRoleAbove, e_player_roles_enum.user)).toBe(true);
    expect(canEditPlayerRole(isRoleAbove, e_player_roles_enum.moderator)).toBe(
      true,
    );
    expect(
      canEditPlayerRole(isRoleAbove, e_player_roles_enum.match_organizer),
    ).toBe(true);
  });

  it("stops a match organizer from editing someone who outranks them", () => {
    const isRoleAbove = viewer(e_player_roles_enum.match_organizer);

    expect(
      canEditPlayerRole(isRoleAbove, e_player_roles_enum.tournament_organizer),
    ).toBe(false);
    expect(
      canEditPlayerRole(isRoleAbove, e_player_roles_enum.administrator),
    ).toBe(false);
  });

  it("lets an administrator edit everyone", () => {
    const isRoleAbove = viewer(e_player_roles_enum.administrator);

    for (const role of roleOrder) {
      expect(canEditPlayerRole(isRoleAbove, role)).toBe(true);
    }
  });

  it("treats a missing target role as a plain user", () => {
    const isRoleAbove = viewer(e_player_roles_enum.match_organizer);

    expect(canEditPlayerRole(isRoleAbove, null)).toBe(true);
    expect(canEditPlayerRole(isRoleAbove, undefined)).toBe(true);
    expect(
      canEditPlayerRole(viewer(e_player_roles_enum.streamer), undefined),
    ).toBe(false);
  });
});
