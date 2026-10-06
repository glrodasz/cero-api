import { readFileSync } from "node:fs";

/** The shared SDL, ready to hand to any schema-first GraphQL server. */
export const typeDefs: string = readFileSync(
  new URL("./schema.graphql", import.meta.url),
  "utf8",
);
