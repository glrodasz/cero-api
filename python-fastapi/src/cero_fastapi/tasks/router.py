from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Body

from cero_core import Task, TaskStatus
from cero_fastapi.dependencies import TasksServiceDep
from cero_fastapi.tasks.schemas import CreateTaskBody, TaskChangesBody, TaskResponse

router = APIRouter(prefix="/tasks", tags=["tasks"])

# Handlers return core entities; `response_model` turns them into camelCase JSON.
# Bodies are optional where the contract allows it: no body is the same as `{}`.


@router.get("", response_model=list[TaskResponse])
async def list_tasks(tasks: TasksServiceDep) -> list[Task]:
    return await tasks.list()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, tasks: TasksServiceDep) -> Task:
    return await tasks.get(task_id)


@router.post("", response_model=TaskResponse, status_code=HTTPStatus.CREATED)
async def create_task(body: CreateTaskBody, tasks: TasksServiceDep) -> Task:
    return await tasks.create(description=body.description)


# Declared before "/{task_id}/{status}", which would otherwise capture them.
@router.patch("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(task_id: str, tasks: TasksServiceDep) -> Task:
    return await tasks.complete(task_id)


@router.patch("/{task_id}/reset", response_model=TaskResponse)
async def reset_task(task_id: str, tasks: TasksServiceDep) -> Task:
    return await tasks.reset(task_id)


@router.patch("/{task_id}/{status}", response_model=TaskResponse)
async def change_task_status(task_id: str, status: TaskStatus, tasks: TasksServiceDep) -> Task:
    return await tasks.change_status(task_id, status)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    tasks: TasksServiceDep,
    body: Annotated[TaskChangesBody, Body(default_factory=TaskChangesBody)],
) -> Task:
    return await tasks.update(task_id, body.to_changes())


@router.delete("/{task_id}", response_model=TaskResponse)
async def delete_task(task_id: str, tasks: TasksServiceDep) -> Task:
    return await tasks.delete(task_id)
