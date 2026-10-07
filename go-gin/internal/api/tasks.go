package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// createTaskBody is the body of POST /tasks. Gin's validator checks the
// binding tags: a pointer, so that "" is a description but null is not.
type createTaskBody struct {
	Description *string `json:"description" binding:"required"`
}

// tasksHandler serves /tasks with the task use cases.
type tasksHandler struct {
	tasks *core.TasksService
}

func (h *tasksHandler) register(routes *gin.RouterGroup) {
	routes.GET("", h.list)
	routes.GET("/:id", h.get)
	routes.POST("", h.create)
	// Gin's router prefers static segments, so "complete" and "reset" win over ":status".
	routes.PATCH("/:id/complete", h.complete)
	routes.PATCH("/:id/reset", h.reset)
	routes.PATCH("/:id/:status", h.changeStatus)
	routes.PATCH("/:id", h.update)
	routes.DELETE("/:id", h.delete)
}

func (h *tasksHandler) list(c *gin.Context) {
	tasks, err := h.tasks.List(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, tasks)
}

func (h *tasksHandler) get(c *gin.Context) {
	task, err := h.tasks.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, task)
}

func (h *tasksHandler) create(c *gin.Context) {
	var body createTaskBody
	if !bindBody(c, &body) {
		return
	}

	task, err := h.tasks.Create(c.Request.Context(), *body.Description)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusCreated, task)
}

func (h *tasksHandler) complete(c *gin.Context) {
	task, err := h.tasks.Complete(c.Request.Context(), c.Param("id"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, task)
}

func (h *tasksHandler) reset(c *gin.Context) {
	task, err := h.tasks.Reset(c.Request.Context(), c.Param("id"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, task)
}

func (h *tasksHandler) changeStatus(c *gin.Context) {
	task, err := h.tasks.ChangeStatus(c.Request.Context(), c.Param("id"), core.TaskStatus(c.Param("status")))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, task)
}

// update binds straight into core.TaskChanges, whose fields tell an absent
// key from a null one. Unknown keys, "id" included, are ignored.
func (h *tasksHandler) update(c *gin.Context) {
	var changes core.TaskChanges
	if !bindOptionalBody(c, &changes) {
		return
	}

	task, err := h.tasks.Update(c.Request.Context(), c.Param("id"), changes)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, task)
}

func (h *tasksHandler) delete(c *gin.Context) {
	task, err := h.tasks.Delete(c.Request.Context(), c.Param("id"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, task)
}
