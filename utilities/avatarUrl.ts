const URL_SCHEME_RE = /^[a-z][a-z\d+\-.]*:/i;

// Uploads under these are resized by the API on request (?w=), and only to
// these widths -- it refuses anything else. Without a width the original comes
// back, which is what anything that re-uploads or edits the image must ask for.
const RESIZABLE_RE =
  /^\/avatars\/(teams|players|roster-players|roster-teams|tournaments)\/[^/?#]+$/;

export type AvatarWidth = 32 | 64 | 128 | 256 | 512 | 1024 | 1920;

export function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
  apiDomain: string | null | undefined,
  width?: AvatarWidth,
): string | null {
  if (!avatarUrl) return null;

  if (URL_SCHEME_RE.test(avatarUrl) || avatarUrl.startsWith("//")) {
    return avatarUrl;
  }

  let path = avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`;
  if (width && RESIZABLE_RE.test(path)) {
    path = `${path}?w=${width}`;
  }
  if (!apiDomain) return path;

  const domain = apiDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${domain}${path}`;
}
