<?php

namespace App\Actions\FocusSessions;

use App\Enums\FocusSessionStatus;
use App\Exceptions\NotFoundException;
use App\Models\FocusSession;

/** Only a paused session can be resumed by id. */
class ResumeFocusSession
{
    public function handle(FocusSession $session): FocusSession
    {
        if ($session->status !== FocusSessionStatus::Paused) {
            throw NotFoundException::focusSessionCannotBeResumed();
        }

        $session->resume(now()->getTimestampMs());
        $session->save();

        return $session;
    }
}
