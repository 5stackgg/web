import {
  e_match_map_status_enum,
  e_match_mode_enum,
  e_match_status_enum,
  e_tournament_stage_types_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
import { DEMO_LINEUPS } from "~/utilities/demoMatch";
import {
  DEMO_TOURNAMENT_NAME,
  demoStreamMatch,
} from "~/utilities/landing/demoStream";

// An eight-team single-elimination playoff as the api hands it over, so the
// real bracket draws it. Every id is made up.

type Score = [number, number];

type Slot = {
  round: number;
  number: number;
  // Seeds; null is a slot still waiting on its feeder.
  teams: [number, number | null];
  maps?: Score[];
  live?: boolean;
};

const ROUNDS = 3;
const BEST_OF = 3;

// By seed. The FAQ demo's lineups meet in the second semifinal, which is the
// match on the welcome page's stream.
const TEAMS = [
  "Night Owls",
  DEMO_LINEUPS[2].name,
  DEMO_LINEUPS[1].name,
  "Paper Tigers",
  "Lowground",
  "Kettle Club",
  "Halfbuy",
  "Second Wind",
];

const SLOTS: Slot[] = [
  { round: 1, number: 1, teams: [1, 8], maps: [[13, 6], [13, 10]] },
  { round: 1, number: 2, teams: [4, 5], maps: [[13, 11], [8, 13], [14, 16]] },
  { round: 1, number: 3, teams: [3, 6], maps: [[13, 9], [10, 13], [13, 11]] },
  { round: 1, number: 4, teams: [2, 7], maps: [[13, 4], [13, 11]] },
  { round: 2, number: 1, teams: [1, 5], maps: [[13, 11], [9, 13], [13, 7]] },
  { round: 2, number: 2, teams: [3, 2], live: true },
  { round: 3, number: 1, teams: [1, null] },
];

const uuid = (group: string, tail: string) =>
  `00000000-0000-0000-${group}-${tail.padStart(12, "0")}`;

const bracketId = (round: number, number: number) =>
  uuid("0003", `${round}${number}`);
const lineupId = (round: number, number: number, slot: number) =>
  uuid("0006", `${round}${number}${slot}`);

const teamName = (seed: number) => TEAMS[seed - 1];

const team = (seed: number | null) =>
  seed
    ? { id: uuid("0004", `${seed}`), name: teamName(seed), team: null }
    : null;

const bracketRef = (round: number, number: number) => ({
  id: bracketId(round, number),
  round,
  group: 1,
  match_number: number,
  path: "WB",
});

const lineup = (id: string, name: string) => ({ id, name, team_id: null });

function finishedMatch({ round, number, teams, maps = [] }: Slot) {
  const ids = [lineupId(round, number, 1), lineupId(round, number, 2)];
  const lineup1Wins = maps.filter(([a, b]) => a > b).length;
  return {
    id: uuid("0005", `${round}${number}`),
    status: e_match_status_enum.Finished,
    winning_lineup_id: ids[lineup1Wins * 2 > maps.length ? 0 : 1],
    lineup_1_id: ids[0],
    lineup_2_id: ids[1],
    options: { best_of: BEST_OF },
    match_maps: maps.map(([a, b], index) => ({
      lineup_1_score: a,
      lineup_2_score: b,
      winning_lineup_id: ids[a > b ? 0 : 1],
      order: index + 1,
      status: e_match_map_status_enum.Finished,
    })),
    lineup_1: lineup(ids[0], teamName(teams[0])),
    lineup_2: lineup(ids[1], teamName(teams[1]!)),
  };
}

function liveMatch() {
  const match = demoStreamMatch();
  return {
    id: match.id,
    status: match.status,
    winning_lineup_id: null,
    lineup_1_id: match.lineup_1_id,
    lineup_2_id: match.lineup_2_id,
    options: { best_of: match.options.best_of },
    match_maps: match.match_maps.map((matchMap) => ({
      lineup_1_score: matchMap.lineup_1_score,
      lineup_2_score: matchMap.lineup_2_score,
      winning_lineup_id: matchMap.winning_lineup_id,
      order: matchMap.order,
      status: matchMap.status,
    })),
    lineup_1: lineup(match.lineup_1.id, match.lineup_1.name),
    lineup_2: lineup(match.lineup_2.id, match.lineup_2.name),
  };
}

// Tomorrow evening.
function finalStart() {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(19, 0, 0, 0);
  return start.toISOString();
}

function bracket(slot: Slot) {
  const { round, number, teams } = slot;
  const feeders =
    round === 1
      ? []
      : [number * 2 - 1, number * 2].map((feeder) => {
          const feed = SLOTS.find(
            (other) => other.round === round - 1 && other.number === feeder,
          )!;
          return {
            ...bracketRef(round - 1, feeder),
            parent_bracket_id: bracketId(round, number),
            loser_parent_bracket_id: null,
            team_1_seed: feed.round === 1 ? feed.teams[0] : null,
            team_2_seed: feed.round === 1 ? feed.teams[1] : null,
          };
        });
  return {
    ...bracketRef(round, number),
    bye: false,
    finished: !!slot.maps,
    scheduled_at: round === ROUNDS ? finalStart() : null,
    scheduled_eta: null,
    team_1_seed: round === 1 ? teams[0] : null,
    team_2_seed: round === 1 ? teams[1] : null,
    loser_parent_bracket_id: null,
    match_options_id: null,
    options: null,
    parent_bracket:
      round < ROUNDS ? bracketRef(round + 1, Math.ceil(number / 2)) : null,
    loser_bracket: null,
    feeding_brackets: feeders,
    match: slot.maps ? finishedMatch(slot) : slot.live ? liveMatch() : null,
    team_1: team(teams[0]),
    team_2: team(teams[1]),
    created_at: "2026-10-01T18:00:00.000Z",
  };
}

export function demoBracketTournament() {
  const options = { best_of: BEST_OF, match_mode: e_match_mode_enum.auto };
  return {
    id: uuid("0003", "1"),
    name: DEMO_TOURNAMENT_NAME,
    status: e_tournament_status_enum.Live,
    is_organizer: false,
    auto_start: true,
    scheduling_mode: "auto",
    options,
    stages: [
      {
        id: uuid("0003", "0"),
        type: e_tournament_stage_types_enum.SingleElimination,
        // A playoff after the groups, so its rounds read Quarter Finals on.
        order: 2,
        groups: 1,
        max_teams: TEAMS.length,
        third_place_match: false,
        e_tournament_stage_type: { description: "Single Elimination" },
        options,
        brackets: SLOTS.map(bracket),
      },
    ],
  };
}

export type DemoBracketTournament = ReturnType<typeof demoBracketTournament>;
