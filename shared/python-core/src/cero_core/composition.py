from dataclasses import dataclass

from cero_core.clock import Clock, system_clock
from cero_core.focus_sessions.repository import FocusSessionRepository
from cero_core.focus_sessions.service import FocusSessionsService
from cero_core.tasks.repository import TaskRepository
from cero_core.tasks.service import TasksService


@dataclass(frozen=True, slots=True)
class Repositories:
    """What a storage adapter provides: one repository per aggregate."""

    tasks: TaskRepository
    focus_sessions: FocusSessionRepository


@dataclass(frozen=True, slots=True)
class Services:
    tasks: TasksService
    focus_sessions: FocusSessionsService


def create_services(repositories: Repositories, *, clock: Clock = system_clock) -> Services:
    """The composition root of the core: plug in any storage, get the use cases."""
    return Services(
        tasks=TasksService(tasks=repositories.tasks, focus_sessions=repositories.focus_sessions),
        focus_sessions=FocusSessionsService(
            focus_sessions=repositories.focus_sessions, tasks=repositories.tasks, clock=clock
        ),
    )
