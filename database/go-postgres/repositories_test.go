package postgres_test

import (
	"cmp"
	"os"
	"testing"

	postgres "github.com/glrodasz/cero-api/database/go-postgres"
	core "github.com/glrodasz/cero-api/shared/go-core"
	"github.com/glrodasz/cero-api/shared/go-core/coretest"
)

// Runs against a real PostgreSQL: `docker compose up -d postgres` from the
// repository root. A database of its own keeps the tests away from your
// development data.
var testDatabaseURL = cmp.Or(os.Getenv("TEST_DATABASE_URL"), "postgres://root:root@127.0.0.1:5432/cero_go_test")

func TestRepositoryContract(t *testing.T) {
	if os.Getenv("SKIP_DATABASE_TESTS") == "1" {
		t.Skip("SKIP_DATABASE_TESTS=1")
	}

	pool, err := postgres.Connect(t.Context(), testDatabaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	coretest.RunRepositoryContract(t, func(t *testing.T) core.Repositories {
		if _, err := pool.Exec(t.Context(), "TRUNCATE tasks, focus_sessions"); err != nil {
			t.Fatal(err)
		}
		return postgres.NewRepositories(pool)
	})
}
