from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Body

from cero_core import FocusSession
from cero_fastapi.dependencies import FocusSessionsServiceDep
from cero_fastapi.focus_sessions.schemas import (
    FocusSessionResponse,
    NoFocusSession,
    PauseBody,
    StartFocusSessionBody,
)

router = APIRouter(prefix="/focus-sessions", tags=["focus sessions"])

# Handlers return core entities; `response_model` turns them into camelCase JSON.
# Bodies are optional where the contract allows it: no body is the same as `{}`.


@router.get("", response_model=list[FocusSessionResponse])
async def list_focus_sessions(focus_sessions: FocusSessionsServiceDep) -> list[FocusSession]:
    return await focus_sessions.list()


@router.get("/active", response_model=FocusSessionResponse | NoFocusSession)
async def get_current_focus_session(
    focus_sessions: FocusSessionsServiceDep,
) -> FocusSession | NoFocusSession:
    # The contract answers an empty object, not null, when no session is current.
    return await focus_sessions.get_current() or NoFocusSession()


@router.post("", response_model=FocusSessionResponse, status_code=HTTPStatus.CREATED)
async def start_focus_session(
    focus_sessions: FocusSessionsServiceDep,
    body: Annotated[StartFocusSessionBody, Body(default_factory=StartFocusSessionBody)],
) -> FocusSession:
    return await focus_sessions.start(task_ids=body.tasks or (), start_time=body.start_time)


@router.patch("/finish", response_model=FocusSessionResponse)
async def finish_current_focus_session(focus_sessions: FocusSessionsServiceDep) -> FocusSession:
    return await focus_sessions.finish_current()


@router.patch("/pause", response_model=FocusSessionResponse)
async def pause_current_focus_session(
    focus_sessions: FocusSessionsServiceDep,
    body: Annotated[PauseBody, Body(default_factory=PauseBody)],
) -> FocusSession:
    return await focus_sessions.pause_current(time=body.time)


@router.patch("/resume", response_model=FocusSessionResponse)
async def resume_current_focus_session(focus_sessions: FocusSessionsServiceDep) -> FocusSession:
    return await focus_sessions.resume_current()


@router.patch("/{session_id}/finish", response_model=FocusSessionResponse)
async def finish_focus_session(
    session_id: str, focus_sessions: FocusSessionsServiceDep
) -> FocusSession:
    return await focus_sessions.finish(session_id)


@router.patch("/{session_id}/pause", response_model=FocusSessionResponse)
async def pause_focus_session(
    session_id: str, focus_sessions: FocusSessionsServiceDep
) -> FocusSession:
    return await focus_sessions.pause(session_id)


@router.patch("/{session_id}/resume", response_model=FocusSessionResponse)
async def resume_focus_session(
    session_id: str, focus_sessions: FocusSessionsServiceDep
) -> FocusSession:
    return await focus_sessions.resume(session_id)
