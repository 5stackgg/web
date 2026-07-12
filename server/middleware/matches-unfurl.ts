// Link-unfurl shim for matches (see server/utils/unfurl.ts). Crawlers fetching
// /matches/<id> get a server-rendered OG card (map screenshot + teams + score
// + status); real browsers fall through to the SPA.

const MATCH_QUERY = `query MatchForUnfurl($id: uuid!) {
  matches_by_pk(id: $id) {
    id
    status
    label
    lineup_1_id
    lineup_2_id
    winning_lineup_id
    e_match_status { description }
    options { best_of type }
    lineup_1 { name team { name short_name avatar_url } }
    lineup_2 { name team { name short_name avatar_url } }
    match_maps(order_by: { order: asc }) {
      is_current_map
      lineup_1_score
      lineup_2_score
      winning_lineup_id
      map { name label poster }
    }
    tournament_brackets(limit: 1) {
      stage { tournament { name } }
    }
  }
}`;

const SCORED_STATUSES = new Set([
  "Live",
  "Finished",
  "Forfeit",
  "Surrendered",
  "Tie",
]);

export default defineEventHandler(async (event) => {
  if (event.method !== "GET") {
    return;
  }

  const url = getRequestURL(event);
  if (url.searchParams.has("ufl")) {
    return;
  }

  // Only the match root — deeper paths (playback, etc.) keep the SPA.
  const match = url.pathname.match(/^\/matches\/([^/]+)\/?$/);
  if (!match) {
    return;
  }

  const id = decodeURIComponent(match[1]);
  if (id === "create") {
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
      body: { query: MATCH_QUERY, variables: { id } },
    });
    record = res?.data?.matches_by_pk ?? null;
  } catch (err) {
    console.error("[matches-unfurl] fetch failed:", err);
  }

  if (!record) {
    return;
  }

  const origin = `${getRequestProtocol(event)}://${getRequestHost(event)}`;
  const pageUrl = `${origin}/matches/${encodeURIComponent(record.id)}`;
  const humanUrl = `${pageUrl}?ufl=1`;

  const l1 = record.lineup_1?.name || "TBD";
  const l2 = record.lineup_2?.name || "TBD";
  const maps: any[] = record.match_maps || [];
  const scored = SCORED_STATUSES.has(record.status);

  // Score: a single-map match shows the round score; a series shows map wins.
  let scoreLine = "";
  if (scored && maps.length) {
    if (maps.length === 1 || record.options?.best_of === 1) {
      const only = maps[0];
      scoreLine = `${only.lineup_1_score ?? 0} - ${only.lineup_2_score ?? 0}`;
    } else {
      let s1 = 0;
      let s2 = 0;
      for (const m of maps) {
        if (m.winning_lineup_id === record.lineup_1_id) s1++;
        else if (m.winning_lineup_id === record.lineup_2_id) s2++;
      }
      if (s1 + s2 > 0) scoreLine = `${s1} - ${s2}`;
    }
  }

  const title = scoreLine ? `${l1} ${scoreLine} ${l2}` : `${l1} vs ${l2}`;

  // Description facts: status, maps, series length, tournament.
  const statusText = record.e_match_status?.description || record.status;
  const mapNames = maps
    .map((m) => m.map?.label || m.map?.name)
    .filter(Boolean);
  const tournamentName =
    record.tournament_brackets?.[0]?.stage?.tournament?.name || null;
  const bestOf =
    record.options?.best_of && record.options.best_of > 1
      ? `Best of ${record.options.best_of}`
      : null;
  const facts = [
    statusText,
    mapNames.length ? mapNames.join(", ") : null,
    bestOf,
    tournamentName,
  ].filter(Boolean);
  const description = truncate(facts.join(" · ") || "Counter-Strike match on 5Stack.");

  // Image: prefer a map screenshot (large card). Pick the current map, else the
  // last decided map, else the first. Workshop posters are absolute Steam CDN
  // urls; standard maps fall back to our own local screenshot.
  const imageMap =
    maps.find((m) => m.is_current_map && m.map) ||
    [...maps].reverse().find((m) => m.winning_lineup_id && m.map) ||
    maps.find((m) => m.map) ||
    null;
  let image: string | null = null;
  let imageWidth: number | undefined;
  let imageHeight: number | undefined;
  if (imageMap?.map) {
    const poster = imageMap.map.poster;
    if (typeof poster === "string" && /^https?:\/\//.test(poster)) {
      image = poster;
    } else if (imageMap.map.name) {
      image = `${origin}/img/maps/screenshots/${imageMap.map.name}.webp`;
    }
    if (image) {
      imageWidth = 1280;
      imageHeight = 720;
    }
  }
  // No map yet (pre-veto): fall back to a team avatar for a small card.
  if (!image) {
    const avatar =
      record.lineup_1?.team?.avatar_url || record.lineup_2?.team?.avatar_url;
    if (avatar) image = `https://${apiDomain}/${avatar}`;
  }

  setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=120");

  return renderUnfurl({
    title,
    description,
    pageUrl,
    humanUrl,
    image,
    imageAlt: title,
    imageWidth,
    imageHeight,
  });
});
