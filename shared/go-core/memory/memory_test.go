package memory_test

import (
	"testing"

	core "github.com/glrodasz/cero-api/shared/go-core"
	"github.com/glrodasz/cero-api/shared/go-core/coretest"
	"github.com/glrodasz/cero-api/shared/go-core/memory"
)

func TestRepositoryContract(t *testing.T) {
	coretest.RunRepositoryContract(t, func(*testing.T) core.Repositories {
		return memory.NewRepositories()
	})
}
