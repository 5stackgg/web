import { describe, expect, it } from "vitest";
import { print } from "graphql";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { bracketProposalSelection } from "~/graphql/bracketNegotiation";

describe("bracketProposalSelection", () => {
  const [pendingArgs] = bracketProposalSelection.scheduling_proposals;
  const [recentArgs] =
    bracketProposalSelection.__alias.recent_proposals.scheduling_proposals;

  it("subscribes to every pending proposal", () => {
    expect(pendingArgs.where.status).toEqual({ _eq: "Pending" });
    expect(pendingArgs.limit).toBeUndefined();
  });

  it("keeps only a short recent history of settled proposals", () => {
    expect(recentArgs.where.status).toEqual({ _neq: "Pending" });
    expect(recentArgs.limit).toBe(5);
    expect(recentArgs.order_by).toEqual([{ created_at: "desc" }]);
  });

  it("leaves league division fixtures to the league schedule", () => {
    for (const args of [pendingArgs, recentArgs]) {
      expect(args.where.bracket).toEqual({
        stage: {
          tournament: { _not: { league_season_division: {} } },
        },
      });
    }
  });
});

describe("bracketProposalSelection document", () => {
  it("renders the pending and recent selections on a bracket", () => {
    const document = print(
      typedGql("subscription")({
        tournament_brackets: [{}, { id: true, ...bracketProposalSelection }],
      } as any),
    );

    expect(document).toContain("recent_proposals: scheduling_proposals(");
    expect(document).toMatch(/status: \{_eq: Pending\}/);
    expect(document).toMatch(/status: \{_neq: Pending\}/);
    expect(document).toContain("limit: 5");
  });
});
