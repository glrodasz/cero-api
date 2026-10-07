import { MESSAGES, NotFoundError, ValidationError } from "@cero/core";
import type { ErrorRequestHandler, RequestHandler } from "express";

export const routeNotFound: RequestHandler = (_request, response) => {
  response.status(404).json({ message: MESSAGES.ROUTE_NOT_FOUND });
};

/** `express.json()` reports unparsable bodies with this type. */
const isMalformedJson = (error: unknown) => (error as { type?: string }).type === "entity.parse.failed";

/**
 * Express 5 forwards errors thrown by async handlers here, so routes need no
 * try/catch. Core errors become 404/400; anything else is a 500 that does not
 * leak internals.
 */
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof NotFoundError) {
    response.status(404).json({ message: error.message });
  } else if (error instanceof ValidationError) {
    response.status(400).json({ message: error.message });
  } else if (isMalformedJson(error)) {
    response.status(400).json({ message: "The request body is not valid JSON" });
  } else {
    console.error(error);
    response.status(500).json({ message: MESSAGES.INTERNAL_ERROR });
  }
};
