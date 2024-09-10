import { Client } from "typesense";

const client = new Client({
  nodes: [
    {
      host: process.env.NUXT_PUBLIC_TYPESENSE_HOST as string,
      port: 443,
      protocol: "https",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY as string,
  connectionTimeoutSeconds: 2,
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  let query = body.query?.trim();

  let queryBy = "name,steam_id";

  let exclude = "";
  if (body.exclude && Array.isArray(body.exclude)) {
    body.exclude.forEach((steamId: string) => {
      exclude += (exclude ? " && " : "") + `steam_id:!=${steamId}`;
    });
  }

  return await client
    .collections("players")
    .documents()
    .search({
      q: query ?? "*",
      query_by: queryBy,
      sort_by: "name:asc",
      infix: ["fallback", "off"],
      ...(body.exclude ? { filter_by: exclude } : {}),
      ...(body.teamId ? { filter_by: `teams:${body.teamId}` } : {}),
      ...(body.page ? { page: body.page } : {}),
      ...(body.per_page ? { per_page: body.per_page } : {}),
    });
});
