package core

import (
	"slices"
	"uuid"
)

// FocusSessionStatus is the stage a focus session is at.
type FocusSessionStatus string

const (
	FocusSessionActive   FocusSessionStatus = "active"
	FocusSessionPaused   FocusSessionStatus = "paused"
	FocusSessionFinished FocusSessionStatus = "finished"
)

// CurrentSessionStatuses are the statuses of a "current" session: one that
// has not been finished yet.
var CurrentSessionStatuses = []FocusSessionStatus{FocusSessionActive, FocusSessionPaused}

// Pause is a break within a focus session.
type Pause struct {
	ID        string `json:"id"`
	StartTime int64  `json:"startTime"`
	// EndTime is nil while the pause is open.
	EndTime *int64 `json:"endTime"`
	// Time is the duration once closed (or the value sent to PATCH /pause).
	Time int64 `json:"time"`
}

// FocusSession is a stretch of time spent working on a set of tasks.
type FocusSession struct {
	ID        string             `json:"id"`
	Status    FocusSessionStatus `json:"status"`
	StartTime int64              `json:"startTime"`
	// Tasks holds the ids of the tasks the session started with.
	Tasks []string `json:"tasks"`
	// Pauses are oldest first. Only the last one can be open.
	Pauses []Pause `json:"pauses"`
}

// The rules below are pure: a FocusSession method returns a changed copy and
// leaves the receiver as it was. The service decides when to apply them and
// persists the result.

// NewPause returns an open pause that starts at startTime.
func NewPause(startTime, time int64) Pause {
	return Pause{ID: uuid.New().String(), StartTime: startTime, EndTime: nil, Time: time}
}

// OpenPause returns the pause that has not ended yet, if there is one.
func (s FocusSession) OpenPause() (Pause, bool) {
	if last := len(s.Pauses) - 1; last >= 0 && s.Pauses[last].EndTime == nil {
		return s.Pauses[last], true
	}
	return Pause{}, false
}

// CloseOpenPause ends the open pause at now, if there is one.
func (s FocusSession) CloseOpenPause(now int64) FocusSession {
	pause, ok := s.OpenPause()
	if !ok {
		return s
	}

	pause.EndTime = &now
	pause.Time = now - pause.StartTime
	s.Pauses = slices.Clone(s.Pauses)
	s.Pauses[len(s.Pauses)-1] = pause
	return s
}

// StartPause adds the pause and marks the session paused.
func (s FocusSession) StartPause(pause Pause) FocusSession {
	s.Status = FocusSessionPaused
	s.Pauses = append(slices.Clone(s.Pauses), pause)
	return s
}

// Resume closes the open pause and marks the session active.
func (s FocusSession) Resume(now int64) FocusSession {
	s = s.CloseOpenPause(now)
	s.Status = FocusSessionActive
	return s
}

// Finish closes the open pause and marks the session finished.
func (s FocusSession) Finish(now int64) FocusSession {
	s = s.CloseOpenPause(now)
	s.Status = FocusSessionFinished
	return s
}

// ShiftStartTimeByClosedPauses moves StartTime forward by the time spent in
// closed pauses, so a client can compute the focused time as now - StartTime.
func (s FocusSession) ShiftStartTimeByClosedPauses() FocusSession {
	for _, pause := range s.Pauses {
		if pause.EndTime != nil {
			s.StartTime += *pause.EndTime - pause.StartTime
		}
	}
	return s
}
