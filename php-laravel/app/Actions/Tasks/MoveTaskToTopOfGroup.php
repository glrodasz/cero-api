<?php

namespace App\Actions\Tasks;

use App\Enums\TaskStatus;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

/**
 * Completing a task moves it to the top of the completed group; resetting it,
 * to the top of the pending group. The task becomes priority 0 and the rest of
 * the group follows as 1..n, keeping its order.
 */
class MoveTaskToTopOfGroup
{
    public function handle(Task $task, TaskStatus $group): Task
    {
        return DB::transaction(function () use ($task, $group) {
            Task::where('status', $group)
                ->whereKeyNot($task->id)
                ->inPriorityOrder()
                ->get()
                ->each(fn (Task $member, int $index) => $member->update(['priority' => $index + 1]));

            $task->update(['status' => $group, 'priority' => 0]);

            return $task;
        });
    }
}
