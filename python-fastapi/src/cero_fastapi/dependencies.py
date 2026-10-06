"""What route handlers ask for, as `Annotated` dependencies."""

from typing import Annotated

from fastapi import Depends, Request

from cero_core import FocusSessionsService, Services, TasksService


def get_services(request: Request) -> Services:
    """The use cases the app's lifespan wired at startup."""
    services: Services = request.app.state.services
    return services


def get_tasks_service(services: Annotated[Services, Depends(get_services)]) -> TasksService:
    return services.tasks


def get_focus_sessions_service(
    services: Annotated[Services, Depends(get_services)],
) -> FocusSessionsService:
    return services.focus_sessions


TasksServiceDep = Annotated[TasksService, Depends(get_tasks_service)]
FocusSessionsServiceDep = Annotated[FocusSessionsService, Depends(get_focus_sessions_service)]
