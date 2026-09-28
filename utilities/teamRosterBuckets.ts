import { e_team_roster_statuses_enum } from "~/generated/zeus";

export interface RosterMember {
  coach?: boolean | null;
  status?: e_team_roster_statuses_enum | string | null;
}

export interface TeamRosterBuckets<T extends RosterMember> {
  starters: T[];
  substitutes: T[];
  bench: T[];
  coaches: T[];
}

/**
 * A coach can also hold a playing slot, and the roster trigger counts them
 * against the starter and substitute caps, so a playing coach sits in that
 * slot's bucket. Only a benched coach (a pure coach) goes under Coaches, which
 * keeps every member in exactly one bucket.
 */
export function teamRosterBuckets<T extends RosterMember>(
  roster: T[],
): TeamRosterBuckets<T> {
  const buckets: TeamRosterBuckets<T> = {
    starters: [],
    substitutes: [],
    bench: [],
    coaches: [],
  };

  for (const member of roster) {
    if (member.status === e_team_roster_statuses_enum.Starter) {
      buckets.starters.push(member);
    } else if (member.status === e_team_roster_statuses_enum.Substitute) {
      buckets.substitutes.push(member);
    } else if (member.status === e_team_roster_statuses_enum.Benched) {
      if (member.coach) {
        buckets.coaches.push(member);
      } else {
        buckets.bench.push(member);
      }
    }
  }

  return buckets;
}
