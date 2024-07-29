import {$, order_by, Selector} from "~/generated/zeus";
import {mapFields} from "~/graphql/mapGraphql";

export const matchLineups = Selector("match_lineups")(
    {
        id: true,
        name: true,
        team_id: true,
        coach: {
            name: true,
            steam_id: true,
            avatar_url: true,
        },
        captain: {
            placeholder_name: true,
            player: {
                name: true,
                steam_id: true,
            },
        },
        lineup_players: [
            {
                order_by: [
                    {
                        player: {
                            name: $("order_by_name", "order_by"),
                            kills_aggregate: {
                                count: $("order_by_kills", "order_by"),
                            },
                        },
                    },
                ],
            },
            {
                captain: true,
                steam_id: true,
                player: {
                    name: true,
                    steam_id: true,
                    avatar_url: true,
                    kills_aggregate: [
                        {
                            where: {
                                match_id: {
                                    _eq: $("matchId", "uuid!"),
                                },
                            },
                        },
                        {
                            aggregate: [
                                {},
                                {
                                    count: true,
                                },
                            ],
                        },
                    ],
                    assists_aggregate: [
                        {
                            where: {
                                match_id: {
                                    _eq: $("matchId", "uuid!"),
                                },
                            },
                        },
                        {
                            aggregate: [
                                {},
                                {
                                    count: true,
                                },
                            ],
                        },
                    ],
                    deaths_aggregate: [
                        {
                            where: {
                                match_id: {
                                    _eq: $("matchId", "uuid!"),
                                },
                            },
                        },
                        {
                            aggregate: [
                                {},
                                {
                                    count: true,
                                },
                            ],
                        },
                    ],
                    damage_dealt_aggregate: [
                        {
                            where: {
                                match_id: {
                                    _eq: $("matchId", "uuid!"),
                                },
                                team_damage: {
                                    _eq: false,
                                },
                            },
                        },
                        {
                            aggregate: [
                                {},
                                {
                                    sum: {
                                        damage: true,
                                    },
                                },
                            ],
                        },
                    ],
                    multi_kills: [
                        {
                            where: {
                                match_id: {
                                    _eq: $("matchId", "uuid!"),
                                },
                            },
                        },
                        {
                            kills: true,
                        },
                    ],
                    flashed_players_aggregate: [
                        {
                            where: {
                                match_id: {
                                    _eq: $("matchId", "uuid!"),
                                },
                            },
                        },
                        {
                            aggregate: [
                                {},
                                {
                                    count: true,
                                },
                            ],
                        },
                    ],
                    __alias: {
                        hs_kills_aggregate: {
                            kills_aggregate: [
                                {
                                    where: {
                                        match_id: {
                                            _eq: $("matchId", "uuid!"),
                                        },
                                        headshot: {
                                            _eq: true,
                                        },
                                    },
                                },
                                {
                                    aggregate: [
                                        {},
                                        {
                                            count: true,
                                        },
                                    ],
                                },
                            ],
                        },
                        zeus_kills_aggregate: {
                            kills_aggregate: [
                                {
                                    where: {
                                        match_id: {
                                            _eq: $("matchId", "uuid!"),
                                        },
                                        with: {
                                            _eq: "taser",
                                        },
                                    },
                                },
                                {
                                    aggregate: [
                                        {},
                                        {
                                            count: true,
                                        },
                                    ],
                                },
                            ],
                        },
                        knife_kills_aggregate: {
                            kills_aggregate: [
                                {
                                    where: {
                                        match_id: {
                                            _eq: $("matchId", "uuid!"),
                                        },
                                        with: {
                                            _eq: "knife",
                                        },
                                    },
                                },
                                {
                                    aggregate: [
                                        {},
                                        {
                                            count: true,
                                        },
                                    ],
                                },
                            ],
                        },
                        team_flashes_aggregate: {
                            flashed_players_aggregate: [
                                {
                                    where: {
                                        team_flash: {
                                            _eq: true,
                                        },
                                        match_id: {
                                            _eq: $("matchId", "uuid!"),
                                        },
                                    },
                                },
                                {
                                    aggregate: [
                                        {},
                                        {
                                            count: true,
                                        },
                                    ],
                                },
                            ],
                        },
                        avg_flash_duration_aggregate: {
                            flashed_players_aggregate: [
                                {
                                    where: {
                                        match_id: {
                                            _eq: $("matchId", "uuid!"),
                                        },
                                    },
                                },
                                {
                                    aggregate: [
                                        {},
                                        {
                                            avg: {
                                                duration: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        flashes_thrown_aggregate: {
                            utility_thrown_aggregate: [
                                {
                                    where: {
                                        type: {
                                            _eq: "Flash",
                                        },
                                        match_id: {
                                            _eq: $("matchId", "uuid!"),
                                        },
                                    },
                                },
                                {
                                    aggregate: [
                                        {},
                                        {
                                            count: true,
                                        },
                                    ],
                                },
                            ],
                        },
                        team_damage_aggregate: {
                            damage_dealt_aggregate: [
                                {
                                    where: {
                                        match_id: {
                                            _eq: $("matchId", "uuid!"),
                                        },
                                        team_damage: {
                                            _eq: true,
                                        },
                                    },
                                },
                                {
                                    aggregate: [
                                        {},
                                        {
                                            sum: {
                                                damage: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        he_damage_aggregate: {
                            damage_dealt_aggregate: [
                                {
                                    where: {
                                        with: {
                                            _eq: "hegrenade",
                                        },
                                        match_id: {
                                            _eq: $("matchId", "uuid!"),
                                        },
                                        team_damage: {
                                            _eq: false,
                                        },
                                    },
                                },
                                {
                                    aggregate: [
                                        {},
                                        {
                                            sum: {
                                                damage: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        molotov_damage_aggregate: {
                            // TODO - non team damage
                            damage_dealt_aggregate: [
                                {
                                    where: {
                                        with: {
                                            _eq: "molotov",
                                        },
                                        match_id: {
                                            _eq: $("matchId", "uuid!"),
                                        },
                                        team_damage: {
                                            _eq: false,
                                        },
                                    },
                                },
                                {
                                    aggregate: [
                                        {},
                                        {
                                            sum: {
                                                damage: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
            },
        ],
    });
