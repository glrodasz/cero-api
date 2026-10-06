package postgres

import (
	"context"
	"embed"
	"fmt"
	"io/fs"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// The SQL migrations travel inside the binary, so an app needs no files next
// to it to set its database up.
//
//go:embed migrations/*.sql
var embeddedMigrations embed.FS

// Migrate applies the migrations the database has not seen yet.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	migrations, err := fs.Sub(embeddedMigrations, "migrations")
	if err != nil {
		return err
	}

	// goose speaks database/sql; this *sql.DB borrows connections from the pool.
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()

	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations)
	if err != nil {
		return fmt.Errorf("preparing the migrations: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("migrating the database: %w", err)
	}
	return nil
}
