import { e_player_roles_enum } from "~/generated/zeus";

type IsRoleAbove = (role: e_player_roles_enum) => boolean;

/**
 * Hasura grants players.role to match_organizer and above only, and the
 * tbau_players trigger rejects a change to anyone who outranks the editor.
 * Both have to pass, or the editor renders a dropdown that can only fail.
 */
export function canEditPlayerRole(
  isRoleAbove: IsRoleAbove,
  targetRole?: e_player_roles_enum | string | null,
): boolean {
  return (
    isRoleAbove(e_player_roles_enum.match_organizer) &&
    isRoleAbove((targetRole ?? e_player_roles_enum.user) as e_player_roles_enum)
  );
}
