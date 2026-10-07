import { ValidationError } from "@cero/core";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

/**
 * Middleware that validates the JSON body with zod before the handler runs;
 * the handler then reads it, parsed and typed, with `c.req.valid("json")`.
 * A body that does not fit becomes a core ValidationError (400). zod objects
 * drop unknown keys, so clients cannot sneak in fields like `id`.
 *
 * Hono only parses bodies sent as JSON: a request without one validates `{}`.
 */
export const jsonBody = <Schema extends z.ZodType>(schema: Schema) =>
  zValidator("json", schema, (result) => {
    if (!result.success) {
      throw new ValidationError(z.prettifyError(result.error));
    }
  });
