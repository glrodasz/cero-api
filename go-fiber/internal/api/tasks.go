package api

import (
	"github.com/gofiber/fiber/v3"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// createTaskBody is the body of POST /tasks: a pointer, so that "" is a
// description but null is not.
type createTaskBody struct {
	Description *string `json:"description" validate:"required"`
}

// tasksHandler serves /tasks with the task use cases. A fiber.Ctx is a
// context.Context, so handlers pass it straight to the services.
type tasksHandler struct {
	tasks *core.TasksService
}

func (h *tasksHandler) register(routes fiber.Router) {
	routes.Get("/", h.list)
	routes.Get("/:id", h.get)
	routes.Post("/", h.create)
	// Declared before "/:id/:status", which would otherwise take them.
	routes.Patch("/:id/complete", h.complete)
	routes.Patch("/:id/reset", h.reset)
	routes.Patch("/:id/:status", h.changeStatus)
	routes.Patch("/:id", h.update)
	routes.Delete("/:id", h.delete)
}

func (h *tasksHandler) list(c fiber.Ctx) error {
	tasks, err := h.tasks.List(c)
	if err != nil {
		return err
	}
	return c.JSON(tasks)
}

func (h *tasksHandler) get(c fiber.Ctx) error {
	task, err := h.tasks.Get(c, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(task)
}

func (h *tasksHandler) create(c fiber.Ctx) error {
	var body createTaskBody
	if err := c.Bind().JSON(&body); err != nil {
		return err
	}

	task, err := h.tasks.Create(c, *body.Description)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(task)
}

func (h *tasksHandler) complete(c fiber.Ctx) error {
	task, err := h.tasks.Complete(c, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(task)
}

func (h *tasksHandler) reset(c fiber.Ctx) error {
	task, err := h.tasks.Reset(c, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(task)
}

func (h *tasksHandler) changeStatus(c fiber.Ctx) error {
	task, err := h.tasks.ChangeStatus(c, c.Params("id"), core.TaskStatus(c.Params("status")))
	if err != nil {
		return err
	}
	return c.JSON(task)
}

// update binds straight into core.TaskChanges, whose fields tell an absent
// key from a null one. Unknown keys, "id" included, are ignored.
func (h *tasksHandler) update(c fiber.Ctx) error {
	var changes core.TaskChanges
	if err := bindOptionalBody(c, &changes); err != nil {
		return err
	}

	task, err := h.tasks.Update(c, c.Params("id"), changes)
	if err != nil {
		return err
	}
	return c.JSON(task)
}

func (h *tasksHandler) delete(c fiber.Ctx) error {
	task, err := h.tasks.Delete(c, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(task)
}
