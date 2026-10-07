<?php

namespace App\Actions\FocusSessions;

use App\Enums\FocusSessionStatus;
use App\Exceptions\NotFoundException;
use App\Models\FocusSession;
use App\ValueObjects\Pause;

/** Only an active session can be paused by id. */
class PauseFocusSession
{
    public function handle(FocusSession $session): FocusSession
    {
        if ($session->status !== FocusSessionStatus::Active) {
            throw NotFoundException::focusSessionCannotBePaused();
        }

        $session->startPause(Pause::start(now()->getTimestampMs()));
        $session->save();

        return $session;
    }
}
