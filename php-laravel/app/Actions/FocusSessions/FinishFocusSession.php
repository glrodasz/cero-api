<?php

namespace App\Actions\FocusSessions;

use App\Models\FocusSession;
use Illuminate\Support\Facades\DB;

/**
 * Finishing closes the open pause, and the session lets go of its unfinished
 * tasks. Completed tasks keep the session as history.
 */
class FinishFocusSession
{
    public function handle(FocusSession $session): FocusSession
    {
        return DB::transaction(function () use ($session) {
            $session->finish(now()->getTimestampMs());
            $session->save();

            $session->tasks()->unfinished()->update(['focus_session_id' => null]);

            return $session;
        });
    }
}
