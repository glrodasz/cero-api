package api

import (
	"errors"
	"io"

	"github.com/gin-gonic/gin"
)

// bindBody decodes the JSON body into body and checks its binding tags with
// Gin's validator. A failure is recorded as a bind error, which handleErrors
// answers with a 400.
func bindBody(c *gin.Context, body any) bool {
	if err := c.ShouldBindJSON(body); err != nil {
		_ = c.Error(err).SetType(gin.ErrorTypeBind)
		return false
	}
	return true
}

// bindOptionalBody is bindBody for endpoints whose body may be left out,
// which reads as {}. Decoding an empty body is io.EOF.
func bindOptionalBody(c *gin.Context, body any) bool {
	if err := c.ShouldBindJSON(body); err != nil && !errors.Is(err, io.EOF) {
		_ = c.Error(err).SetType(gin.ErrorTypeBind)
		return false
	}
	return true
}
