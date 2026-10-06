package api

import (
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
)

// structValidator plugs go-playground/validator into c.Bind(), which Fiber
// leaves to the app. A body that breaks its validate tags is a 400.
type structValidator struct {
	validate *validator.Validate
}

func newStructValidator() structValidator {
	return structValidator{validate: validator.New(validator.WithRequiredStructEnabled())}
}

func (v structValidator) Validate(out any) error {
	if err := v.validate.Struct(out); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return nil
}

// bindOptionalBody binds the JSON body into out, for endpoints whose body may
// be left out, which reads as {}.
func bindOptionalBody(c fiber.Ctx, out any) error {
	if len(c.Body()) == 0 {
		return nil
	}
	return c.Bind().JSON(out)
}
