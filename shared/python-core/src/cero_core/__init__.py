"""The domain and use cases of the Cero API, shared by every Python implementation.

No framework, no database: plain dataclasses, functions and services.

    from cero_core import create_services
    from cero_core.in_memory import create_in_memory_repositories

    services = create_services(create_in_memory_repositories())
    await services.tasks.create(description="Write the README")
"""

from cero_core.clock import Clock, system_clock
from cero_core.composition import Repositories, Services, create_services
from cero_core.errors import Messages, NotFoundError, ValidationError
from cero_core.focus_sessions.focus_session import (
    CURRENT_SESSION_STATUSES,
    FocusSession,
    FocusSessionStatus,
    NewFocusSession,
    Pause,
)
from cero_core.focus_sessions.repository import FocusSessionRepository
from cero_core.focus_sessions.service import FocusSessionsService
from cero_core.tasks.repository import TaskFilter, TaskRepository
from cero_core.tasks.service import TasksService
from cero_core.tasks.task import (
    ACTIVE_TASK_STATUSES,
    MAX_IN_PROGRESS_TASKS,
    NewTask,
    Task,
    TaskChanges,
    TaskStatus,
)

__all__ = [
    "ACTIVE_TASK_STATUSES",
    "CURRENT_SESSION_STATUSES",
    "MAX_IN_PROGRESS_TASKS",
    "Clock",
    "FocusSession",
    "FocusSessionRepository",
    "FocusSessionStatus",
    "FocusSessionsService",
    "Messages",
    "NewFocusSession",
    "NewTask",
    "NotFoundError",
    "Pause",
    "Repositories",
    "Services",
    "Task",
    "TaskChanges",
    "TaskFilter",
    "TaskRepository",
    "TaskStatus",
    "TasksService",
    "ValidationError",
    "create_services",
    "system_clock",
]
