from collections.abc import Callable
from dataclasses import dataclass

import pytest

from cero_core import FocusSessionsService, Services, TasksService, create_services
from cero_core.in_memory import create_in_memory_repositories


@dataclass
class ManualClock:
    """A clock that only moves when the test says so. It never sleeps."""

    now: int = 1_000_000

    def __call__(self) -> int:
        return self.now

    def advance(self, milliseconds: int) -> None:
        self.now += milliseconds


@pytest.fixture
def clock() -> ManualClock:
    return ManualClock()


@pytest.fixture
def advance_clock(clock: ManualClock) -> Callable[[int], None]:
    return clock.advance


@pytest.fixture
def services(clock: ManualClock) -> Services:
    """Services wired to in-memory storage and the manual clock."""
    return create_services(create_in_memory_repositories(), clock=clock)


@pytest.fixture
def tasks(services: Services) -> TasksService:
    return services.tasks


@pytest.fixture
def focus_sessions(services: Services) -> FocusSessionsService:
    return services.focus_sessions
