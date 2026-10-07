import { MESSAGES, NotFoundError, ValidationError } from "@cero/core";
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

type ErrorResponse = { status: number; message: string };

/** ValidationPipe reports one message per failed constraint, as an array. */
const messageOf = (exception: HttpException): string => {
  const response = exception.getResponse();
  const message = typeof response === "string" ? response : (response as { message?: string | string[] }).message;
  return Array.isArray(message) ? message.join("; ") : (message ?? exception.message);
};

/**
 * Catches everything (`@Catch()` with no arguments) and answers with the
 * contract's `{ message }` shape: core errors become 404/400, Nest's own
 * client errors (validation, malformed JSON, unknown routes) keep their 4xx
 * status, and anything else is a 500 that does not leak internals.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  // The adapter, rather than Express's `response`, keeps the filter platform-agnostic.
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, message } = this.toErrorResponse(exception);
    this.adapterHost.httpAdapter.reply(host.switchToHttp().getResponse(), { message }, status);
  }

  private toErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof NotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: exception.message };
    }
    if (exception instanceof ValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: exception.message };
    }
    // Nest's router throws this for unknown routes ("Cannot GET /nowhere").
    if (exception instanceof NotFoundException) {
      return { status: HttpStatus.NOT_FOUND, message: MESSAGES.ROUTE_NOT_FOUND };
    }
    if (exception instanceof HttpException && exception.getStatus() < HttpStatus.INTERNAL_SERVER_ERROR) {
      return { status: exception.getStatus(), message: messageOf(exception) };
    }

    this.logger.error(exception);
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: MESSAGES.INTERNAL_ERROR };
  }
}
