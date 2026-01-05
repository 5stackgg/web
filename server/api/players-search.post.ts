import { Client } from "typesense";
import { generateMutation } from "~/graphql/graphqlGen";
import { players_update_column, players_constraint } from "~/generated/zeus";
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
} from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";

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

  if (body.registeredOnly) {
    filterBy.push(`last_sign_in_at:!~~`);
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

  // Filter by elo range
  // If only_played_matches is true, ensure elo_min is at least 1
  let effectiveEloMin = body.elo_min;
  if (body.only_played_matches) {
    // Players who have played matches will have elo >= 1 (assuming starting elo is 0 or 1)
    effectiveEloMin =
      effectiveEloMin !== undefined && effectiveEloMin !== null
        ? Math.max(1, effectiveEloMin)
        : 1;
  }

  if (effectiveEloMin !== undefined && effectiveEloMin !== null) {
    filterBy.push(
      `(elo_competitive:>=${effectiveEloMin} || elo_wingman:>=${effectiveEloMin} || elo_duel:>=${effectiveEloMin})`,
    );
  }

  if (body.elo_max !== undefined && body.elo_max !== null) {
    filterBy.push(
      `(elo_competitive:<=${body.elo_max} || elo_wingman:<=${body.elo_max} || elo_duel:<=${body.elo_max})`,
    );
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

  // Use provided sort_by or default to name:asc
  let sortBy = body.sort_by || "name:asc";

  if (sortBy.includes("elo")) {
    sortBy = sortBy.replace("elo", "elo_competitive");
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

  const results = await client
    .collections("players")
    .documents()
    .search(searchParams);

  if (body.registeredOnly) {
    return results;
  }

  // Only do Steam API search if we have a query and no results found
  if (
    process.env.STEAM_API_KEY &&
    !body.teamId &&
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
          mutation: generateMutation({
            insert_players: [
              {
                objects: players.map((player) => ({
                  name: player.personaname,
                  steam_id: player.steamid,
                  avatar_url: player.avatar,
                  profile_url: player.profileurl,
                  country: player.loccountrycode,
                })),
                on_conflict: {
                  update_columns: [players_update_column.name],
                  constraint: players_constraint.players_steam_id_key,
                },
              },
              {
                affected_rows: true,
              },
            ],
          }),
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
