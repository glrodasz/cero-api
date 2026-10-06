import { ValidationError } from "@cero/core";
import { z } from "zod";

/**
 * Express has no validation of its own; zod is the usual companion. A body
 * that does not fit the schema becomes a core ValidationError (400).
 * Unknown keys are dropped, so clients cannot sneak in fields like `id`.
 */
export const parseBody = <Schema extends z.ZodType>(schema: Schema, body: unknown = {}): z.output<Schema> => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(z.prettifyError(result.error));
  }
  return result.data;
};
