// Command server serves the Cero API with Fiber.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v3"

	postgres "github.com/glrodasz/cero-api/database/go-postgres"
	"github.com/glrodasz/cero-api/go-fiber/internal/api"
	core "github.com/glrodasz/cero-api/shared/go-core"
	"github.com/glrodasz/cero-api/shared/go-core/memory"
)

func main() {
	if err := run(); err != nil {
		slog.Error("go-fiber stopped", "error", err)
		os.Exit(1)
	}
}

// run is the composition root: choose the storage, build the use cases, hand
// them to Fiber, and serve until SIGINT or SIGTERM.
func run() error {
	cfg, err := configFromEnv()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	repos, closeStorage, err := openStorage(ctx, cfg)
	if err != nil {
		return err
	}
	defer closeStorage()

	app := api.NewApp(core.NewServices(repos, core.SystemClock))
	slog.Info("go-fiber starting", "url", "http://localhost:"+cfg.port, "storage", cfg.storage)

	// Once ctx is done, Fiber stops accepting connections and lets the
	// requests in flight finish before Listen returns.
	if err := app.Listen(":"+cfg.port, fiber.ListenConfig{GracefulContext: ctx}); err != nil {
		return err
	}
	slog.Info("go-fiber shut down")
	return nil
}

// openStorage returns the repositories cfg asks for, and how to let them go.
func openStorage(ctx context.Context, cfg config) (core.Repositories, func(), error) {
	if cfg.storage == storageMemory {
		return memory.NewRepositories(), func() {}, nil
	}

	pool, err := postgres.Connect(ctx, cfg.databaseURL)
	if err != nil {
		return core.Repositories{}, nil, err
	}
	return postgres.NewRepositories(pool), pool.Close, nil
}
