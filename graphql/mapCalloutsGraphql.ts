import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

// Every argument goes through a GraphQL variable rather than being inlined --
// see the note at the top of utilityGraphql.ts.

export const mapCalloutFields = {
  map_name: true,
  name: true,
  boxes: true,
  source: true,
} as const;

export const mapCalloutsQuery = generateQuery({
  map_callouts: [
    {
      where: { map_name: { _eq: $("mapName", "String!") } },
      order_by: [{ name: order_by.asc }],
    },
    mapCalloutFields,
  ],
});
