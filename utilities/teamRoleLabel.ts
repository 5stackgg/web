import type { e_team_roles_enum } from "~/generated/zeus";

type Translate = (key: string) => string;

const TEAM_ROLE_KEYS: Record<`${e_team_roles_enum}`, string> = {
  Admin: "team.roles.admin",
  Invite: "team.roles.invite",
  Member: "team.roles.member",
};

export function teamRoleLabel(
  role: string | null | undefined,
  t: Translate,
): string {
  if (!role) {
    return "";
  }
  const key = TEAM_ROLE_KEYS[role as `${e_team_roles_enum}`];
  return key ? t(key) : role;
}
