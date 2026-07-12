// Shared helpers for the link-unfurl shims. The app runs as a SPA (ssr:
// false), so OG/Twitter tags set in pages never reach crawlers. Route
// middlewares sniff the crawler user-agent and answer with server-rendered OG
// tags; real browsers fall through to the SPA at the same URL. Auto-imported
// by nitro (server/utils), so these are callable without an explicit import.

export const BOT_UA =
  /(discordbot|twitterbot|facebookexternalhit|facebot|slackbot|slack-imgproxy|telegrambot|whatsapp|linkedinbot|redditbot|embedly|quora link preview|pinterest|vkshare|skypeuripreview|iframely|googlebot|bingbot|applebot|mastodon|nuzzel|w3c_validator|valve\/steam|steamchaturl|steam)/i;

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
}

export function renderUnfurl(opts: UnfurlOptions): string {
  const safeTitle = escapeHtml(opts.title);
  const safeDesc = escapeHtml(opts.description);
  const safeImage = opts.image ? escapeHtml(opts.image) : "";
  const safeAlt = escapeHtml(opts.imageAlt || opts.title);
  const safePage = escapeHtml(opts.pageUrl);
  const safeHuman = escapeHtml(opts.humanUrl);
  const type = escapeHtml(opts.type || "website");

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

    <meta name="twitter:card" content="${safeImage ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
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
