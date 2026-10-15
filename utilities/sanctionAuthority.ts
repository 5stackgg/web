import { e_player_roles_enum } from "~/generated/zeus";
import { roleOrder } from "~/stores/AuthStore";

type IsRoleAbove = (role: e_player_roles_enum) => boolean;

/**
 * Mirrors the api's public.can_sanction_player: sanctioning a player, lifting
 * or re-dating one of their sanctions, and kicking them all need a role
 * strictly above theirs, so nobody acts on an equal -- administrators
 * included. A player with no known role counts as a user, as on the api.
 */
export function outranksPlayer(
  isRoleAbove: IsRoleAbove,
  targetRole?: e_player_roles_enum | string | null,
): boolean {
  const target = roleOrder.indexOf(
    (targetRole ?? e_player_roles_enum.user) as e_player_roles_enum,
  );
  const above = roleOrder[Math.max(target, 0) + 1];

  return !!above && isRoleAbove(above);
}
