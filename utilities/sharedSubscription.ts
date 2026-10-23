import {
  Kind,
  visit,
  type DocumentNode,
  type FieldNode,
  type OperationDefinitionNode,
  type SelectionNode,
  type SelectionSetNode,
} from "graphql";

// A subscription read the same by every viewer except for a few fields is
// split in two: the shared half is read as a guest on the public client, so
// everyone watching shares one Hasura poll, and the personal half carries only
// what depends on who is asking, on the viewer's own session.
//
// For these roles every table these pages read gives the rows a guest gets.
// A signed-out visitor is a guest on both halves, so they share the same poll
// rather than one of their own. Moderators and above see more, and read the
// whole document as before.
const SHARED_ROLES = new Set(["user", "verified_user", "streamer"]);

export function readsShared(role: string | null | undefined): boolean {
  return !role || SHARED_ROLES.has(role);
}

const keyOf = (field: FieldNode) => (field.alias ?? field.name).value;

const ID: FieldNode = {
  kind: Kind.FIELD,
  name: { kind: Kind.NAME, value: "id" },
};

// Paths are dotted from the root field, by alias where one is set.
export function splitSubscription(
  document: DocumentNode,
  personalPaths: string[],
): { shared: DocumentNode; personal: DocumentNode } {
  const paths = personalPaths.map((path) => path.split("."));
  const is = (at: string[]) =>
    paths.some((path) => path.join(".") === at.join("."));
  const leadsTo = (at: string[]) =>
    paths.some(
      (path) =>
        path.length > at.length &&
        path.slice(0, at.length).join(".") === at.join("."),
    );

  const shared = (set: SelectionSetNode, at: string[]): SelectionSetNode => ({
    ...set,
    selections: set.selections.flatMap((selection): SelectionNode[] => {
      if (selection.kind !== Kind.FIELD) {
        return [selection];
      }
      const path = [...at, keyOf(selection)];
      if (is(path)) {
        return [];
      }
      if (selection.selectionSet && leadsTo(path)) {
        return [
          { ...selection, selectionSet: shared(selection.selectionSet, path) },
        ];
      }
      return [selection];
    }),
  });

  // Each level keeps its id, and each list its arguments, so the personal
  // rows line up with the shared ones.
  const personal = (set: SelectionSetNode, at: string[]): SelectionSetNode => {
    const selections: FieldNode[] = [];
    if (
      set.selections.some(
        (selection) =>
          selection.kind === Kind.FIELD && keyOf(selection) === "id",
      )
    ) {
      selections.push(ID);
    }
    for (const selection of set.selections) {
      if (selection.kind !== Kind.FIELD || keyOf(selection) === "id") {
        continue;
      }
      const path = [...at, keyOf(selection)];
      if (is(path)) {
        selections.push(selection);
      } else if (selection.selectionSet && leadsTo(path)) {
        selections.push({
          ...selection,
          selectionSet: personal(selection.selectionSet, path),
        });
      }
    }
    return { ...set, selections };
  };

  const operation = document.definitions[0] as OperationDefinitionNode;
  const root = operation.selectionSet.selections[0] as FieldNode;
  const withRoot = (selectionSet: SelectionSetNode): DocumentNode => ({
    ...document,
    definitions: [
      {
        ...operation,
        selectionSet: {
          ...operation.selectionSet,
          selections: [{ ...root, selectionSet }],
        },
      },
    ],
  });

  return {
    shared: withRoot(shared(root.selectionSet!, [])),
    personal: withUsedVariables(withRoot(personal(root.selectionSet!, []))),
  };
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

// The personal half laid over the shared one: objects merge, and list rows
// take their personal fields from the personal row with the same id.
export function joinShared(shared: any, personal: any): any {
  if (Array.isArray(shared) && Array.isArray(personal)) {
    const byId = new Map(personal.map((row) => [row?.id, row]));
    return shared.map((row) =>
      row && byId.has(row.id) ? joinShared(row, byId.get(row.id)) : row,
    );
  }
  if (
    shared &&
    personal &&
    typeof shared === "object" &&
    typeof personal === "object"
  ) {
    const joined = { ...shared };
    for (const [key, value] of Object.entries(personal)) {
      joined[key] = key in shared ? joinShared(shared[key], value) : value;
    }
    return joined;
  }
  return personal === undefined ? shared : personal;
}
