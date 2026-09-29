import { describe, expect, it } from "vitest";
import type {
  DocumentNode,
  OperationDefinitionNode,
  SelectionSetNode,
} from "graphql";
import { ReturnTypes } from "~/generated/zeus/const.full";

const ROOTS: Record<OperationDefinitionNode["operation"], string> = {
  query: "query_root",
  mutation: "mutation_root",
  subscription: "subscription_root",
};

import * as utilityGraphql from "~/graphql/utilityGraphql";

function isDocument(value: unknown): value is DocumentNode {
  return (
    !!value &&
    typeof value === "object" &&
    (value as DocumentNode).kind === "Document"
  );
}

function unknownFields(
  typeName: string,
  selectionSet: SelectionSetNode,
  path: string,
  out: string[],
) {
  const fields = ReturnTypes[typeName];
  if (!fields || typeof fields !== "object") {
    return;
  }
  for (const selection of selectionSet.selections) {
    if (selection.kind === "InlineFragment") {
      unknownFields(
        selection.typeCondition?.name.value ?? typeName,
        selection.selectionSet,
        path,
        out,
      );
      continue;
    }
    if (selection.kind !== "Field") {
      continue;
    }
    const name = selection.name.value;
    if (name === "__typename") {
      continue;
    }
    const child = fields[name];
    if (child === undefined) {
      out.push(`${path}.${name} (not on ${typeName})`);
      continue;
    }
    if (selection.selectionSet && typeof child === "string") {
      unknownFields(child, selection.selectionSet, `${path}.${name}`, out);
    }
  }
}

const documents = Object.entries(utilityGraphql)
  .filter(([, value]) => isDocument(value))
  .map(([name, value]) => ({ name, document: value as DocumentNode }));

describe("utilityGraphql documents", () => {
  it("found documents to check", () => {
    expect(documents.length).toBeGreaterThan(0);
  });

  it.each(documents)("$name selects only fields the schema has", ({
    document,
  }) => {
    const out: string[] = [];
    for (const definition of document.definitions) {
      if (definition.kind !== "OperationDefinition") {
        continue;
      }
      unknownFields(
        ROOTS[definition.operation],
        definition.selectionSet,
        definition.operation,
        out,
      );
    }
    expect(out).toEqual([]);
  });
});
