import { Client } from "typesense";
import gql from "graphql-tag";
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
} from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";

// Hand-written instead of `generateMutation` from ~/graphql/graphqlGen: that
// pulls the 14.5 MB generated Zeus module into the Nitro server bundle, which
// OOMs rollup during `nuxt build`.
const INSERT_PLAYERS = gql`
  mutation InsertPlayers($objects: [players_insert_input!]!) {
    insert_players(
      objects: $objects
      on_conflict: {
        update_columns: [name]
        constraint: players_steam_id_key
      }
    ) {
      affected_rows
    }
  }
`;

const client = new Client({
  nodes: [
    {
      host:
        process.env.TYPESENSE_SERVICE_HOST ||
        (process.env.NUXT_PUBLIC_TYPESENSE_HOST as string),
      port: process.env.TYPESENSE_SERVICE_HOST ? 8108 : 443,
      protocol: process.env.TYPESENSE_SERVICE_HOST ? "http" : "https",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY as string,
  connectionTimeoutSeconds: 2,
});

const httpLink = createHttpLink({
  uri: `https://${process.env.NUXT_PUBLIC_API_DOMAIN}/v1/graphql`,
});

const authLink = setContext((_, { headers }) => {
  return {
    headers: {
      ...headers,
      "x-hasura-admin-secret": process.env.HASURA_GRAPHQL_ADMIN_SECRET,
    },
  };
});

const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  let query = body.query?.trim();

  let queryBy = "name,steam_id";

  // Build filter_by string
  let filterBy: string[] = [];

  // Exclude certain players
  if (body.exclude && Array.isArray(body.exclude)) {
    body.exclude.forEach((steamId: string) => {
      filterBy.push(`steam_id:!=${steamId}`);
    });
  }

  // Sort/filter on the unified rating (competitive, else wingman, else duel) —
  // the number the UI actually renders. Ranking on `_competitive` alone leaves
  // every wingman/duel-only player tied as "missing".
  const eloTrack = body.elo_track || "season";
  const eloField = eloTrack === "tournament" ? "tournament_elo" : "elo";

  const [rawSortField, rawSortDirection] = String(
    body.sort_by || "name:asc",
  ).split(":");
  const sortField = rawSortField || "name";
  const sortDirection = rawSortDirection === "desc" ? "desc" : "asc";

  // Unrated players always sink to the bottom, and ties fall back to name so
  // the order is stable instead of arbitrary.
  const sortBy =
    sortField === "elo"
      ? `${eloField}(missing_values: last):${sortDirection},name:asc`
      : `${sortField}:${sortDirection}`;

  if (body.registeredOnly || sortField === "last_sign_in_at") {
    // Both spellings, because `is_registered` is an optional field added with
    // this change: until the full re-index finishes, no existing document
    // carries it and matching on it alone returns nothing at all. The
    // `last_sign_in_at` sentinel ("~~" for never signed in) is what every
    // already-indexed document has, so it covers the gap and drops out
    // naturally once every document has been rewritten.
    filterBy.push(`(is_registered:=true || last_sign_in_at:!~~)`);
  }

  // Presence is live app state, not something the index knows, so the caller
  // sends the roster it can see and results are constrained to it.
  const onlineSteamIds = Array.isArray(body.online_steam_ids)
    ? body.online_steam_ids.filter((id: unknown) => /^[0-9]+$/.test(String(id)))
    : null;

  // Nobody online has to mean no results. Falling through to an unfiltered
  // search would return everyone, which reads as "the filter is broken".
  if (onlineSteamIds && onlineSteamIds.length === 0) {
    return { found: 0, hits: [] };
  }

  if (onlineSteamIds) {
    filterBy.push(`steam_id:[${onlineSteamIds.join(",")}]`);
  }

  // Filter by team
  if (body.teamId) {
    filterBy.push(`teams:${body.teamId}`);
  }

  // Filter by roles/privileges
  if (body.roles && Array.isArray(body.roles) && body.roles.length > 0) {
    const rolesFilter = body.roles
      .map((role: string) => `role:=${role}`)
      .join(" || ");
    filterBy.push(`(${rolesFilter})`);
  }

  if (body.only_played_matches) {
    filterBy.push(`total_matches:>0`);
  }

  // Both bounds read the same rating, so a min and a max can't be satisfied by
  // two different ladders (competitive 6000 + wingman 4000 used to pass both
  // "at least 5500" and "at most 4500" at once).
  if (body.elo_min !== undefined && body.elo_min !== null) {
    filterBy.push(`${eloField}:>=${body.elo_min}`);
  }

  if (body.elo_max !== undefined && body.elo_max !== null) {
    filterBy.push(`${eloField}:<=${body.elo_max}`);
  }

  // Filter by countries
  if (
    body.countries &&
    Array.isArray(body.countries) &&
    body.countries.length > 0
  ) {
    const countriesFilter = body.countries
      .map((country: string) => `country:=${country}`)
      .join(" || ");
    filterBy.push(`(${countriesFilter})`);
  }

  // Filter by sanctions minimum count
  if (body.sanctions_min !== undefined && body.sanctions_min !== null) {
    filterBy.push(`sanctions:>=${body.sanctions_min}`);
  }

  // Filter by is_banned
  if (body.is_banned !== undefined && body.is_banned !== null) {
    filterBy.push(`is_banned:=${body.is_banned}`);
  }

  // Filter by is_gagged
  if (body.is_gagged !== undefined && body.is_gagged !== null) {
    filterBy.push(`is_gagged:=${body.is_gagged}`);
  }

  // Filter by is_muted
  if (body.is_muted !== undefined && body.is_muted !== null) {
    filterBy.push(`is_muted:=${body.is_muted}`);
  }

  const searchParams: any = {
    q: query ?? "*",
    query_by: queryBy,
    sort_by: sortBy,
    infix: ["fallback", "off"],
    ...(filterBy.length > 0 ? { filter_by: filterBy.join(" && ") } : {}),
    ...(body.page ? { page: body.page } : {}),
    ...(body.per_page ? { per_page: body.per_page } : {}),
  };

  // documents().search() is a GET with every param in the query string, so a
  // presence filter listing hundreds of steam ids can overrun the request line
  // and come back as a hard error. multiSearch sends the same search as a POST
  // body, which has no such ceiling.
  const results = onlineSteamIds
    ? (
        await client.multiSearch.perform<any[]>({
          searches: [{ collection: "players", ...searchParams }],
        })
      ).results[0]
    : await client.collections("players").documents().search(searchParams);

  if (body.registeredOnly) {
    return results;
  }

  // Only do Steam API search if we have a query and no results found. A search
  // scoped to who is online can't be satisfied by a Steam account we have never
  // seen, so that path stays out of it.
  if (
    process.env.STEAM_API_KEY &&
    !body.teamId &&
    !onlineSteamIds &&
    query &&
    results.found === 0
  ) {
    try {
      const steamData = query.match(/^[0-9]+$/)
        ? await searchBySteamId(query)
        : await searchByAcountName(query);

      if (steamData.response?.players?.length > 0) {
        const players = steamData.response.players as {
          steamid: string;
          avatar: string;
          personaname: string;
          profileurl: string;
          loccountrycode: string;
        }[];

        await apolloClient.mutate({
          mutation: INSERT_PLAYERS,
          variables: {
            objects: players.map((player) => ({
              name: player.personaname,
              steam_id: player.steamid,
              avatar_url: player.avatar,
              profile_url: player.profileurl,
              country: player.loccountrycode,
            })),
          },
        });

        return {
          found: players.length,
          hits: players.map((player) => ({
            document: {
              name: player.personaname,
              steam_id: player.steamid,
              avatar_url: player.avatar,
              profile_url: player.profileurl,
              country: player.loccountrycode,
            },
          })),
        };
      }
    } catch (error) {
      console.error("Error fetching Steam API:", error);
    }
  }

  return results;
});

async function searchBySteamId(steamId: string) {
  const steamResponse = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`,
  );
  return await steamResponse.json();
}

async function searchByAcountName(accountName: string) {
  const steamResponse = await fetch(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${process.env.STEAM_API_KEY}&vanityurl=${accountName}`,
  );

  if (steamResponse.status !== 200) {
    return {
      response: {
        players: [],
      },
    };
  }

  const {
    response: { steamid: steamId },
  } = await steamResponse.json();

  return searchBySteamId(steamId);
}
