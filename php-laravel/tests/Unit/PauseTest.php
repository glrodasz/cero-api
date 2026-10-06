<?php

namespace Tests\Unit;

use App\ValueObjects\Pause;
use PHPUnit\Framework\TestCase;

class PauseTest extends TestCase
{
    public function test_a_started_pause_is_open(): void
    {
        $pause = Pause::start(startTime: 1_000, time: 25);

        $this->assertTrue($pause->isOpen());
        $this->assertSame(['startTime' => 1_000, 'endTime' => null, 'time' => 25], array_diff_key($pause->toArray(), ['id' => true]));
    }

    public function test_closing_records_when_the_pause_ended_and_how_long_it_lasted(): void
    {
        $closed = Pause::start(startTime: 1_000)->close(now: 1_700);

        $this->assertFalse($closed->isOpen());
        $this->assertSame([1_700, 700], [$closed->endTime, $closed->time]);
    }

    public function test_a_pause_keeps_its_shape_when_stored_and_read_back(): void
    {
        $pause = new Pause('pause-1', 1_000, 1_700, 700);

        $this->assertEquals($pause, Pause::fromArray(json_decode(json_encode($pause), true)));
    }
}
