<?php

namespace App\Actions\FocusSessions;

use App\Models\FocusSession;
use App\ValueObjects\Pause;

/**
 * Pauses the current session. Sending a time always starts a fresh pause
 * (closing an open one first); without it, an already paused session stays as is.
 */
class PauseCurrentFocusSession
{
    public function handle(?int $time = null): FocusSession
    {
        $session = FocusSession::currentOrFail();
        if ($session->openPause() !== null && $time === null) {
            return $session;
        }

        $now = now()->getTimestampMs();
        $session->closeOpenPause($now);
        $session->startPause(Pause::start($now, $time ?? 0));
        $session->save();

        return $session;
    }
}
