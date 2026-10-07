package api

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// handleErrors is the one place that answers failures. Handlers record an
// error with c.Error and return; once they are done, this middleware turns
// the last error into the contract's { "message" } body.
func handleErrors(c *gin.Context) {
	c.Next()

	if err := c.Errors.Last(); err != nil {
		status, message := statusOf(err)
		c.JSON(status, gin.H{"message": message})
	}
}

// statusOf maps core refusals to 404 and 400, and a body that does not bind
// to 400. Anything else is a 500 that does not leak internals.
func statusOf(err *gin.Error) (int, string) {
	if notFound, ok := errors.AsType[*core.NotFoundError](err); ok {
		return http.StatusNotFound, notFound.Message
	}
	if invalid, ok := errors.AsType[*core.ValidationError](err); ok {
		return http.StatusBadRequest, invalid.Message
	}
	if err.IsType(gin.ErrorTypeBind) {
		return http.StatusBadRequest, err.Error()
	}

	slog.Error("unexpected error", "error", err.Err)
	return http.StatusInternalServerError, core.MsgInternalError
}

func answerRouteNotFound(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{"message": core.MsgRouteNotFound})
}

// answerPanic runs after gin's recovery middleware has logged the panic.
func answerPanic(c *gin.Context, _ any) {
	c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"message": core.MsgInternalError})
}
