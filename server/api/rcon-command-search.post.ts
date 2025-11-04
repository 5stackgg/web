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

  const results = await client
    .collections("cvars")
    .documents()
    .search({
      q: body.query?.trim() ?? "*",
      query_by: "name,description",
      sort_by: "_text_match:desc,name:asc",
      infix: ["fallback"],
    });

  return results;
});
