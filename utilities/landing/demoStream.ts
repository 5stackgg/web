import {
  demoMap,
  demoMatch,
  demoPicks,
  demoRewindRounds,
  withDecider,
} from "~/utilities/demoMatch";

export const DEMO_TOURNAMENT_NAME = "Weekend Cup";

export const DEMO_STREAM_VIEWERS = 1284;

// The FAQ demo's match mid-way through its second map, as the welcome page's
// stream and its bracket's live semifinal. That map is moved to Inferno so
// the caption names the map on the poster.
export function demoStreamMatch() {
  const match = demoMatch({
    step: "live",
    picks: withDecider(demoPicks(8)),
    rounds: demoRewindRounds(),
  });
  return {
    ...match,
    scheduled_at: null,
    tournament_brackets: [
      { stage: { tournament: { name: DEMO_TOURNAMENT_NAME } } },
    ],
    match_maps: match.match_maps.map((matchMap) =>
      matchMap.is_current_map
        ? { ...matchMap, map: demoMap("de_inferno") }
        : matchMap,
    ),
  };
}

export type DemoStreamMatch = ReturnType<typeof demoStreamMatch>;
