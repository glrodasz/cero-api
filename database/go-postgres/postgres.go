// Package postgres stores the data of the Go core in PostgreSQL, through pgx
// and hand-written SQL.
//
// The selected columns are named (or aliased) after the fields of the core's
// types, which lets pgx.RowToStructByName map rows straight onto core.Task
// and core.FocusSession.
//
// Queries ignore the error of Query: pgx hands it to CollectRows, which is
// where it is checked.
package postgres

import (
	"context"
	"fmt"
	"uuid"

	"github.com/jackc/pgx/v5/pgxpool"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// Connect opens a connection pool to databaseURL and brings the schema up to
// date. Close the pool when you are done with it.
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("opening the postgres pool: %w", err)
	}
	if err := Migrate(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// NewRepositories returns the core's repositories over pool.
func NewRepositories(pool *pgxpool.Pool) core.Repositories {
	return core.Repositories{
		Tasks:         &TaskRepository{pool: pool},
		FocusSessions: &FocusSessionRepository{pool: pool},
	}
}

// parseID returns id in its canonical form, or false when it is not a UUID.
// A malformed id cannot match any row, so it is "not found" without asking
// Postgres, which would answer it with an error instead.
func parseID(id string) (string, bool) {
	parsed, err := uuid.Parse(id)
	if err != nil {
		return "", false
	}
	return parsed.String(), true
}

// parseIDs keeps the well-formed ids, in their canonical form.
func parseIDs(ids []string) []string {
	parsed := make([]string, 0, len(ids))
	for _, id := range ids {
		if canonical, ok := parseID(id); ok {
			parsed = append(parsed, canonical)
		}
	}
	return parsed
}
