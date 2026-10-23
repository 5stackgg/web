import { DEMO_LINEUPS, DEMO_PLAYER_NAMES } from "~/utilities/demoMatch";

// The welcome page's one cast: Kestrel (vexa, Moritz, kuro, deadlock, Pip)
// against Ironside (Saffron, tomek, Juno, brisk, OLLIE), all from the US, with
// made-up faces and crests kept in public/landing.
export const DEMO_COUNTRY = "US";

const CREST_FILES: Record<1 | 2, string> = { 1: "kestrel", 2: "ironside" };
const CAST = new Set(
  [...DEMO_PLAYER_NAMES[1], ...DEMO_PLAYER_NAMES[2]].map((name) =>
    name.toLowerCase(),
  ),
);

// Avatars and crests resolve against the api unless they are absolute.
export function useDemoFaces() {
  const origin = useRequestURL().origin;

  const avatar = (name: string) =>
    CAST.has(name.toLowerCase())
      ? `${origin}/landing/avatars/${name.toLowerCase()}.svg`
      : null;
  const crest = (lineup: 1 | 2) =>
    `${origin}/landing/teams/${CREST_FILES[lineup]}.svg`;
  const team = (lineup: 1 | 2) => ({
    name: DEMO_LINEUPS[lineup].name,
    avatar_url: crest(lineup),
  });

  function dress<T extends { name: string } | null | undefined>(player: T): T {
    if (!player) return player;
    return {
      ...player,
      avatar_url: avatar(player.name) ?? (player as any).avatar_url ?? null,
      country: DEMO_COUNTRY,
    };
  }

  // A demo match's lineups, named and crested, with their players' faces.
  function dressMatch<M extends { lineup_1: any; lineup_2: any }>(match: M): M {
    const lineup = (value: any, slot: 1 | 2) => ({
      ...value,
      name: DEMO_LINEUPS[slot].name,
      team: team(slot),
      lineup_players: (value.lineup_players ?? []).map((member: any) => ({
        ...member,
        player: dress(member.player),
      })),
    });
    return {
      ...match,
      lineup_1: lineup(match.lineup_1, 1),
      lineup_2: lineup(match.lineup_2, 2),
    };
  }

  return { avatar, crest, team, dress, dressMatch };
}
