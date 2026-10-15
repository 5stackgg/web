import { afterEach, describe, expect, it } from "vitest";
import { e_player_roles_enum } from "~/generated/zeus";
import { roleOrder, useAuthStore } from "~/stores/AuthStore";
import { outranksPlayer } from "~/utilities/sanctionAuthority";

function as(role: e_player_roles_enum) {
  useAuthStore().me = { steam_id: "76561198000000099", role } as any;
  return useAuthStore().isRoleAbove;
}

afterEach(() => {
  useAuthStore().me = undefined;
});

describe("outranksPlayer", () => {
  it("lets a moderator act on every role below theirs, and on nobody else", () => {
    const isRoleAbove = as(e_player_roles_enum.moderator);

    expect(
      roleOrder.filter((target) => outranksPlayer(isRoleAbove, target)),
    ).toEqual([
      e_player_roles_enum.user,
      e_player_roles_enum.verified_user,
      e_player_roles_enum.streamer,
    ]);
  });

  it("never lets anyone act on an equal, administrators included", () => {
    for (const role of roleOrder) {
      expect(outranksPlayer(as(role), role)).toBe(false);
    }
  });

  it("lets an administrator act on everyone but another administrator", () => {
    const isRoleAbove = as(e_player_roles_enum.administrator);

    expect(
      roleOrder.filter((target) => !outranksPlayer(isRoleAbove, target)),
    ).toEqual([e_player_roles_enum.administrator]);
  });

  it("counts a player with no known role as a user", () => {
    expect(outranksPlayer(as(e_player_roles_enum.verified_user), null)).toBe(
      true,
    );
    expect(outranksPlayer(as(e_player_roles_enum.user), undefined)).toBe(false);
  });

  it("lets a signed-out viewer act on nobody", () => {
    useAuthStore().me = undefined;

    expect(
      outranksPlayer(useAuthStore().isRoleAbove, e_player_roles_enum.user),
    ).toBe(false);
  });
});
