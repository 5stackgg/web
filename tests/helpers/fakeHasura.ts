import { Kind, valueFromASTUntyped } from "graphql";
import type { DocumentNode, FieldNode, OperationDefinitionNode } from "graphql";

type Row = Record<string, any>;

function compareValues(a: any, b: any): number {
  if (typeof a === "string" && typeof b === "string") {
    const aTime = Date.parse(a);
    const bTime = Date.parse(b);
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
      return aTime - bTime;
    }
  }
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function matchesOperator(value: any, operator: string, operand: any): boolean {
  if (operator === "_is_null") {
    return (value == null) === operand;
  }
  // SQL semantics: every other comparison against NULL is not true.
  if (value == null) {
    return false;
  }
  switch (operator) {
    case "_eq":
      return compareValues(value, operand) === 0;
    case "_neq":
      return compareValues(value, operand) !== 0;
    case "_gt":
      return compareValues(value, operand) > 0;
    case "_gte":
      return compareValues(value, operand) >= 0;
    case "_lt":
      return compareValues(value, operand) < 0;
    case "_lte":
      return compareValues(value, operand) <= 0;
    case "_in":
      return (operand as any[]).some((v) => compareValues(value, v) === 0);
  }
  throw new Error(`fakeHasura: unsupported operator ${operator}`);
}

export function matchesWhere(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "_and") {
      return (condition as any[]).every((w) => matchesWhere(row, w));
    }
    if (key === "_or") {
      return (condition as any[]).some((w) => matchesWhere(row, w));
    }
    if (key === "_not") {
      return !matchesWhere(row, condition);
    }
    return Object.entries(condition as Record<string, any>).every(
      ([operator, operand]) => matchesOperator(row[key], operator, operand),
    );
  });
}

function sortRows(rows: Row[], orderBy: Record<string, string>[]): Row[] {
  const terms = orderBy.flatMap((entry) => Object.entries(entry));
  return [...rows].sort((a, b) => {
    for (const [column, direction] of terms) {
      const desc = direction.startsWith("desc");
      const nullsFirst = direction.endsWith("nulls_first")
        ? true
        : direction.endsWith("nulls_last")
          ? false
          : desc;
      const aNull = a[column] == null;
      const bNull = b[column] == null;
      if (aNull || bNull) {
        if (aNull && bNull) {
          continue;
        }
        return aNull === nullsFirst ? -1 : 1;
      }
      const diff = compareValues(a[column], b[column]);
      if (diff !== 0) {
        return desc ? -diff : diff;
      }
    }
    return 0;
  });
}

export function resolveRootField(
  document: DocumentNode,
  variables: Record<string, unknown> | undefined,
  table: Row[],
): Record<string, unknown> {
  const operation = document.definitions.find(
    (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION,
  );
  if (!operation) {
    throw new Error("fakeHasura: document has no operation");
  }
  const field = operation.selectionSet.selections[0] as FieldNode;
  const args: Record<string, any> = Object.fromEntries(
    (field.arguments ?? []).map((arg) => [
      arg.name.value,
      valueFromASTUntyped(arg.value, variables ?? {}),
    ]),
  );
  const key = field.alias?.value ?? field.name.value;

  const rows = table.filter((row) => matchesWhere(row, args.where ?? {}));
  if (field.name.value.endsWith("_aggregate")) {
    return { [key]: { aggregate: { count: rows.length } } };
  }

  const offset = args.offset ?? 0;
  const sorted = sortRows(rows, [args.order_by ?? []].flat());
  return {
    [key]: sorted.slice(
      offset,
      args.limit == null ? undefined : offset + args.limit,
    ),
  };
}
