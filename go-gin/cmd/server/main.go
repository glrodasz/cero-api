// Command server serves the Cero API with Gin.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	postgres "github.com/glrodasz/cero-api/database/go-postgres"
	"github.com/glrodasz/cero-api/go-gin/internal/api"
	core "github.com/glrodasz/cero-api/shared/go-core"
	"github.com/glrodasz/cero-api/shared/go-core/memory"
)

func main() {
	if err := run(); err != nil {
		slog.Error("go-gin stopped", "error", err)
		os.Exit(1)
	}
}

// run is the composition root: choose the storage, build the use cases, hand
// them to Gin, and serve until SIGINT or SIGTERM.
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

	server := &http.Server{
		Addr:    ":" + cfg.port,
		Handler: api.NewRouter(core.NewServices(repos, core.SystemClock)),
	}
	served := make(chan error, 1)
	go func() { served <- server.ListenAndServe() }()
	slog.Info("go-gin listening", "url", "http://localhost:"+cfg.port, "storage", cfg.storage)

	select {
	case err := <-served:
		return err
	case <-ctx.Done():
	}

	// Stop accepting connections and give the requests in flight time to finish.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	slog.Info("go-gin shut down")
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
