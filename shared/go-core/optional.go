package core

import (
	"bytes"
	"encoding/json"
	"reflect"
)

// Optional is one field of a partial update. Its zero value means "not
// given": the stored value stays as it is. [Some] gives a new value.
//
// A field that can be cleared is an Optional pointer, which tells apart all
// three cases a PATCH can express:
//
//	Optional[*string]{}     // absent: leave the field alone
//	Some[*string](nil)      // null: clear the field
//	Some(&sessionID)        // a value: replace the field
type Optional[T any] struct {
	Value T
	Set   bool
}

// Some returns an Optional that replaces the stored value with value.
func Some[T any](value T) Optional[T] {
	return Optional[T]{Value: value, Set: true}
}

// Or returns the new value if there is one, current otherwise.
func (o Optional[T]) Or(current T) T {
	if o.Set {
		return o.Value
	}
	return current
}

// UnmarshalJSON only runs for keys that are present in the JSON object, so a
// decoded Optional is set exactly when the client sent the field.
//
// JSON null only fits a pointer. For any other T it is a type error, just
// like a string where a number belongs.
func (o *Optional[T]) UnmarshalJSON(data []byte) error {
	target := reflect.TypeFor[T]()
	if bytes.Equal(data, []byte("null")) && target.Kind() != reflect.Pointer {
		return &json.UnmarshalTypeError{Value: "null", Type: target}
	}

	if err := json.Unmarshal(data, &o.Value); err != nil {
		return err
	}
	o.Set = true
	return nil
}
