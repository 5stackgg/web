import { Client } from "typesense";

const client = new Client({
  nodes: [
    {
      host: "search.5stack.gg",
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

  return await client
    .collections("players")
    .documents()
    .search({
      q: query ?? "*",
      query_by: queryBy,
      sort_by: "name:asc",
      ...(body.teamId ? { filter_by: `teams:${body.teamId}` } : {}),
    });
});
