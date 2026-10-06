<?php

namespace Tests\Unit;

use App\Enums\TaskStatus;
use PHPUnit\Framework\TestCase;

class TaskStatusTest extends TestCase
{
    public function test_new_tasks_start_in_progress_while_fewer_than_three_are(): void
    {
        $this->assertSame(TaskStatus::InProgress, TaskStatus::forNewTask(0));
        $this->assertSame(TaskStatus::InProgress, TaskStatus::forNewTask(2));
        $this->assertSame(TaskStatus::Pending, TaskStatus::forNewTask(3));
        $this->assertSame(TaskStatus::Pending, TaskStatus::forNewTask(4));
    }

    public function test_in_progress_and_pending_tasks_are_unfinished(): void
    {
        $this->assertSame([TaskStatus::InProgress, TaskStatus::Pending], TaskStatus::unfinished());
    }
}
