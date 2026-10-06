<?php

namespace App\Actions\Tasks;

use App\Enums\TaskStatus;
use App\Models\FocusSession;
use App\Models\Task;

/** A new task goes on top of its group and joins the current session, if any. */
class CreateTask
{
    public function handle(string $description): Task
    {
        $inProgressCount = Task::where('status', TaskStatus::InProgress)->count();

        return Task::create([
            'description' => $description,
            'priority' => 0,
            'status' => TaskStatus::forNewTask($inProgressCount),
            'focus_session_id' => FocusSession::current()->value('id'),
        ]);
    }
}
