const WEB_ADDRESS = /^https?:\/\//i;
const SCHEME = /^[a-z][a-z\d+.-]*:(.*)$/is;
// "localhost:8080/cup" is a host and a port, not the scheme "localhost".
const PORT = /^\d+(?:[/?#]|$)/;

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

  if (!WEB_ADDRESS.test(value)) {
    const scheme = SCHEME.exec(value);
    if (scheme && !PORT.test(scheme[1])) {
      return null;
    }
  }

  let url: URL;
  try {
    url = new URL(WEB_ADDRESS.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  if (url.username || url.password) {
    return null;
  }

  const host = url.hostname.replace(/\.$/, "");
  const own = ownHosts
    .filter((candidate): candidate is string => !!candidate)
    .map(hostOf);
  // Only our bare address, which the create form used to prefill. A page on
  // this site, like the event page the form suggests, is a real homepage.
  if (own.includes(host) && url.pathname === "/" && !url.search) {
    return null;
  }

  return url.href;
}
