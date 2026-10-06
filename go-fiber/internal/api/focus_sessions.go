package api

import (
	"github.com/gofiber/fiber/v3"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// startSessionBody is the body of POST /focus-sessions. Both fields are
// optional; JSON decoding refuses values of the wrong type.
type startSessionBody struct {
	Tasks     []string `json:"tasks"`
	StartTime *int64   `json:"startTime"`
}

// pauseBody is the body of PATCH /focus-sessions/pause.
type pauseBody struct {
	Time *int64 `json:"time"`
}

// focusSessionsHandler serves /focus-sessions with the focus session use cases.
type focusSessionsHandler struct {
	focusSessions *core.FocusSessionsService
}

func (h *focusSessionsHandler) register(routes fiber.Router) {
	routes.Get("/", h.list)
	routes.Get("/active", h.getCurrent)
	routes.Post("/", h.start)
	// Declared before the "/:id/..." routes, like everywhere in Fiber.
	routes.Patch("/finish", h.finishCurrent)
	routes.Patch("/pause", h.pauseCurrent)
	routes.Patch("/resume", h.resumeCurrent)
	routes.Patch("/:id/finish", h.finish)
	routes.Patch("/:id/pause", h.pause)
	routes.Patch("/:id/resume", h.resume)
}

func (h *focusSessionsHandler) list(c fiber.Ctx) error {
	sessions, err := h.focusSessions.List(c)
	if err != nil {
		return err
	}
	return c.JSON(sessions)
}

func (h *focusSessionsHandler) getCurrent(c fiber.Ctx) error {
	session, err := h.focusSessions.GetCurrent(c)
	if err != nil {
		return err
	}
	if session == nil {
		// The contract answers an empty object, not null, when no session is current.
		return c.JSON(fiber.Map{})
	}
	return c.JSON(session)
}

func (h *focusSessionsHandler) start(c fiber.Ctx) error {
	var body startSessionBody
	if err := bindOptionalBody(c, &body); err != nil {
		return err
	}

	session, err := h.focusSessions.Start(c, body.Tasks, body.StartTime)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(session)
}

func (h *focusSessionsHandler) finishCurrent(c fiber.Ctx) error {
	session, err := h.focusSessions.FinishCurrent(c)
	if err != nil {
		return err
	}
	return c.JSON(session)
}

func (h *focusSessionsHandler) pauseCurrent(c fiber.Ctx) error {
	var body pauseBody
	if err := bindOptionalBody(c, &body); err != nil {
		return err
	}

	session, err := h.focusSessions.PauseCurrent(c, body.Time)
	if err != nil {
		return err
	}
	return c.JSON(session)
}

func (h *focusSessionsHandler) resumeCurrent(c fiber.Ctx) error {
	session, err := h.focusSessions.ResumeCurrent(c)
	if err != nil {
		return err
	}
	return c.JSON(session)
}

func (h *focusSessionsHandler) finish(c fiber.Ctx) error {
	session, err := h.focusSessions.Finish(c, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(session)
}

func (h *focusSessionsHandler) pause(c fiber.Ctx) error {
	session, err := h.focusSessions.Pause(c, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(session)
}

func (h *focusSessionsHandler) resume(c fiber.Ctx) error {
	session, err := h.focusSessions.Resume(c, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(session)
}
