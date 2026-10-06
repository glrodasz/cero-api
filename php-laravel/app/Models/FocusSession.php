<?php

namespace App\Models;

use App\Enums\FocusSessionStatus;
use App\Exceptions\NotFoundException;
use App\ValueObjects\Pause;
use Database\Factories\FocusSessionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Attributes\WithoutTimestamps;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\AsCollection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * A stretch of focused work on some tasks. `created_at` is set by Postgres and
 * only used for ordering.
 *
 * The rules below change the session in memory; the actions in
 * app/Actions/FocusSessions decide when to apply them and save the result.
 *
 * @property string $id
 * @property FocusSessionStatus $status
 * @property int $start_time epoch milliseconds
 * @property list<string> $task_ids the tasks the session started with (the API's `tasks`)
 * @property Collection<int, Pause> $pauses oldest first; only the last one can be open
 */
#[Fillable(['status', 'start_time', 'task_ids', 'pauses'])]
#[WithoutTimestamps]
class FocusSession extends Model
{
    /** @use HasFactory<FocusSessionFactory> */
    use HasFactory, HasUuids;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => FocusSessionStatus::class,
            'start_time' => 'integer',
            // jsonb rather than uuid[]: Eloquent has no cast for Postgres arrays.
            'task_ids' => 'array',
            'pauses' => AsCollection::of([Pause::class, 'fromArray']),
        ];
    }

    /**
     * The tasks attached to the session now, unlike `task_ids`, which keeps the
     * ones it started with.
     *
     * @return HasMany<Task, $this>
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /** The newest sessions that are active or paused first: the first one is "the current session". */
    #[Scope]
    protected function current(Builder $query): void
    {
        $query->whereIn('status', FocusSessionStatus::current())->latest();
    }

    /** @throws NotFoundException when no session is current */
    public static function currentOrFail(): self
    {
        return self::query()->current()->first() ?? throw NotFoundException::noCurrentFocusSession();
    }

    public function openPause(): ?Pause
    {
        $lastPause = $this->pauses->last();

        return $lastPause?->isOpen() ? $lastPause : null;
    }

    public function closeOpenPause(int $now): void
    {
        $this->pauses = $this->pauses->map(fn (Pause $pause) => $pause->isOpen() ? $pause->close($now) : $pause);
    }

    public function startPause(Pause $pause): void
    {
        $this->status = FocusSessionStatus::Paused;
        $this->pauses = $this->pauses->concat([$pause]);
    }

    public function resume(int $now): void
    {
        $this->closeOpenPause($now);
        $this->status = FocusSessionStatus::Active;
    }

    public function finish(int $now): void
    {
        $this->closeOpenPause($now);
        $this->status = FocusSessionStatus::Finished;
    }

    /**
     * A copy whose start_time is moved forward by the time spent in closed
     * pauses, so a client can compute the focused time as now - startTime.
     * Only for display: it is never saved.
     */
    public function withStartTimeShiftedByClosedPauses(): self
    {
        $pausedTime = $this->pauses
            ->reject(fn (Pause $pause) => $pause->isOpen())
            ->sum(fn (Pause $pause) => $pause->endTime - $pause->startTime);

        $shifted = clone $this;
        $shifted->start_time += $pausedTime;

        return $shifted;
    }
}
