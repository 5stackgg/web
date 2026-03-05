#!/bin/bash
# Patch graphql-zeus generated typedDocumentNode.ts to use type-only imports.
# The generated file uses value imports for type-only exports, which breaks Vite.

FILE="./generated/zeus/typedDocumentNode.ts"

sed -i "" \
  -e "s/import { TypedDocumentNode }/import type { TypedDocumentNode }/" \
  -e "s/  ValueTypes,/  type ValueTypes,/" \
  -e "s/  GenericOperation,/  type GenericOperation,/" \
  -e "s/  OperationOptions,/  type OperationOptions,/" \
  -e "s/  GraphQLTypes,/  type GraphQLTypes,/" \
  -e "s/  InputType,/  type InputType,/" \
  -e "s/  ScalarDefinition,/  type ScalarDefinition,/" \
  -e "s/  ThunderGraphQLOptions,/  type ThunderGraphQLOptions,/" \
  -e "s/  ExtractVariables,/  type ExtractVariables,/" \
  "$FILE"
