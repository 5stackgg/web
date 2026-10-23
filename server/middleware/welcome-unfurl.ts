// The welcome page for crawlers. The app is a SPA (ssr: false), so a crawler
// fetching / or /welcome gets an empty shell; this answers search engines and
// link previews with the page's own copy as plain HTML instead. It is the same
// text the page shows (from en.json, gated by the same settings), so what is
// indexed is what people see. Browsers fall through to the app as usual.
import en from "../../i18n/locales/en.json";

const copy = (en as any).pages.welcome;
const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

export default defineEventHandler(async (event) => {
  if (event.method !== "GET") return;

  const url = getRequestURL(event);
  if (url.searchParams.has("ufl")) return;
  if (!/^\/(welcome\/?)?$/.test(url.pathname)) return;
  if (!BOT_UA.test(getRequestHeader(event, "user-agent") || "")) return;

  const settings = await loadPublicSettings();
  const on = (name: string) => settings[name] !== "false";
  const name = settings["public.brand_name"] || "5Stack";
  const webDomain = process.env.NUXT_PUBLIC_WEB_DOMAIN;
  const origin = webDomain
    ? `https://${webDomain}`
    : `${url.protocol}//${url.host}`;
  const matchmaking = settings["public.matchmaking"] !== "false";

  const section = (
    key: string,
    points: Array<[string, boolean?]>,
    link?: [string, string],
    lede?: string,
  ) => {
    const block = copy[key];
    const items = points
      .filter(([, shown]) => shown !== false)
      .map(
        ([point]) =>
          `<li><strong>${escapeHtml(block.points[point].title)}</strong> ${escapeHtml(block.points[point].body)}</li>`,
      )
      .join("");
    return `<section id="${key}">
      <p>${escapeHtml(block.eyebrow)}</p>
      <h2>${escapeHtml(block.title)}</h2>
      <p>${escapeHtml(lede ?? block.lede)}</p>
      <ul>${items}</ul>
      ${link ? `<p><a href="${link[0]}">${escapeHtml(block[link[1]])}</a></p>` : ""}
    </section>`;
  };

  const title = `${copy.hero.title} · ${name}`;
  const description = fill(copy.meta_description, { name });
  const contact =
    webDomain === "5stack.gg"
      ? "hello@5stack.gg"
      : null;
  const image = `${origin}/branding/og.png?v=${brandCardVersion(brandCardBrand(settings))}`;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: `${origin}/`,
    description,
  });

  setResponseHeaders(event, unfurlCacheHeaders(600));
  setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${origin}/welcome" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(name)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${origin}/welcome" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${BRAND_CARD_WIDTH}" />
    <meta property="og:image:height" content="${BRAND_CARD_HEIGHT}" />
    <meta property="og:image:alt" content="${escapeHtml(name)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">${schema}</script>
    <style>
      body { font-family: system-ui, sans-serif; background: #09090b; color: #fafafa; margin: 0 auto; padding: 2rem; max-width: 64rem; line-height: 1.6; }
      a { color: #f99e2f; }
    </style>
  </head>
  <body>
    <header>
      <p>${escapeHtml(fill(copy.hero.eyebrow, { name }))}</p>
      <h1>${escapeHtml(copy.hero.title)}</h1>
      <p>${escapeHtml(matchmaking ? copy.hero.lede : copy.hero.lede_draft)}</p>
      <p><a href="/play">${escapeHtml(copy.nav.open_play)}</a> · <a href="/watch">${escapeHtml(copy.nav.watch_live)}</a></p>
    </header>
    <main>
      ${section(
        "play",
        [
          ["matchmaking", matchmaking],
          ["draft"],
          ["scrims", on("public.scrim_finder_enabled")],
          ["servers"],
          ["check_in"],
        ],
        ["/play", "link"],
        matchmaking ? copy.play.lede : copy.play.lede_draft,
      )}
      ${section("match", [["veto"], ["servers"], ["fix"], ["voice", on("public.voice_chat_enabled")]])}
      ${section("match_page", [["scoreboard"], ["economy"], ["head_to_head"], ["utility"]])}
      ${section(
        "compete",
        [
          ["tournaments"],
          ["leagues", settings["public.leagues_enabled"] === "true"],
          ["events", settings["public.events_enabled"] === "true"],
          ["awards"],
        ],
        ["/tournaments", "link"],
      )}
      ${section("watch", [["streams"], ["match_pages"], ["povs"], ["news", settings["public.news_enabled"] === "true"]], ["/watch", "link"])}
      ${section("rewatch", [["replays"], ["highlights"], ["editor"]], ["/highlights", "link"])}
      ${section("utility", [["previews"], ["library"], ["executes"], ["practice"], ["solver"]], ["/utility", "link"])}
      ${webDomain === "5stack.gg" ? section("inventory", [["craft"], ["loadouts"], ["inspect"], ["value"], ["profile"]]) : ""}
      ${section("community",[["chat"], ["voice", on("public.voice_chat_enabled")], ["teams"], ["notifications"], ["bans"]])}
      <section>
        <h2>${escapeHtml(copy.cta.title)}</h2>
        <p><a href="/play">${escapeHtml(copy.nav.open_play)}</a></p>
      </section>
    </main>
    <footer>
      <p>${escapeHtml(copy.footer.tagline)}</p>
      <p>
        ${contact ? `<a href="mailto:${contact}">${contact}</a> · ` : ""}<a href="/terms">Terms</a> ·
        <a href="/privacy">Privacy</a> · <a href="/privacy#cookies">${escapeHtml(copy.footer.cookies)}</a>
      </p>
      <p>
        © ${new Date().getFullYear()} ${escapeHtml(name)} ·
        <a href="https://5stack.gg">Powered by 5Stack</a> ·
        <a href="https://docs.5stack.gg">${escapeHtml(copy.footer.run_own)}</a>
      </p>
      <p>${escapeHtml(fill(copy.footer.valve, { name }))}</p>
    </footer>
  </body>
</html>`;
});
