package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// TaskRepository is a core.TaskRepository over the tasks table.
type TaskRepository struct {
	pool *pgxpool.Pool
}

var _ core.TaskRepository = (*TaskRepository)(nil)

func (r *TaskRepository) FindByID(ctx context.Context, id string) (*core.Task, error) {
	taskID, ok := parseID(id)
	if !ok {
		return nil, nil
	}

	rows, _ := r.pool.Query(ctx, `
		SELECT id, description, priority, status, focus_session_id
		FROM tasks
		WHERE id = $1`,
		taskID)
	task, err := pgx.CollectOneRow(rows, pgx.RowToAddrOfStructByName[core.Task])
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return task, err
}

// FindMany runs one static query for every filter: a criterion that is not
// set is sent as NULL, which lets every row through.
func (r *TaskRepository) FindMany(ctx context.Context, filter core.TaskFilter) ([]core.Task, error) {
	var ids []string // nil is NULL
	if filter.IDs != nil {
		ids = parseIDs(filter.IDs)
	}

	var focusSessionID *string // nil is NULL
	if filter.FocusSessionID != "" {
		sessionID, ok := parseID(filter.FocusSessionID)
		if !ok {
			return []core.Task{}, nil
		}
		focusSessionID = &sessionID
	}

	rows, _ := r.pool.Query(ctx, `
		SELECT id, description, priority, status, focus_session_id
		FROM tasks
		WHERE (@ids::uuid[] IS NULL OR id = ANY(@ids))
		  AND (@statuses::text[] IS NULL OR status = ANY(@statuses))
		  AND (@focus_session_id::uuid IS NULL OR focus_session_id = @focus_session_id)
		ORDER BY priority, created_at`,
		pgx.NamedArgs{"ids": ids, "statuses": filter.Statuses, "focus_session_id": focusSessionID})
	return pgx.CollectRows(rows, pgx.RowToStructByName[core.Task])
}

func (r *TaskRepository) CountByStatus(ctx context.Context, status core.TaskStatus) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT count(*) FROM tasks WHERE status = $1`, status).Scan(&count)
	return count, err
}

func (r *TaskRepository) Create(ctx context.Context, task core.Task) (core.Task, error) {
	rows, _ := r.pool.Query(ctx, `
		INSERT INTO tasks (description, priority, status, focus_session_id)
		VALUES (@description, @priority, @status, @focus_session_id)
		RETURNING id, description, priority, status, focus_session_id`,
		taskArgs(task))
	return pgx.CollectOneRow(rows, pgx.RowToStructByName[core.Task])
}

func (r *TaskRepository) Save(ctx context.Context, task core.Task) error {
	taskID, ok := parseID(task.ID)
	if !ok {
		return nil
	}

	args := taskArgs(task)
	args["id"] = taskID
	_, err := r.pool.Exec(ctx, `
		UPDATE tasks
		SET description = @description,
		    priority = @priority,
		    status = @status,
		    focus_session_id = @focus_session_id
		WHERE id = @id`,
		args)
	return err
}

func (r *TaskRepository) Delete(ctx context.Context, id string) error {
	taskID, ok := parseID(id)
	if !ok {
		return nil
	}

	_, err := r.pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, taskID)
	return err
}

func (r *TaskRepository) AssignFocusSession(ctx context.Context, taskIDs []string, focusSessionID *string) error {
	ids := parseIDs(taskIDs)
	if len(ids) == 0 {
		return nil
	}

	_, err := r.pool.Exec(ctx, `UPDATE tasks SET focus_session_id = $2 WHERE id = ANY($1)`, ids, focusSessionID)
	return err
}

func taskArgs(task core.Task) pgx.NamedArgs {
	return pgx.NamedArgs{
		"description":      task.Description,
		"priority":         task.Priority,
		"status":           task.Status,
		"focus_session_id": task.FocusSessionID,
	}
}
