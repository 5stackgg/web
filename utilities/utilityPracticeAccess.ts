import { Globe, Lock, UserCheck, UserPlus } from "lucide-vue-next";

/**
 * Who may join a practice session, in one place.
 *
 * Three surfaces render this vocabulary -- the start form, the running-session
 * panel, and the top bar -- and they used to each hold their own idea of it.
 * The API's own list is Open | Friends | Invite | Private, and this is the only
 * thing that mirrors it.
 */
export const UTILITY_ACCESS_OPEN = "Open";
export const UTILITY_ACCESS_FRIENDS = "Friends";
export const UTILITY_ACCESS_INVITE = "Invite";
export const UTILITY_ACCESS_PRIVATE = "Private";

export type UtilityAccessOption = {
  value: string;
  icon: unknown;
  /** i18n keys, not text: the caller is what has a `t`. */
  label: string;
  desc: string;
};

export const utilityAccessOptions: UtilityAccessOption[] = [
  {
    value: UTILITY_ACCESS_OPEN,
    icon: Globe,
    label: "pages.utility.practice.access_open",
    desc: "pages.utility.practice.access_open_desc",
  },
  {
    value: UTILITY_ACCESS_FRIENDS,
    icon: UserCheck,
    label: "pages.utility.practice.access_friends",
    desc: "pages.utility.practice.access_friends_desc",
  },
  {
    value: UTILITY_ACCESS_INVITE,
    icon: UserPlus,
    label: "pages.utility.practice.access_invite",
    desc: "pages.utility.practice.access_invite_desc",
  },
  {
    value: UTILITY_ACCESS_PRIVATE,
    icon: Lock,
    label: "pages.utility.practice.access_private",
    desc: "pages.utility.practice.access_private_desc",
  },
];

/**
 * The row's access level, falling back to the old boolean for rows written
 * before the column existed. Friends is the fallback's closed side because that
 * is what the API's own accessFor() maps `is_open: false` to -- the boolean
 * cannot tell Friends from Invite from Private, so it must not claim to.
 */
export function utilityAccessOption(
  access: string | null | undefined,
  isOpen?: boolean | null,
): UtilityAccessOption {
  const value =
    access ?? (isOpen === true ? UTILITY_ACCESS_OPEN : UTILITY_ACCESS_FRIENDS);

  return (
    utilityAccessOptions.find((option) => option.value === value) ??
    utilityAccessOptions[1]
  );
}

/**
 * Whether an invite link is worth handing out. Open takes anybody holding one;
 * Friends takes the host's friends holding one. Invite and Private decide on a
 * list the link has no say in, so offering one there promises access it cannot
 * give.
 */
export function utilityInviteLinkReaches(value: string): boolean {
  return value === UTILITY_ACCESS_OPEN || value === UTILITY_ACCESS_FRIENDS;
}
