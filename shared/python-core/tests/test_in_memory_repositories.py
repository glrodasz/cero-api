import pytest

from cero_core import Repositories
from cero_core.in_memory import create_in_memory_repositories
from cero_core.testing import RepositoryContract


class TestInMemoryRepositories(RepositoryContract):
    @pytest.fixture
    def repositories(self) -> Repositories:
        return create_in_memory_repositories()
