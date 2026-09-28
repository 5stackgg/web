import { describe, expect, it } from "vitest";
import { teamRosterBuckets } from "~/utilities/teamRosterBuckets";

const member = (name: string, status: string, coach = false) => ({
  name,
  status,
  coach,
});

const names = (members: Array<{ name: string }>) =>
  members.map((entry) => entry.name);

describe("teamRosterBuckets", () => {
  it("keeps a playing coach in the slot they hold", () => {
    const buckets = teamRosterBuckets([
      member("starter", "Starter"),
      member("starting-coach", "Starter", true),
      member("sub", "Substitute"),
      member("sub-coach", "Substitute", true),
    ]);

    expect(names(buckets.starters)).toEqual(["starter", "starting-coach"]);
    expect(names(buckets.substitutes)).toEqual(["sub", "sub-coach"]);
    expect(buckets.coaches).toEqual([]);
  });

  it("lists a benched coach under coaches, not the bench", () => {
    const buckets = teamRosterBuckets([
      member("benched", "Benched"),
      member("coach", "Benched", true),
    ]);

    expect(names(buckets.bench)).toEqual(["benched"]);
    expect(names(buckets.coaches)).toEqual(["coach"]);
  });

  it("counts five starters when one of them coaches", () => {
    const buckets = teamRosterBuckets([
      member("a", "Starter"),
      member("b", "Starter"),
      member("c", "Starter"),
      member("d", "Starter"),
      member("coach", "Starter", true),
    ]);

    expect(buckets.starters).toHaveLength(5);
  });

  it("puts every member in exactly one bucket", () => {
    const roster = [
      member("starter", "Starter"),
      member("starting-coach", "Starter", true),
      member("sub", "Substitute"),
      member("sub-coach", "Substitute", true),
      member("benched", "Benched"),
      member("coach", "Benched", true),
    ];

    const { starters, substitutes, bench, coaches } =
      teamRosterBuckets(roster);
    const placed = [...starters, ...substitutes, ...bench, ...coaches];

    expect(placed).toHaveLength(roster.length);
    expect(new Set(placed).size).toBe(roster.length);
  });

  it("keeps the roster order within a bucket", () => {
    const buckets = teamRosterBuckets([
      member("second", "Starter", true),
      member("first", "Starter"),
    ]);

    expect(names(buckets.starters)).toEqual(["second", "first"]);
  });
});
