<?php

namespace App\Models;

use App\Enums\TaskStatus;
use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Attributes\WithoutTimestamps;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Something to do. `created_at` is set by Postgres and only used for ordering.
 *
 * @property string $id
 * @property string $description
 * @property int $priority 0 is the top of its status group
 * @property TaskStatus $status
 * @property ?string $focus_session_id the session the task is being worked on in
 */
#[Fillable(['description', 'priority', 'status', 'focus_session_id'])]
#[WithoutTimestamps]
class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory, HasUuids;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'priority' => 'integer',
            'status' => TaskStatus::class,
        ];
    }

    /** Lists are sorted by priority, then creation order. */
    #[Scope]
    protected function inPriorityOrder(Builder $query): void
    {
        $query->orderBy('priority')->orderBy('created_at');
    }

    /** Tasks that still need work. */
    #[Scope]
    protected function unfinished(Builder $query): void
    {
        $query->whereIn('status', TaskStatus::unfinished());
    }
}
