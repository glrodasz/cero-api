<?php

namespace App\Http\Controllers;

use App\Actions\Tasks\CreateTask;
use App\Actions\Tasks\ListTasks;
use App\Actions\Tasks\MoveTaskToTopOfGroup;
use App\Enums\TaskStatus;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** /tasks. Route model binding finds the {task}; a missing one is a 404 before the method runs. */
class TaskController extends Controller
{
    public function index(ListTasks $listTasks): AnonymousResourceCollection
    {
        return TaskResource::collection($listTasks->handle());
    }

    public function show(Task $task): TaskResource
    {
        return new TaskResource($task);
    }

    /** Answers 201: Laravel does it for a model created during the request. */
    public function store(StoreTaskRequest $request, CreateTask $createTask): TaskResource
    {
        return new TaskResource($createTask->handle($request->validated('description')));
    }

    public function complete(Task $task, MoveTaskToTopOfGroup $moveToTopOfGroup): TaskResource
    {
        return new TaskResource($moveToTopOfGroup->handle($task, TaskStatus::Completed));
    }

    public function reset(Task $task, MoveTaskToTopOfGroup $moveToTopOfGroup): TaskResource
    {
        return new TaskResource($moveToTopOfGroup->handle($task, TaskStatus::Pending));
    }

    public function changeStatus(Task $task, TaskStatus $status): TaskResource
    {
        $task->update(['status' => $status]);

        return new TaskResource($task);
    }

    /**
     * Not route-model bound: binding runs before the UpdateTaskRequest is
     * validated, and the contract validates first. So the lookup happens here,
     * the way binding does it (a malformed id is simply not found).
     */
    public function update(UpdateTaskRequest $request, string $id): TaskResource
    {
        $task = (new Task)->resolveRouteBinding($id)
            ?? throw (new ModelNotFoundException)->setModel(Task::class, [$id]);

        $task->update($request->changes());

        return new TaskResource($task);
    }

    public function destroy(Task $task): TaskResource
    {
        $task->delete();

        return new TaskResource($task);
    }
}
