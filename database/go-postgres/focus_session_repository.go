package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// FocusSessionRepository is a core.FocusSessionRepository over the
// focus_sessions table. Pauses live in a jsonb column of their session.
type FocusSessionRepository struct {
	pool *pgxpool.Pool
}

var _ core.FocusSessionRepository = (*FocusSessionRepository)(nil)

func (r *FocusSessionRepository) FindAll(ctx context.Context) ([]core.FocusSession, error) {
	rows, _ := r.pool.Query(ctx, `
		SELECT id, status, start_time, task_ids AS tasks, pauses
		FROM focus_sessions
		ORDER BY created_at`)
	return pgx.CollectRows(rows, pgx.RowToStructByName[core.FocusSession])
}

func (r *FocusSessionRepository) FindByID(ctx context.Context, id string) (*core.FocusSession, error) {
	sessionID, ok := parseID(id)
	if !ok {
		return nil, nil
	}

	rows, _ := r.pool.Query(ctx, `
		SELECT id, status, start_time, task_ids AS tasks, pauses
		FROM focus_sessions
		WHERE id = $1`,
		sessionID)
	return collectOneOrNil(rows)
}

func (r *FocusSessionRepository) FindCurrent(ctx context.Context) (*core.FocusSession, error) {
	rows, _ := r.pool.Query(ctx, `
		SELECT id, status, start_time, task_ids AS tasks, pauses
		FROM focus_sessions
		WHERE status IN ('active', 'paused')
		ORDER BY created_at DESC
		LIMIT 1`)
	return collectOneOrNil(rows)
}

func (r *FocusSessionRepository) Create(ctx context.Context, session core.FocusSession) (core.FocusSession, error) {
	rows, _ := r.pool.Query(ctx, `
		INSERT INTO focus_sessions (status, start_time, task_ids, pauses)
		VALUES (@status, @start_time, @task_ids, @pauses)
		RETURNING id, status, start_time, task_ids AS tasks, pauses`,
		sessionArgs(session))
	return pgx.CollectOneRow(rows, pgx.RowToStructByName[core.FocusSession])
}

func (r *FocusSessionRepository) Save(ctx context.Context, session core.FocusSession) error {
	sessionID, ok := parseID(session.ID)
	if !ok {
		return nil
	}

	args := sessionArgs(session)
	args["id"] = sessionID
	_, err := r.pool.Exec(ctx, `
		UPDATE focus_sessions
		SET status = @status,
		    start_time = @start_time,
		    task_ids = @task_ids,
		    pauses = @pauses
		WHERE id = @id`,
		args)
	return err
}

func collectOneOrNil(rows pgx.Rows) (*core.FocusSession, error) {
	session, err := pgx.CollectOneRow(rows, pgx.RowToAddrOfStructByName[core.FocusSession])
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return session, err
}

func sessionArgs(session core.FocusSession) pgx.NamedArgs {
	return pgx.NamedArgs{
		"status":     session.Status,
		"start_time": session.StartTime,
		"task_ids":   session.Tasks,
		"pauses":     session.Pauses,
	}
}
