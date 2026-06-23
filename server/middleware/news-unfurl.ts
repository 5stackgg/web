// Link-unfurl shim for news articles. Nuxt runs as a SPA (ssr: false), so the
// OG/Twitter tags set in pages/news/[slug].vue never reach crawlers. Discord,
// Slack, Twitter, etc. fetch /news/<slug>; this middleware sniffs their
// user-agent and answers with server-rendered OG tags (cover image + teaser).
// Real browsers don't match the bot regex, so the middleware returns nothing
// and the request falls through to the normal SPA at the same URL — no
// redirect, no loop. A misdetected human gets bounced to ?ufl=1, which the
// middleware skips, so they still land on the app.

const BOT_UA =
  /(discordbot|twitterbot|facebookexternalhit|facebot|slackbot|slack-imgproxy|telegrambot|whatsapp|linkedinbot|redditbot|embedly|quora link preview|pinterest|vkshare|skypeuripreview|iframely|googlebot|bingbot|applebot|mastodon|nuzzel|w3c_validator|developers\.google\.com\/\+\/web\/snippet)/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const NEWS_QUERY = `query NewsForUnfurl($slug: String!) {
  news_articles(where: { slug: { _eq: $slug }, status: { _eq: "published" } }, limit: 1) {
    slug
    title
    teaser
    cover_image_url
    published_at
  }
}`;

export default defineEventHandler(async (event) => {
  if (event.method !== "GET") {
    return;
  }

  const url = getRequestURL(event);
  if (url.searchParams.has("ufl")) {
    return;
  }

  const match = url.pathname.match(/^\/news\/([^/]+)\/?$/);
  if (!match) {
    return;
  }

  const slug = decodeURIComponent(match[1]);
  if (slug === "manage") {
    return;
  }

  const ua = getRequestHeader(event, "user-agent") || "";
  if (!BOT_UA.test(ua)) {
    return;
  }

  const apiDomain = process.env.NUXT_PUBLIC_API_DOMAIN;
  const adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;
  if (!apiDomain || !adminSecret) {
    return;
  }

  let article: any = null;
  try {
    const res = await $fetch<{ data?: any }>(
      `https://${apiDomain}/v1/graphql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": adminSecret,
        },
        body: { query: NEWS_QUERY, variables: { slug } },
      },
    );
    article = res?.data?.news_articles?.[0] ?? null;
  } catch (err) {
    console.error("[news-unfurl] fetch failed:", err);
  }

  if (!article) {
    return;
  }

  const origin = `${getRequestProtocol(event)}://${getRequestHost(event)}`;
  const pageUrl = `${origin}/news/${encodeURIComponent(article.slug)}`;
  const humanUrl = `${pageUrl}?ufl=1`;
  const title: string = article.title || "News";
  const description: string = article.teaser || title;
  const image: string | null = article.cover_image_url ?? null;

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = image ? escapeHtml(image) : "";
  const safePage = escapeHtml(pageUrl);
  const safeHuman = escapeHtml(humanUrl);
  const publishedAt = article.published_at
    ? escapeHtml(new Date(article.published_at).toISOString())
    : "";

  setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=300");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="5Stack" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:url" content="${safePage}" />
    ${publishedAt ? `<meta property="article:published_time" content="${publishedAt}" />` : ""}
    ${safeImage ? `<meta property="og:image" content="${safeImage}" />` : ""}
    ${safeImage ? `<meta property="og:image:secure_url" content="${safeImage}" />` : ""}
    ${safeImage ? `<meta property="og:image:width" content="1280" />` : ""}
    ${safeImage ? `<meta property="og:image:height" content="720" />` : ""}
    ${safeImage ? `<meta property="og:image:alt" content="${safeTitle}" />` : ""}

    <meta name="twitter:card" content="${safeImage ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    ${safeImage ? `<meta name="twitter:image" content="${safeImage}" />` : ""}

    <meta http-equiv="refresh" content="0; url=${safeHuman}" />
    <style>
      body { font-family: system-ui, sans-serif; background: #0a0a0c; color: #f4f1ea; margin: 0; padding: 2rem; }
      a { color: #f99e2f; }
    </style>
  </head>
  <body>
    <p>${safeTitle} — <a href="${safeHuman}">open the article</a>.</p>
  </body>
</html>`;
});
