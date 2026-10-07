<?php

namespace App\ValueObjects;

use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Str;
use JsonSerializable;

/**
 * A break inside a focus session. Pauses have no table of their own: they are
 * values stored in their session's `pauses` jsonb column, in the same shape
 * the API shows them.
 *
 * @implements Arrayable<string, int|string|null>
 */
final readonly class Pause implements Arrayable, JsonSerializable
{
    public function __construct(
        public string $id,
        public int $startTime,
        /** Null while the pause is open. */
        public ?int $endTime,
        /** The duration once closed, or the time sent to PATCH /focus-sessions/pause. */
        public int $time,
    ) {}

    /** A new, open pause. */
    public static function start(int $startTime, int $time = 0): self
    {
        return new self((string) Str::uuid(), $startTime, null, $time);
    }

    /** @param  array{id: string, startTime: int, endTime: ?int, time: int}  $pause */
    public static function fromArray(array $pause): self
    {
        return new self($pause['id'], $pause['startTime'], $pause['endTime'], $pause['time']);
    }

    public function isOpen(): bool
    {
        return $this->endTime === null;
    }

    /** Closing a pause sets its end to now and its time to how long it lasted. */
    public function close(int $now): self
    {
        return new self($this->id, $this->startTime, $now, $now - $this->startTime);
    }

    /** @return array{id: string, startTime: int, endTime: ?int, time: int} */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'startTime' => $this->startTime,
            'endTime' => $this->endTime,
            'time' => $this->time,
        ];
    }

    /** @return array{id: string, startTime: int, endTime: ?int, time: int} */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
