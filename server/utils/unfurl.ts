// Shared helpers for the link-unfurl shims. The app runs as a SPA (ssr:
// false), so OG/Twitter tags set in pages never reach crawlers. Route
// middlewares sniff the crawler user-agent and answer with server-rendered OG
// tags; real browsers fall through to the SPA at the same URL. Auto-imported
// by nitro (server/utils), so these are callable without an explicit import.

export const BOT_UA =
  /(discordbot|twitterbot|facebookexternalhit|facebot|slackbot|slack-imgproxy|telegrambot|whatsapp|linkedinbot|redditbot|embedly|quora link preview|pinterest|vkshare|skypeuripreview|iframely|googlebot|bingbot|applebot|mastodon|nuzzel|w3c_validator|valve\/steam|steamchaturl|steam)/i;

// What a URL that answers a crawler and a person differently sends with the
// crawler's card. Private: a shared cache that kept the card would hand it to
// people, and anyone can ask with a crawler's user-agent, which makes that a
// way to poison it. Vary says the same to a cache that ignores private.
export function unfurlCacheHeaders(
  maxAgeSeconds: number,
): Record<string, string> {
  return {
    "Cache-Control": `private, max-age=${maxAgeSeconds}`,
    Vary: "User-Agent",
  };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Collapse whitespace and clip to a length crawlers actually render (~300 for
// og:description; keep it tighter so cards stay readable).
export function truncate(s: string, max = 200): string {
  const clean = (s || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

export interface UnfurlOptions {
  title: string;
  description: string;
  pageUrl: string;
  humanUrl: string;
  image?: string | null;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** og:type, defaults to "website" */
  type?: string;
  /** raw extra <meta> lines injected into <head> */
  extraMeta?: string;
  /** a direct mp4 the card plays inline; og:type then defaults to "video.other" */
  video?: UnfurlVideo | null;
}

export interface UnfurlVideo {
  url: string;
  width: number;
  height: number;
  durationSec?: number;
}

// The same tag set the clip share route (server/routes/clips/[id].get.ts)
// emits, which is what Discord plays inline.
function renderVideoMeta(video: UnfurlVideo): string {
  const safeVideo = escapeHtml(video.url);
  const duration =
    video.durationSec && video.durationSec > 0
      ? `<meta property="og:video:duration" content="${Math.round(video.durationSec)}" />`
      : "";

  return `<meta property="og:video" content="${safeVideo}" />
    <meta property="og:video:secure_url" content="${safeVideo}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="${video.width}" />
    <meta property="og:video:height" content="${video.height}" />
    ${duration}`;
}

function renderTwitterPlayerMeta(video: UnfurlVideo): string {
  const safeVideo = escapeHtml(video.url);

  return `<meta name="twitter:player" content="${safeVideo}" />
    <meta name="twitter:player:width" content="${video.width}" />
    <meta name="twitter:player:height" content="${video.height}" />
    <meta name="twitter:player:stream" content="${safeVideo}" />
    <meta name="twitter:player:stream:content_type" content="video/mp4" />`;
}

export function renderUnfurl(opts: UnfurlOptions): string {
  const safeTitle = escapeHtml(opts.title);
  const safeDesc = escapeHtml(opts.description);
  const safeImage = opts.image ? escapeHtml(opts.image) : "";
  const safeAlt = escapeHtml(opts.imageAlt || opts.title);
  const safePage = escapeHtml(opts.pageUrl);
  const safeHuman = escapeHtml(opts.humanUrl);
  const video = opts.video?.url ? opts.video : null;
  const type = escapeHtml(opts.type || (video ? "video.other" : "website"));
  const twitterCard = video
    ? "player"
    : safeImage
      ? "summary_large_image"
      : "summary";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />

    <meta property="og:type" content="${type}" />
    <meta property="og:site_name" content="5Stack" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:url" content="${safePage}" />
    ${safeImage ? `<meta property="og:image" content="${safeImage}" />` : ""}
    ${safeImage ? `<meta property="og:image:secure_url" content="${safeImage}" />` : ""}
    ${safeImage && opts.imageWidth ? `<meta property="og:image:width" content="${opts.imageWidth}" />` : ""}
    ${safeImage && opts.imageHeight ? `<meta property="og:image:height" content="${opts.imageHeight}" />` : ""}
    ${safeImage ? `<meta property="og:image:alt" content="${safeAlt}" />` : ""}
    ${video ? renderVideoMeta(video) : ""}

    <meta name="twitter:card" content="${twitterCard}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    ${video ? renderTwitterPlayerMeta(video) : ""}
    ${safeImage ? `<meta name="twitter:image" content="${safeImage}" />` : ""}
    ${opts.extraMeta || ""}

    <meta http-equiv="refresh" content="0; url=${safeHuman}" />
    <style>
      body { font-family: system-ui, sans-serif; background: #0a0a0c; color: #f4f1ea; margin: 0; padding: 2rem; }
      a { color: #f99e2f; }
    </style>
  </head>
  <body>
    <p>${safeTitle} — <a href="${safeHuman}">open on 5Stack</a>.</p>
  </body>
</html>`;
}
