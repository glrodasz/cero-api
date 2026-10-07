// Package api is the HTTP face of the Cero API on Fiber: routes, request
// binding, and the translation of errors into status codes.
package api

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// NewApp builds the Fiber app around the use cases. It knows nothing about
// storage.
func NewApp(services core.Services) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName: "go-fiber",
		// Handlers return their errors; this one function answers all of them.
		ErrorHandler: handleError,
		// c.Bind() checks every body it fills against its validate tags.
		StructValidator: newStructValidator(),
		// Fiber's strings point into buffers it reuses once a request is done.
		// The in-memory storage keeps some of them (the status in
		// PATCH /tasks/:id/:status), so they must be copies.
		Immutable: true,
	})
	app.Use(logger.New(), recover.New(), cors.New())

	tasks := &tasksHandler{tasks: services.Tasks}
	tasks.register(app.Group("/tasks"))

	focusSessions := &focusSessionsHandler{focusSessions: services.FocusSessions}
	focusSessions.register(app.Group("/focus-sessions"))

	// Fiber tries routes in the order they are declared, so this catch-all
	// only sees the requests no route above has taken.
	app.Use(answerRouteNotFound)

	return app
}
