package main

import (
	"cmp"
	"fmt"
	"os"
)

// storage says where the app keeps its data.
type storage string

const (
	storagePostgres storage = "postgres"
	storageMemory   storage = "memory" // no database needed; data is lost on restart
)

// config is what the app reads from its environment.
type config struct {
	port        string
	storage     storage
	databaseURL string
}

// configFromEnv reads the environment. The defaults match the root
// docker-compose.yml.
func configFromEnv() (config, error) {
	cfg := config{
		port:        cmp.Or(os.Getenv("PORT"), "8080"),
		storage:     storage(cmp.Or(os.Getenv("STORAGE"), string(storagePostgres))),
		databaseURL: cmp.Or(os.Getenv("DATABASE_URL"), "postgres://root:root@127.0.0.1:5432/cero_go"),
	}
	if cfg.storage != storagePostgres && cfg.storage != storageMemory {
		return config{}, fmt.Errorf("STORAGE must be one of: postgres, memory (got %q)", cfg.storage)
	}
	return cfg, nil
}
