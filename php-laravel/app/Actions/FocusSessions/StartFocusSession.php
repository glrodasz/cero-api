<?php

namespace App\Actions\FocusSessions;

use App\Enums\FocusSessionStatus;
use App\Models\FocusSession;
use App\Models\Task;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Starts an active session, and every task it includes is now worked on in it. */
class StartFocusSession
{
    /**
     * @param  list<string>  $taskIds  the tasks to work on; every unfinished task when empty
     * @param  ?int  $startTime  epoch milliseconds; now when null
     */
    public function handle(array $taskIds = [], ?int $startTime = null): FocusSession
    {
        return DB::transaction(function () use ($taskIds, $startTime) {
            $sessionTaskIds = $taskIds === []
                ? Task::unfinished()->inPriorityOrder()->pluck('id')->all()
                : $this->existingInRequestOrder($taskIds);

            $session = FocusSession::create([
                'status' => FocusSessionStatus::Active,
                'start_time' => $startTime ?? now()->getTimestampMs(),
                'task_ids' => $sessionTaskIds,
                'pauses' => [],
            ]);
            Task::whereKey($sessionTaskIds)->update(['focus_session_id' => $session->id]);

            return $session;
        });
    }

    /**
     * Unknown and repeated ids are dropped; the rest keep the order they were requested in.
     *
     * @param  list<string>  $taskIds
     * @return list<string>
     */
    private function existingInRequestOrder(array $taskIds): array
    {
        // A malformed id is unknown too, and Postgres would reject it as a uuid.
        $existingIds = Task::whereKey(array_filter($taskIds, Str::isUuid(...)))->pluck('id')->all();

        return array_values(array_intersect(array_unique($taskIds), $existingIds));
    }
}
