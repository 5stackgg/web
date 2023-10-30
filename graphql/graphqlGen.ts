import gql from "graphql-tag";
import { Zeus } from "@/generated/zeus";
import type {
  ValueTypes,
  ScalarDefinition,
  OperationOptions,
} from "@/generated/zeus";

export function generateMutation<
  Z extends ValueTypes[O],
  O extends "mutation_root",
>(
  mutation: Z | ValueTypes[O],
  operationOptions?: OperationOptions,
  scalars?: ScalarDefinition,
) {
  return gql(Zeus("mutation", mutation, { operationOptions, scalars }));
}

export function generateQuery<Z extends ValueTypes[O], O extends "query_root">(
  query: Z | ValueTypes[O],
  operationOptions?: OperationOptions,
  scalars?: ScalarDefinition,
) {
  return gql(Zeus("query", query, { operationOptions, scalars }));
}

export function generateSubscription<
  Z extends ValueTypes[O],
  O extends "query_root",
>(
  subscription: Z | ValueTypes[O],
  operationOptions?: OperationOptions,
  scalars?: ScalarDefinition,
) {
  return gql(Zeus("subscription", subscription, { operationOptions, scalars }));
}
