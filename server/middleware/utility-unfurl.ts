// Link-unfurl shim for utility lineups (see server/utils/unfurl.ts). A lineup
// is shared as /utility/<map>?lineup=<id>; crawlers fetching it get the
// lineup's card, with its rendered clip playing inline when it has one. Only
// Public, unarchived lineups unfurl -- anything else falls through to the SPA
// and its generic card.

const LINEUP_QUERY = `query UtilityLineupForUnfurl($id: uuid!) {
  utility_lineups_by_pk(id: $id) {
    id
    name
    description
    map_name
    utility_type
    side
    technique
    throw_strength
    visibility
    archived_at
    approach
    preview_url
    preview_thumbnail_url
    preview_stills_url
    preview_duration_ms
  }
}`;

const MAP_QUERY = `query UtilityMapForUnfurl($name: String!) {
  maps(where: { name: { _eq: $name } }, limit: 1) {
    label
    poster
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

  // The old /utility/lineup/<id> route is still what a share without a map
  // name resolves to.
  const legacy = url.pathname.match(/^\/utility\/lineup\/([^/]+)\/?$/);
  const onMap = /^\/utility\/[^/]+\/?$/.test(url.pathname);
  const id = legacy
    ? decodeURIComponent(legacy[1])
    : onMap
      ? url.searchParams.get("lineup")
      : null;
  if (!id) {
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

  const query = async (body: { query: string; variables: object }) => {
    const res = await $fetch<{ data?: any }>(
      `https://${apiDomain}/v1/graphql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": adminSecret,
        },
        body,
      },
    );
    return res?.data ?? null;
  };

  let lineup: any = null;
  try {
    const data = await query({ query: LINEUP_QUERY, variables: { id } });
    lineup = data?.utility_lineups_by_pk ?? null;
  } catch (err) {
    console.error("[utility-unfurl] lineup fetch failed:", err);
  }

  if (!lineup || lineup.visibility !== "Public" || lineup.archived_at) {
    return;
  }

  let map: UtilityLineupUnfurlMap | null = null;
  try {
    const data = await query({
      query: MAP_QUERY,
      variables: { name: lineup.map_name },
    });
    map = data?.maps?.[0] ?? null;
  } catch (err) {
    console.error("[utility-unfurl] map fetch failed:", err);
  }

  const origin = `${getRequestProtocol(event)}://${getRequestHost(event)}`;
  const options = utilityLineupUnfurlOptions(lineup, origin, map);
  if (!options) {
    return;
  }

  setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
  setResponseHeaders(event, unfurlCacheHeaders(300));

  return renderUnfurl(options);
});
