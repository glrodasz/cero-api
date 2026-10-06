<?php

namespace App\Actions\Tasks;

use App\Models\FocusSession;
use App\Models\Task;
use Illuminate\Database\Eloquent\Collection;

/** What the user should be looking at: the current session's tasks, or every unfinished task. */
class ListTasks
{
    /** @return Collection<int, Task> */
    public function handle(): Collection
    {
        $currentSession = FocusSession::current()->first();
        $tasks = $currentSession ? $currentSession->tasks() : Task::unfinished();

        return $tasks->inPriorityOrder()->get();
    }
}
