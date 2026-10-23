// The welcome page's players, shaped like the api's: the FAQ demo's cast. Every
// id is made up; useDemoFaces gives them their avatars.

export type DemoPlayer = {
  steam_id: string;
  name: string;
  country: string;
  role: string;
  avatar_url: null;
  elo: { competitive: number };
};

function player(
  name: string,
  country: string,
  competitive: number,
): DemoPlayer {
  return {
    steam_id: `demo-${name.toLowerCase()}`,
    name,
    country,
    role: "user",
    avatar_url: null,
    elo: { competitive },
  };
}

export const DEMO_PLAYERS = {
  vexa: player("vexa", "US", 6214),
  Moritz: player("Moritz", "US", 6480),
  kuro: player("kuro", "US", 6988),
  deadlock: player("deadlock", "US", 5760),
  Pip: player("Pip", "US", 6102),
  Saffron: player("Saffron", "US", 7512),
  tomek: player("tomek", "US", 5390),
  Juno: player("Juno", "US", 5640),
  brisk: player("brisk", "US", 6655),
  OLLIE: player("OLLIE", "US", 5903),
} satisfies Record<string, DemoPlayer>;

export const DEMO_STATS_PLAYER = DEMO_PLAYERS.vexa;

// vexa's last sixteen matches, four a night three days apart, ending on the
// +24 win the hero shows.
const ELO_CHANGES = [
  19, -22, 27, 31, -18, 24, 28, -26, 22, 33, -17, 29, 21, -24, 30, 24,
];
const HOUR_MS = 60 * 60 * 1000;

export function demoEloHistory(now = Date.now()) {
  let elo =
    DEMO_STATS_PLAYER.elo.competitive -
    ELO_CHANGES.reduce((sum, change) => sum + change, 0);
  return ELO_CHANGES.map((change, index) => {
    const current = elo;
    elo += change;
    return {
      match_id: `demo-elo-${index}`,
      match_created_at: new Date(
        now -
          (3 - Math.floor(index / 4)) * 72 * HOUR_MS -
          (3 - (index % 4)) * HOUR_MS,
      ).toISOString(),
      current_elo: current,
      updated_elo: elo,
      elo_change: change,
      type: "Competitive",
    };
  });
}

