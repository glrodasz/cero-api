<?php

namespace Tests\Unit;

use App\Enums\FocusSessionStatus;
use App\Models\FocusSession;
use App\ValueObjects\Pause;
use PHPUnit\Framework\TestCase;

/** The focus session rules, applied in memory: no database involved. */
class FocusSessionTest extends TestCase
{
    public function test_only_the_last_pause_can_be_open(): void
    {
        $this->assertNull($this->session([])->openPause());
        $this->assertNull($this->session([new Pause('closed', 1_000, 1_100, 100)])->openPause());
        $this->assertSame('open', $this->session([new Pause('open', 1_000, null, 0)])->openPause()?->id);
    }

    public function test_starting_a_pause_appends_it_and_pauses_the_session(): void
    {
        $session = $this->session([]);

        $session->startPause(new Pause('pause-1', 1_200, null, 0));

        $this->assertSame(FocusSessionStatus::Paused, $session->status);
        $this->assertSame(['pause-1'], $session->pauses->pluck('id')->all());
    }

    public function test_resuming_closes_the_open_pause(): void
    {
        $session = $this->session([new Pause('pause-1', 1_200, null, 0)], FocusSessionStatus::Paused);

        $session->resume(now: 1_500);

        $this->assertSame(FocusSessionStatus::Active, $session->status);
        $this->assertEquals([new Pause('pause-1', 1_200, 1_500, 300)], $session->pauses->all());
    }

    public function test_finishing_closes_the_open_pause_and_keeps_closed_ones(): void
    {
        $closed = new Pause('closed', 1_000, 1_100, 100);
        $session = $this->session([$closed, new Pause('open', 1_200, null, 0)], FocusSessionStatus::Paused);

        $session->finish(now: 1_250);

        $this->assertSame(FocusSessionStatus::Finished, $session->status);
        $this->assertEquals([$closed, new Pause('open', 1_200, 1_250, 50)], $session->pauses->all());
    }

    public function test_the_start_time_moves_forward_by_closed_pauses_only_and_only_in_a_copy(): void
    {
        $session = $this->session([new Pause('closed', 1_000, 1_300, 300), new Pause('open', 2_000, null, 0)]);

        $shifted = $session->withStartTimeShiftedByClosedPauses();

        $this->assertSame(1_300, $shifted->start_time);
        $this->assertSame(1_000, $session->start_time);
    }

    /** @param  list<Pause>  $pauses */
    private function session(array $pauses, FocusSessionStatus $status = FocusSessionStatus::Active): FocusSession
    {
        return new FocusSession(['status' => $status, 'start_time' => 1_000, 'task_ids' => [], 'pauses' => $pauses]);
    }
}
