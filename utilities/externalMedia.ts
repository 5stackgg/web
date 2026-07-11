export type ExternalMediaProvider = "youtube" | "twitch" | "generic";

export interface ExternalMedia {
  provider: ExternalMediaProvider;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  watchUrl: string;
  hostname: string;
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const TWITCH_HOSTS = new Set([
  "twitch.tv",
  "www.twitch.tv",
  "m.twitch.tv",
  "clips.twitch.tv",
  "player.twitch.tv",
]);

function youtubeId(url: URL): string | null {
  if (url.hostname.endsWith("youtu.be")) {
    return url.pathname.slice(1).split("/")[0] || null;
  }
  const v = url.searchParams.get("v");
  if (v) return v;
  const match = url.pathname.match(/\/(?:shorts|embed|v)\/([^/?]+)/);
  return match ? match[1] : null;
}

function twitchEmbed(url: URL, parentHost: string): string | null {
  const parent = `parent=${encodeURIComponent(parentHost)}`;
  const segments = url.pathname.split("/").filter(Boolean);

  // clips.twitch.tv/<slug> or twitch.tv/<channel>/clip/<slug>
  if (url.hostname === "clips.twitch.tv" && segments[0]) {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(segments[0])}&${parent}`;
  }
  const clipIndex = segments.indexOf("clip");
  if (clipIndex !== -1 && segments[clipIndex + 1]) {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(segments[clipIndex + 1])}&${parent}`;
  }

  // twitch.tv/videos/<id>
  if (segments[0] === "videos" && segments[1]) {
    return `https://player.twitch.tv/?video=${encodeURIComponent(segments[1])}&${parent}`;
  }

  // twitch.tv/<channel>
  if (segments[0]) {
    return `https://player.twitch.tv/?channel=${encodeURIComponent(segments[0])}&${parent}`;
  }
  return null;
}

// Turns a stored external URL into everything the gallery needs to render it:
// an inline embed for YouTube/Twitch, or a generic "open in new tab" fallback.
// `parentHost` must be the current window hostname — Twitch embeds require the
// parent domain to match exactly.
export function parseExternalMedia(
  rawUrl: string,
  parentHost: string,
): ExternalMedia {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      provider: "generic",
      embedUrl: null,
      thumbnailUrl: null,
      watchUrl: rawUrl,
      hostname: rawUrl,
    };
  }

  const base: ExternalMedia = {
    provider: "generic",
    embedUrl: null,
    thumbnailUrl: null,
    watchUrl: url.toString(),
    hostname: url.hostname.replace(/^www\./, ""),
  };

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const id = youtubeId(url);
    if (id) {
      return {
        ...base,
        provider: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }

  if (TWITCH_HOSTS.has(url.hostname)) {
    const embedUrl = twitchEmbed(url, parentHost);
    if (embedUrl) {
      return { ...base, provider: "twitch", embedUrl };
    }
  }

  return base;
}
