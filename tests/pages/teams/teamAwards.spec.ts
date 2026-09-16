import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import {
  Kind,
  valueFromASTUntyped,
  type DocumentNode,
  type FieldNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from "graphql";
import TeamPage from "~/pages/teams/[id].vue";
import TeamsIndexPage from "~/pages/teams/index.vue";
import AwardCase from "~/components/award/AwardCase.vue";

const award = (id: string, name: string, tier: string) => ({
  id,
  name,
  description: null,
  tier,
  silhouette: null,
  image_url: null,
  system_key: null,
  allow_multiple: false,
});

const team1 = { id: "team-1", name: "Alpha", short_name: "ALP" };
const team2 = { id: "team-2", name: "Bravo", short_name: "BRV" };

const rows = [
  {
    id: "manual-team-1",
    award_id: "award-heroes",
    award: award("award-heroes", "Community Heroes", "special"),
    source: "manual",
    team_id: team1.id,
    team: team1,
    player_steam_id: null,
    tournament_id: null,
    tournament: null,
    tournament_team_id: null,
    tournament_team: null,
    tournament_award: null,
    placement: null,
    placement_tier: null,
    note: null,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "manual-player-1",
    award_id: "award-heroes",
    award: award("award-heroes", "Community Heroes", "special"),
    source: "manual",
    team_id: null,
    team: null,
    player_steam_id: "76561198000000001",
    tournament_id: null,
    tournament: null,
    tournament_team_id: null,
    tournament_team: null,
    tournament_award: null,
    placement: null,
    placement_tier: null,
    note: null,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "tournament-team-1",
    award_id: "award-gold",
    award: award("award-gold", "Tournament Champion", "gold"),
    source: "tournament",
    team_id: team1.id,
    team: team1,
    player_steam_id: null,
    tournament_id: "tournament-1",
    tournament: {
      id: "tournament-1",
      name: "Spring Cup",
      start: "2026-03-01T00:00:00Z",
      stages: [],
    },
    tournament_team_id: "tt-1",
    tournament_team: {
      name: "Alpha",
      team_id: team1.id,
      team: team1,
    },
    tournament_award: null,
    placement: 1,
    placement_tier: null,
    note: null,
    created_at: "2026-03-10T00:00:00Z",
  },
  {
    id: "manual-team-2",
    award_id: "award-heroes",
    award: award("award-heroes", "Community Heroes", "special"),
    source: "manual",
    team_id: team2.id,
    team: team2,
    player_steam_id: null,
    tournament_id: null,
    tournament: null,
    tournament_team_id: null,
    tournament_team: null,
    tournament_award: null,
    placement: null,
    placement_tier: null,
    note: null,
    created_at: "2026-09-02T00:00:00Z",
  },
];

function rootField(document: DocumentNode): FieldNode {
  const operation = document.definitions.find(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION,
  )!;
  return operation.selectionSet.selections[0] as FieldNode;
}

const OPERATORS: Record<string, (value: any, expected: any) => boolean> = {
  _eq: (value, expected) => value != null && String(value) === String(expected),
  _is_null: (value, expected) => (value == null) === expected,
};

function matchesWhere(row: any, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "_and") {
      return condition.every((part: any) => matchesWhere(row, part));
    }
    if (key === "_or") {
      return condition.some((part: any) => matchesWhere(row, part));
    }
    if (key === "_not") {
      return !matchesWhere(row, condition);
    }
    const value = row?.[key];
    const operators = Object.keys(condition).filter((name) =>
      name.startsWith("_"),
    );
    if (operators.length === 0) {
      return value != null && matchesWhere(value, condition);
    }
    return operators.every((operator) => {
      if (!OPERATORS[operator]) {
        throw new Error(`unsupported operator ${operator}`);
      }
      return OPERATORS[operator](value, condition[operator]);
    });
  });
}

function project(value: any, selectionSet?: SelectionSetNode): any {
  if (!selectionSet || value == null) {
    return value ?? null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => project(item, selectionSet));
  }
  const result: Record<string, any> = {};
  for (const selection of selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) {
      continue;
    }
    const key = selection.alias?.value ?? selection.name.value;
    result[key] = project(value[selection.name.value], selection.selectionSet);
  }
  return result;
}

function runSubscription(
  document: DocumentNode,
  variables: Record<string, any>,
): any[] {
  const field = rootField(document);
  const whereArgument = field.arguments?.find(
    (argument) => argument.name.value === "where",
  );
  const where = whereArgument
    ? valueFromASTUntyped(whereArgument.value, variables)
    : {};
  return rows
    .filter((row) => matchesWhere(row, where))
    .map((row) => project(row, field.selectionSet));
}

function computedContext(component: any, state: Record<string, any>) {
  const context: Record<string, any> = { ...state };
  for (const [name, definition] of Object.entries<any>(component.computed)) {
    const getter =
      typeof definition === "function" ? definition : definition.get;
    Object.defineProperty(context, name, {
      get: () => getter.call(context),
    });
  }
  return context;
}

describe("team page awards", () => {
  const subscription = (TeamPage as any).apollo.$subscribe.teamAwards;

  function teamAwardsFor(teamId: string) {
    // Nuxt compiles this.$route in pages to read this._.provides first.
    const context: Record<string, any> = {
      _: { provides: {} },
      $route: { params: { id: teamId } },
      teamAwards: [],
    };
    const data = {
      award_recipients: runSubscription(
        subscription.query,
        subscription.variables.call(context),
      ),
    };
    subscription.result.call(context, { data });
    return context.teamAwards as any[];
  }

  it("includes a manually granted team award that has no tournament", () => {
    const ids = teamAwardsFor(team1.id).map((grant) => grant.id);

    expect(ids).toContain("manual-team-1");
    expect(ids).toContain("tournament-team-1");
    expect(ids).not.toContain("manual-player-1");
    expect(ids).not.toContain("manual-team-2");
  });

  it("shows the manual team award in the team's award case", async () => {
    const wrapper = await mountSuspended(AwardCase, {
      props: { awards: teamAwardsFor(team1.id), hideMvp: true },
    });

    expect(wrapper.text()).toContain("Community Heroes");
    expect(wrapper.text()).toContain("Spring Cup");
  });
});

describe("teams list awards", () => {
  const subscription = (TeamsIndexPage as any).apollo.$subscribe.teamAwards;

  function listContext() {
    const context = computedContext(TeamsIndexPage, { teamAwards: [] });
    subscription.result.call(context, {
      data: {
        award_recipients: runSubscription(subscription.query.call(context), {}),
      },
    });
    return context;
  }

  it("groups a manually granted team award under its team", () => {
    const { awardsByTeamId } = listContext();

    expect(
      (awardsByTeamId[team1.id] ?? []).map((grant: any) => grant.id).sort(),
    ).toEqual(["manual-team-1", "tournament-team-1"]);
    expect(
      (awardsByTeamId[team2.id] ?? []).map((grant: any) => grant.id),
    ).toEqual(["manual-team-2"]);
  });

  it("does not count a manual award towards the tournament winners filter", () => {
    const { winnerTeamIds } = listContext();

    expect(winnerTeamIds).toEqual([team1.id]);
  });
});
