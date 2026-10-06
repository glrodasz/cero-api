<?php

namespace App\Actions\FocusSessions;

use App\Models\FocusSession;

/** The current session as a client should display it, or null when there is none. */
class GetCurrentFocusSession
{
    public function handle(): ?FocusSession
    {
        return FocusSession::current()->first()?->withStartTimeShiftedByClosedPauses();
    }
}
