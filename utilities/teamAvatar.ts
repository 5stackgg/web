import { resolveAvatarUrl } from "~/utilities/avatarUrl";

export default function teamAvatar(
  team: { avatar_url?: string | null } | null | undefined,
): string | null {
  return resolveAvatarUrl(
    team?.avatar_url,
    useRuntimeConfig().public.apiDomain as string,
  );
}
