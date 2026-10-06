package core

import "time"

// Clock tells the current time in epoch milliseconds. It is injected so tests
// can control time.
type Clock func() int64

// SystemClock is the Clock of the real world.
func SystemClock() int64 {
	return time.Now().UnixMilli()
}
