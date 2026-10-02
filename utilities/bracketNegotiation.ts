import { e_match_status_enum } from "~/generated/zeus";
import {
  canRespondTo,
  type Bracket as LeagueBracket,
  type Proposal,
} from "~/utilities/leagueFixtures";

export type BracketNegotiationStatus =
  | "pending-me"
  | "pending-them"
  | "agreed"
  | "default";

export type NegotiationTournament = {
  scheduling_mode?: string | null;
  league_season_division?: { id?: string | null } | null;
};

export type NegotiationBracket = {
  round?: number | null;
  bye?: boolean | null;
  finished?: boolean | null;
  scheduled_at?: string | null;
  team_1?: { id?: string | null; team_id?: string | null } | null;
  team_2?: { id?: string | null; team_id?: string | null } | null;
  match?: { status?: string | null; scheduled_at?: string | null } | null;
  scheduling_proposals?: Proposal[] | null;
  recent_proposals?: Proposal[] | null;
};

export type NegotiationViewer = {
  isAdmin: boolean;
  mySteamId?: string | null;
  managedTeamIds: string[];
  teamManagers: Record<string, string[]>;
};

export type NegotiationWindow = {
  round: number;
  opens_at?: string | null;
  closes_at?: string | null;
  default_match_at?: string | null;
};

const RESCHEDULABLE_STATUSES: string[] = [
  e_match_status_enum.Scheduled,
  e_match_status_enum.WaitingForCheckIn,
];

const FALLBACK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function isNegotiableBracket(
  tournament: NegotiationTournament | null | undefined,
  bracket: NegotiationBracket,
): boolean {
  if (tournament?.scheduling_mode !== "negotiated") {
    return false;
  }
  if (tournament.league_season_division) {
    return false;
  }
  if (bracket.bye || bracket.finished) {
    return false;
  }
  if (!bracket.team_1?.id || !bracket.team_2?.id) {
    return false;
  }
  if (!bracket.match) {
    return true;
  }
  return RESCHEDULABLE_STATUSES.includes(bracket.match.status ?? "");
}

export function managesBracket(
  bracket: NegotiationBracket,
  managedTeamIds: string[],
): boolean {
  return [bracket.team_1?.team_id, bracket.team_2?.team_id].some(
    (teamId) => !!teamId && managedTeamIds.includes(teamId),
  );
}

export function canNegotiateBracket(
  bracket: NegotiationBracket,
  viewer: NegotiationViewer,
): boolean {
  return viewer.isAdmin || managesBracket(bracket, viewer.managedTeamIds);
}

// tbu_league_scheduling_proposals only lets the team that did not propose
// accept, so a teammate of the proposer is on the waiting side too.
function managesAnsweringTeam(
  bracket: NegotiationBracket,
  proposal: Proposal,
  viewer: NegotiationViewer,
): boolean {
  const proposer = String(proposal.proposed_by_steam_id);
  return [bracket.team_1?.team_id, bracket.team_2?.team_id].some(
    (teamId) =>
      !!teamId &&
      viewer.managedTeamIds.includes(teamId) &&
      !(viewer.teamManagers[teamId] ?? [String(viewer.mySteamId)]).includes(
        proposer,
      ),
  );
}

export function canRespondToBracketProposal(
  bracket: NegotiationBracket,
  proposal: Proposal,
  viewer: NegotiationViewer,
): boolean {
  return canRespondTo(bracket as unknown as LeagueBracket, proposal, {
    isAdmin: viewer.isAdmin,
    mySteamId: viewer.mySteamId,
    mine: managesAnsweringTeam(bracket, proposal, viewer),
  });
}

function bracketProposals(bracket: NegotiationBracket): Proposal[] {
  const byId = new Map<string, Proposal>();
  for (const proposal of [
    ...(bracket.scheduling_proposals ?? []),
    ...(bracket.recent_proposals ?? []),
  ]) {
    byId.set(proposal.id, proposal);
  }
  return [...byId.values()];
}

export function bracketPendingProposals(
  bracket: NegotiationBracket,
): Proposal[] {
  return bracketProposals(bracket).filter(
    (proposal) => proposal.status === "Pending",
  );
}

export function bracketProposalHistory(
  bracket: NegotiationBracket,
): Proposal[] {
  return bracketProposals(bracket).filter(
    (proposal) => proposal.status !== "Pending",
  );
}

export function bracketAgreedAt(bracket: NegotiationBracket): string | null {
  return bracket.match?.scheduled_at ?? bracket.scheduled_at ?? null;
}

export function bracketNegotiationStatus(
  bracket: NegotiationBracket,
  viewer: NegotiationViewer,
): BracketNegotiationStatus {
  const pending = bracketPendingProposals(bracket);
  if (pending.length) {
    const awaitingMe = pending.some(
      (proposal) =>
        proposal.proposed_by_steam_id !== viewer.mySteamId &&
        canRespondToBracketProposal(bracket, proposal, viewer),
    );
    return awaitingMe ? "pending-me" : "pending-them";
  }
  return bracketAgreedAt(bracket) ? "agreed" : "default";
}

export function bracketProposalWindow(
  windows: NegotiationWindow[] | null | undefined,
  bracket: NegotiationBracket,
  now: Date,
): {
  opensAt: string;
  closesAt: string;
  defaultMatchAt: string | null;
  roundWindow: boolean;
} {
  const window = (windows ?? []).find(
    (entry) => entry.round === bracket.round,
  );
  // tbi_league_scheduling_proposals allows only the next two weeks when the
  // round has no window. The propose form needs a closing bound, so an
  // open-ended window borrows that cap.
  const twoWeeksOut = new Date(
    now.getTime() + FALLBACK_WINDOW_MS,
  ).toISOString();
  return {
    opensAt: window?.opens_at ?? now.toISOString(),
    closesAt: window?.closes_at ?? twoWeeksOut,
    defaultMatchAt: window?.default_match_at ?? null,
    roundWindow: !!window,
  };
}
