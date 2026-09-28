export type AlertMessageSegment =
  | { type: "text"; text: string }
  | { type: "internal"; path: string; label: string }
  | { type: "external"; href: string; label: string };

type LinkTarget =
  | { type: "internal"; path: string }
  | { type: "external"; href: string };

const LINK_PATTERN =
  /\[([^\[\]\n]+)\]\(((?:[^\s()]|\([^\s()]*\))+)\)|https?:\/\/[^\s<>"'`]+/gi;

// Resolving a leading-slash target against a host that can never be real is how
// `//evil.test` and `/\evil.test` get caught: the URL parser reads both as a
// jump to another host, exactly as the browser would.
const RELATIVE_BASE = new URL("https://relative.invalid");

export function parseAlertMessage(
  text: string,
  ownHosts: readonly (string | null | undefined)[] = [],
): AlertMessageSegment[] {
  const hosts = new Set(
    ownHosts
      .filter((host): host is string => !!host)
      .map((host) => host.toLowerCase()),
  );
  const segments: AlertMessageSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index ?? 0;
    let raw = match[0];
    let link: AlertMessageSegment | null = null;

    if (match[1] !== undefined) {
      const target = resolveLinkTarget(match[2], hosts);
      if (target) {
        link = { ...target, label: match[1] };
      }
    } else {
      raw = trimTrailingPunctuation(raw);
      const target = resolveLinkTarget(raw, hosts);
      if (target) {
        link = { ...target, label: raw };
      }
    }

    if (!link) {
      continue;
    }

    pushText(segments, text.slice(cursor, start));
    segments.push(link);
    cursor = start + raw.length;
  }

  pushText(segments, text.slice(cursor));

  return segments;
}

function resolveLinkTarget(
  target: string,
  ownHosts: ReadonlySet<string>,
): LinkTarget | null {
  const relative = target.startsWith("/");
  if (!relative && !/^https?:\/\//i.test(target)) {
    return null;
  }

  let url: URL;
  try {
    url = relative ? new URL(target, RELATIVE_BASE) : new URL(target);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  if (
    (relative && url.host === RELATIVE_BASE.host) ||
    ownHosts.has(url.host)
  ) {
    // `https://own.host//evil.test` keeps the doubled slash in its pathname,
    // which a router would read as a jump to evil.test.
    const path = url.pathname.replace(/^\/{2,}/, "/");
    return { type: "internal", path: `${path}${url.search}${url.hash}` };
  }

  return { type: "external", href: url.href };
}

function trimTrailingPunctuation(url: string): string {
  let end = url.length;
  while (end > 0) {
    const char = url[end - 1];
    const body = url.slice(0, end);
    if (".,;:!?".includes(char)) {
      end--;
      continue;
    }
    if (char === ")" && count(body, "(") < count(body, ")")) {
      end--;
      continue;
    }
    if (char === "]" && count(body, "[") < count(body, "]")) {
      end--;
      continue;
    }
    break;
  }
  return url.slice(0, end);
}

function count(value: string, char: string): number {
  return value.split(char).length - 1;
}

function pushText(segments: AlertMessageSegment[], text: string) {
  if (!text) {
    return;
  }
  const last = segments[segments.length - 1];
  if (last?.type === "text") {
    last.text += text;
    return;
  }
  segments.push({ type: "text", text });
}
