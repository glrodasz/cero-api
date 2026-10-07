package api

import (
	"errors"
	"log/slog"

	"github.com/gofiber/fiber/v3"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// handleError is the app's ErrorHandler: every error a handler returns ends
// up here and becomes the contract's { "message" } body.
func handleError(c fiber.Ctx, err error) error {
	status, message := statusOf(err)
	return c.Status(status).JSON(fiber.Map{"message": message})
}

// statusOf maps core refusals to 404 and 400, a body that does not bind to
// 400, and keeps the status of Fiber's own client errors. Anything else is a
// 500 that does not leak internals.
func statusOf(err error) (int, string) {
	if notFound, ok := errors.AsType[*core.NotFoundError](err); ok {
		return fiber.StatusNotFound, notFound.Message
	}
	if invalid, ok := errors.AsType[*core.ValidationError](err); ok {
		return fiber.StatusBadRequest, invalid.Message
	}
	if bindErr, ok := errors.AsType[*fiber.BindError](err); ok {
		return fiber.StatusBadRequest, bindErr.Error()
	}
	if fiberErr, ok := errors.AsType[*fiber.Error](err); ok && fiberErr.Code < fiber.StatusInternalServerError {
		return fiberErr.Code, fiberErr.Message
	}

	slog.Error("unexpected error", "error", err)
	return fiber.StatusInternalServerError, core.MsgInternalError
}

func answerRouteNotFound(c fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": core.MsgRouteNotFound})
}
