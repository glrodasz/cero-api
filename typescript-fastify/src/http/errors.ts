import { MESSAGES, NotFoundError, ValidationError } from "@cero/core";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export const handleRouteNotFound = (_request: FastifyRequest, reply: FastifyReply) =>
  reply.code(404).send({ message: MESSAGES.ROUTE_NOT_FOUND });

/**
 * One place turns every failure into the contract's `{ message }` shape:
 * core errors become 404/400, Fastify's own client errors (schema validation,
 * malformed JSON) keep their 4xx status, anything else is an opaque 500.
 */
export const handleError = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  if (error instanceof NotFoundError) {
    return reply.code(404).send({ message: error.message });
  }
  if (error instanceof ValidationError) {
    return reply.code(400).send({ message: error.message });
  }
  if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
    return reply.code(error.statusCode).send({ message: error.message });
  }

  request.log.error(error);
  return reply.code(500).send({ message: MESSAGES.INTERNAL_ERROR });
};
