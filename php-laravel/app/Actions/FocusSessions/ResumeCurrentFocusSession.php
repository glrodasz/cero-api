<?php

namespace App\Actions\FocusSessions;

use App\Models\FocusSession;

/** Resumes the current session. Without an open pause, nothing changes. */
class ResumeCurrentFocusSession
{
    public function handle(): FocusSession
    {
        $session = FocusSession::currentOrFail();
        if ($session->openPause() === null) {
            return $session;
        }

        $session->resume(now()->getTimestampMs());
        $session->save();

        return $session;
    }
}
