export default {
    id: true,
    name: true,
    team: {
        name: true,
    },
    roster: [
        {},
        {
           role: true,
            player: {
                name: true,
                steam_id: true,
                avatar_url: true,
            },
        },
    ],
    roster_aggregate: [
        {},
        {
            aggregate: {
                count: true,
            },
        },
    ],
    // matches: [{}, matchFields],
}