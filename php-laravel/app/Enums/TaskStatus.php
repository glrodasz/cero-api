<?php

namespace App\Enums;

enum TaskStatus: string
{
    case InProgress = 'in-progress';
    case Pending = 'pending';
    case Completed = 'completed';

    /** Focus rule: a new task only starts in progress while fewer than this many are. */
    public const MAX_IN_PROGRESS = 3;

    /**
     * The statuses of tasks that still need work.
     *
     * @return list<self>
     */
    public static function unfinished(): array
    {
        return [self::InProgress, self::Pending];
    }

    /** The status a new task starts with, given how many tasks are in progress. */
    public static function forNewTask(int $inProgressCount): self
    {
        return $inProgressCount < self::MAX_IN_PROGRESS ? self::InProgress : self::Pending;
    }
}
