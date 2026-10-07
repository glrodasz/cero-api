package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

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

func (h *focusSessionsHandler) register(routes *gin.RouterGroup) {
	routes.GET("", h.list)
	routes.GET("/active", h.getCurrent)
	routes.POST("", h.start)
	// Static segments win over ":id" here too, whatever the order.
	routes.PATCH("/finish", h.finishCurrent)
	routes.PATCH("/pause", h.pauseCurrent)
	routes.PATCH("/resume", h.resumeCurrent)
	routes.PATCH("/:id/finish", h.finish)
	routes.PATCH("/:id/pause", h.pause)
	routes.PATCH("/:id/resume", h.resume)
}

func (h *focusSessionsHandler) list(c *gin.Context) {
	sessions, err := h.focusSessions.List(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, sessions)
}

func (h *focusSessionsHandler) getCurrent(c *gin.Context) {
	session, err := h.focusSessions.GetCurrent(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	if session == nil {
		// The contract answers an empty object, not null, when no session is current.
		c.JSON(http.StatusOK, gin.H{})
		return
	}
	c.JSON(http.StatusOK, session)
}

func (h *focusSessionsHandler) start(c *gin.Context) {
	var body startSessionBody
	if !bindOptionalBody(c, &body) {
		return
	}

	session, err := h.focusSessions.Start(c.Request.Context(), body.Tasks, body.StartTime)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusCreated, session)
}

func (h *focusSessionsHandler) finishCurrent(c *gin.Context) {
	session, err := h.focusSessions.FinishCurrent(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, session)
}

func (h *focusSessionsHandler) pauseCurrent(c *gin.Context) {
	var body pauseBody
	if !bindOptionalBody(c, &body) {
		return
	}

	session, err := h.focusSessions.PauseCurrent(c.Request.Context(), body.Time)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, session)
}

func (h *focusSessionsHandler) resumeCurrent(c *gin.Context) {
	session, err := h.focusSessions.ResumeCurrent(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, session)
}

func (h *focusSessionsHandler) finish(c *gin.Context) {
	session, err := h.focusSessions.Finish(c.Request.Context(), c.Param("id"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, session)
}

func (h *focusSessionsHandler) pause(c *gin.Context) {
	session, err := h.focusSessions.Pause(c.Request.Context(), c.Param("id"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, session)
}

func (h *focusSessionsHandler) resume(c *gin.Context) {
	session, err := h.focusSessions.Resume(c.Request.Context(), c.Param("id"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, session)
}
