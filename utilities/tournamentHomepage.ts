const WEB_ADDRESS = /^https?:\/\//i;

function hostOf(value: string): string | null {
  try {
    return new URL(WEB_ADDRESS.test(value) ? value : `https://${value}`)
      .hostname.replace(/\.$/, "");
  } catch {
    return null;
  }
}

export function tournamentHomepageLink(
  homepage: string | null | undefined,
  ownHosts: Array<string | null | undefined>,
): string | null {
  const value = homepage?.trim();
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(WEB_ADDRESS.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (url.username || url.password) {
    return null;
  }

  const host = url.hostname.replace(/\.$/, "");
  const own = ownHosts
    .filter((candidate): candidate is string => !!candidate)
    .map(hostOf);
  if (own.includes(host)) {
    return null;
  }

  return url.href;
}
