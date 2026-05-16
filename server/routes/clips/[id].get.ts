// SSR shim for clip share URLs. Nuxt runs as a SPA (ssr: false), so
// meta tags set in pages/clips/[id].vue never reach link-unfurling bots.
// Discord, Slack, etc. fetch /clips/<id>, read this handler's OG/video
// tags, and embed the clip as an inline auto-playing video. Real
// browsers get the same HTML but a meta-refresh + JS redirect lands the
// user on /highlights?clip=<id> where the existing modal flow takes over.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CLIP_QUERY = `query ClipForUnfurl($id: uuid!) {
  match_clips_by_pk(id: $id) {
    id
    title
    download_url
    thumbnail_download_url
    duration_ms
    visibility
    target { name }
    match_map {
      map { name label }
      match {
        lineup_1 { name }
        lineup_2 { name }
      }
    }
  }
}`;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const fallback = id
    ? `/highlights?clip=${encodeURIComponent(id)}`
    : "/highlights";

  if (!id) {
    return sendRedirect(event, "/highlights", 302);
  }

  const apiDomain = process.env.NUXT_PUBLIC_API_DOMAIN;
  const adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

  let clip: any = null;
  if (apiDomain && adminSecret) {
    try {
      const res = await $fetch<{ data?: any; errors?: any }>(
        `https://${apiDomain}/v1/graphql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hasura-admin-secret": adminSecret,
          },
          body: { query: CLIP_QUERY, variables: { id } },
        },
      );
      clip = res?.data?.match_clips_by_pk ?? null;
    } catch (err) {
      console.error("[clip-unfurl] fetch failed:", err);
    }
  }

  if (!clip || !clip.download_url) {
    return sendRedirect(event, fallback, 302);
  }

  const protocol = getRequestProtocol(event);
  const host = getRequestHost(event);
  const origin = `${protocol}://${host}`;
  const pageUrl = `${origin}/clips/${id}`;
  const videoUrl: string = clip.download_url;
  const thumbUrl: string | null = clip.thumbnail_download_url ?? null;
  const targetName: string = clip.target?.name ?? "Player";
  const mapName: string | null =
    clip.match_map?.map?.label ?? clip.match_map?.map?.name ?? null;
  const lineup1: string | null = clip.match_map?.match?.lineup_1?.name ?? null;
  const lineup2: string | null = clip.match_map?.match?.lineup_2?.name ?? null;
  const matchup =
    lineup1 && lineup2
      ? `${lineup1} vs ${lineup2}`
      : (lineup1 ?? lineup2 ?? "");
  const title: string =
    clip.title || `${targetName} — ${mapName ?? "Match highlight"}`;
  const description = [matchup, mapName].filter(Boolean).join(" · ");
  const durationSec = Math.max(0, Math.round((clip.duration_ms ?? 0) / 1000));

  setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
  // Bots cache aggressively. Short window keeps stale OG out of unfurls.
  setResponseHeader(event, "Cache-Control", "public, max-age=300");

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeVideo = escapeHtml(videoUrl);
  const safeThumb = thumbUrl ? escapeHtml(thumbUrl) : "";
  const safePage = escapeHtml(pageUrl);
  const safeFallback = escapeHtml(fallback);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />

    <meta property="og:type" content="video.other" />
    <meta property="og:site_name" content="5Stack" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:url" content="${safePage}" />
    ${safeThumb ? `<meta property="og:image" content="${safeThumb}" />` : ""}
    ${safeThumb ? `<meta property="og:image:secure_url" content="${safeThumb}" />` : ""}
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />

    <meta property="og:video" content="${safeVideo}" />
    <meta property="og:video:secure_url" content="${safeVideo}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="1280" />
    <meta property="og:video:height" content="720" />
    ${durationSec ? `<meta property="og:video:duration" content="${durationSec}" />` : ""}

    <meta name="twitter:card" content="player" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:player" content="${safeVideo}" />
    <meta name="twitter:player:width" content="1280" />
    <meta name="twitter:player:height" content="720" />
    <meta name="twitter:player:stream" content="${safeVideo}" />
    <meta name="twitter:player:stream:content_type" content="video/mp4" />
    ${safeThumb ? `<meta name="twitter:image" content="${safeThumb}" />` : ""}

    <meta http-equiv="refresh" content="0; url=${safeFallback}" />
    <script>window.location.replace(${JSON.stringify(fallback)});</script>
    <style>
      body { font-family: system-ui, sans-serif; background: #0b0b0e; color: #e5e5e5; margin: 0; padding: 2rem; }
      a { color: #f5a524; }
    </style>
  </head>
  <body>
    <p>Loading clip… <a href="${safeFallback}">click here if you're not redirected</a>.</p>
  </body>
</html>`;
});
