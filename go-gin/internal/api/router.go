// Package api is the HTTP face of the Cero API on Gin: routes, request
// binding, and the translation of core errors into status codes.
package api

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// NewRouter builds the Gin engine around the use cases. It knows nothing
// about storage.
func NewRouter(services core.Services) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.CustomRecovery(answerPanic), cors.Default(), handleErrors)
	router.NoRoute(answerRouteNotFound)

	tasks := &tasksHandler{tasks: services.Tasks}
	tasks.register(router.Group("/tasks"))

	focusSessions := &focusSessionsHandler{focusSessions: services.FocusSessions}
	focusSessions.register(router.Group("/focus-sessions"))

	return router
}
