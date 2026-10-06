<?php

namespace App\Enums;

enum FocusSessionStatus: string
{
    case Active = 'active';
    case Paused = 'paused';
    case Finished = 'finished';

    /**
     * A session in one of these statuses is "current": it has not been finished yet.
     *
     * @return list<self>
     */
    public static function current(): array
    {
        return [self::Active, self::Paused];
    }
}
