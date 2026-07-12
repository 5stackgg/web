// Link-unfurl shim for events (see server/utils/unfurl.ts). Crawlers fetching
// /events/<id> get a server-rendered OG card (banner + name + description);
// real browsers fall through to the SPA. Only Public events are unfurled — a
// private/unlisted event returns nothing so its details never leak to a bot.

const EVENT_QUERY = `query EventForUnfurl($id: uuid!) {
  events_by_pk(id: $id) {
    id
    name
    description
    visibility
    starts_at
    ends_at
    banner { filename mime_type thumbnail_filename }
    teams_aggregate { aggregate { count } }
    tournaments_aggregate { aggregate { count } }
  }
}`;

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return null;
  }
}

export default defineEventHandler(async (event) => {
  if (event.method !== "GET") {
    return;
  }

  const url = getRequestURL(event);
  if (url.searchParams.has("ufl")) {
    return;
  }

  const match = url.pathname.match(/^\/events\/([^/]+)\/?$/);
  if (!match) {
    return;
  }

  const id = decodeURIComponent(match[1]);
  if (id === "create" || id === "manage") {
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

  let record: any = null;
  try {
    const res = await $fetch<{ data?: any }>(`https://${apiDomain}/v1/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": adminSecret,
      },
      body: { query: EVENT_QUERY, variables: { id } },
    });
    record = res?.data?.events_by_pk ?? null;
  } catch (err) {
    console.error("[events-unfurl] fetch failed:", err);
  }

  // Unfurl Public and Friends events (both are meant to be shared); Private
  // ("only people involved") falls through to the SPA so its details never
  // reach a crawler.
  if (!record || (record.visibility !== "Public" && record.visibility !== "Friends")) {
    return;
  }

  const origin = `${getRequestProtocol(event)}://${getRequestHost(event)}`;
  const pageUrl = `${origin}/events/${encodeURIComponent(record.id)}`;
  const humanUrl = `${pageUrl}?ufl=1`;
  const title: string = record.name || "Event";

  // Banner → OG image. Images serve directly; a video banner falls back to its
  // captured thumbnail. Media for public events is publicly fetchable.
  const banner = record.banner;
  let image: string | null = null;
  if (banner?.filename && banner.mime_type?.startsWith("image/")) {
    image = `https://${apiDomain}/events/media/${record.id}/${banner.filename}`;
  } else if (banner?.thumbnail_filename) {
    image = `https://${apiDomain}/events/media/${record.id}/${banner.thumbnail_filename}`;
  }

  // Description: prefer the organizer's blurb; otherwise synthesize one from
  // the date range and team/tournament counts.
  const start = formatDate(record.starts_at);
  const end = formatDate(record.ends_at);
  const dateRange = start && end && start !== end ? `${start} – ${end}` : start || end;
  const teamCount = record.teams_aggregate?.aggregate?.count ?? 0;
  const tournamentCount = record.tournaments_aggregate?.aggregate?.count ?? 0;
  const facts = [
    dateRange,
    teamCount ? `${teamCount} ${teamCount === 1 ? "team" : "teams"}` : null,
    tournamentCount
      ? `${tournamentCount} ${tournamentCount === 1 ? "tournament" : "tournaments"}`
      : null,
  ].filter(Boolean);
  const description = truncate(
    record.description ||
      (facts.length
        ? `Counter-Strike event on 5Stack · ${facts.join(" · ")}`
        : "Counter-Strike event on 5Stack."),
  );

  setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=300");

  return renderUnfurl({
    title,
    description,
    pageUrl,
    humanUrl,
    image,
    imageAlt: title,
  });
});
