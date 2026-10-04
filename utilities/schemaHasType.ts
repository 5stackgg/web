import gql from "graphql-tag";
import type { ApolloClient } from "@apollo/client/core";

const SCHEMA_HAS_TYPE = gql`
  query SchemaHasType($name: String!) {
    __type(name: $name) {
      name
    }
  }
`;

const known = new Map<string, Promise<boolean>>();

// Whether the API serves a type yet. Asked through introspection so a view the
// web ships ahead of the API answers null instead of raising a GraphQL error,
// which the app would toast.
export function schemaHasType(
  client: ApolloClient<any>,
  name: string,
): Promise<boolean> {
  let answer = known.get(name);
  if (!answer) {
    answer = client
      .query({
        query: SCHEMA_HAS_TYPE,
        variables: { name },
        fetchPolicy: "cache-first",
      })
      .then(({ data }) => !!(data as any)?.__type)
      .catch(() => false);
    known.set(name, answer);
  }
  return answer;
}

const SCHEMA_TYPE_FIELDS = gql`
  query SchemaTypeFields($name: String!) {
    __type(name: $name) {
      fields {
        name
      }
    }
  }
`;

const knownFields = new Map<string, Promise<Set<string>>>();

// Whether the API serves a field on a type yet: the same guard for a column
// or computed field the web ships ahead of the API.
export function schemaHasField(
  client: ApolloClient<any>,
  type: string,
  field: string,
): Promise<boolean> {
  let fields = knownFields.get(type);
  if (!fields) {
    fields = client
      .query({
        query: SCHEMA_TYPE_FIELDS,
        variables: { name: type },
        fetchPolicy: "cache-first",
      })
      .then(
        ({ data }) =>
          new Set<string>(
            ((data as any)?.__type?.fields ?? []).map((f: any) => f.name),
          ),
      )
      .catch(() => new Set<string>());
    knownFields.set(type, fields);
  }
  return fields.then((names) => names.has(field));
}
