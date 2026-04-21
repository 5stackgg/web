const URL_SCHEME_RE = /^[a-z][a-z\d+\-.]*:/i;

export function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
  apiDomain: string | null | undefined,
): string | null {
  if (!avatarUrl) return null;

  if (URL_SCHEME_RE.test(avatarUrl) || avatarUrl.startsWith("//")) {
    return avatarUrl;
  }

  const path = avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`;
  if (!apiDomain) return path;

  const domain = apiDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${domain}${path}`;
}
