import { GraphQLError, Kind, type GraphQLScalarTypeConfig } from "graphql";

const toMillis = (value: unknown): number => {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  throw new GraphQLError(`Millis must be an integer number of milliseconds, got ${JSON.stringify(value)}`);
};

/**
 * How the `Millis` scalar of the shared SDL behaves: epoch milliseconds, any
 * integer JavaScript represents exactly (GraphQL's `Int` stops at 32 bits,
 * about 25 days of milliseconds). The SDL declares and describes the scalar,
 * so this is only its config, not a `GraphQLScalarType` that would replace the
 * description.
 */
export const Millis: Omit<GraphQLScalarTypeConfig<number, number>, "name"> = {
  serialize: toMillis,
  // A value sent as a variable.
  parseValue: toMillis,
  // A value written inline in the query. GraphQL's grammar has no size limit for integer literals.
  parseLiteral: (ast) => {
    if (ast.kind !== Kind.INT) {
      throw new GraphQLError("Millis must be an integer number of milliseconds", { nodes: ast });
    }
    return toMillis(Number(ast.value));
  },
};
