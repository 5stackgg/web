import { Kind, visit, type ASTNode, type DocumentNode } from "graphql";

// Everyone watching a match reads the same rounds, kills and lineups. For
// these roles every table the match page reads gives the rows a guest gets,
// so they read the match as a guest, sharing one Hasura poll with every other
// viewer, and only what is theirs on their own session. A signed-out visitor
// is a guest on both halves, so they share that poll too. Moderators and above
// see more of the match than a guest, and read it whole as before.
const SHARED_ROLES = new Set(["user", "verified_user", "streamer"]);

// What depends on the viewer: fields answered from the session, draft lobbies
// a guest can't see, and tournaments still in setup that organizers can.
const PERSONAL_MATCH_FIELDS = [
  "invite_code",
  "draft_games",
  "can_start",
  "can_check_in",
  "tournament_brackets",
  "connection_link",
  "connection_string",
  "tv_connection_string",
];
const PERSONAL_LINEUP_FIELDS = [
  "is_on_lineup",
  "can_pick_map_veto",
  "can_pick_region_veto",
  "can_update_lineup",
];
const LINEUPS = ["lineup_1", "lineup_2"];

export function readsMatchShared(role: string | null | undefined): boolean {
  return !role || SHARED_ROLES.has(role);
}

function at(ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>) {
  return ancestors
    .filter((node): node is ASTNode => !Array.isArray(node))
    .filter((node: any) => node.kind === Kind.FIELD)
    .map((node: any) => (node.alias ?? node.name).value)
    .join(".");
}

function withUsedVariables(document: DocumentNode): DocumentNode {
  const used = new Set<string>();
  visit(document, {
    Variable(node, _key, parent: any) {
      if (parent?.kind !== Kind.VARIABLE_DEFINITION) {
        used.add(node.name.value);
      }
    },
  });
  return visit(document, {
    VariableDefinition(node) {
      return used.has(node.variable.name.value) ? undefined : null;
    },
  });
}

// The match page's subscription as its shared half (what a guest is answered)
// and its personal half (the viewer's own fields, by id).
export function splitMatchSubscription(document: DocumentNode) {
  const shared = visit(document, {
    Field(node, _key, _parent, _path, ancestors) {
      const path = at(ancestors);
      const name = node.name.value;
      if (path === "matches_by_pk" && PERSONAL_MATCH_FIELDS.includes(name)) {
        return null;
      }
      if (
        LINEUPS.some((lineup) => path === `matches_by_pk.${lineup}`) &&
        PERSONAL_LINEUP_FIELDS.includes(name)
      ) {
        return null;
      }
    },
  });
  const personal = visit(document, {
    Field(node, _key, _parent, _path, ancestors) {
      const path = at(ancestors);
      const name = node.name.value;
      if (
        path === "matches_by_pk" &&
        !["id", ...PERSONAL_MATCH_FIELDS, ...LINEUPS].includes(name)
      ) {
        return null;
      }
      if (
        LINEUPS.some((lineup) => path === `matches_by_pk.${lineup}`) &&
        !["id", ...PERSONAL_LINEUP_FIELDS].includes(name)
      ) {
        return null;
      }
    },
  });
  return { shared, personal: withUsedVariables(personal) };
}

// The two halves as the one match the page has always had.
export function joinMatchHalves(
  shared: Record<string, any>,
  personal: Record<string, any>,
): Record<string, any> {
  const match: Record<string, any> = { ...shared, ...personal };
  for (const lineup of LINEUPS) {
    match[lineup] = shared[lineup]
      ? { ...shared[lineup], ...(personal[lineup] ?? {}) }
      : shared[lineup];
  }
  return match;
}
