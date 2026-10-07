<?php

namespace Tests\Feature;

use App\Enums\FocusSessionStatus;
use App\Enums\TaskStatus;
use App\Models\FocusSession;
use App\Models\Task;
use App\ValueObjects\Pause;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The storage contract every database adapter honours in the other stacks
 * (shared/core-test-plan.md, "Repository contract"), as the migrations, casts
 * and scopes deliver it here, against Postgres.
 */
class StorageTest extends TestCase
{
    use RefreshDatabase;

    public function test_tasks_get_a_uuid_on_create_and_are_found_by_it(): void
    {
        $created = Task::factory()->create(['description' => 'stored']);

        $found = Task::find($created->id);

        $fields = ['id', 'description', 'priority', 'status', 'focus_session_id'];
        $this->assertTrue(str($created->id)->isUuid());
        $this->assertSame($created->only($fields), $found?->only($fields));
    }

    public function test_tasks_are_not_found_by_unknown_or_malformed_ids(): void
    {
        $deleted = Task::factory()->create();
        $deleted->delete();

        $this->assertNull(Task::find($deleted->id));
        // Route model binding (HasUuids) refuses a malformed id before Postgres sees it.
        $this->expectException(ModelNotFoundException::class);
        (new Task)->resolveRouteBinding('not-an-id');
    }

    public function test_tasks_sort_by_priority_then_creation_order(): void
    {
        $second = Task::factory()->create(['priority' => 1]);
        $third = Task::factory()->create(['priority' => 1]);
        $first = Task::factory()->create(['priority' => 0]);

        $this->assertSame([$first->id, $second->id, $third->id], Task::inPriorityOrder()->pluck('id')->all());
    }

    public function test_task_scopes_and_relations_combine(): void
    {
        $session = FocusSession::factory()->create();
        $match = Task::factory()->create(['status' => TaskStatus::Pending, 'focus_session_id' => $session->id]);
        Task::factory()->create(['status' => TaskStatus::Completed, 'focus_session_id' => $session->id]);
        $other = Task::factory()->create(['status' => TaskStatus::Pending]);

        $tasks = $session->tasks()->unfinished()->whereKey([$match->id, $other->id])->pluck('id');

        $this->assertSame([$match->id], $tasks->all());
        $this->assertCount(0, Task::whereKey([])->get());
    }

    public function test_tasks_are_counted_by_status(): void
    {
        Task::factory()->count(2)->create(['status' => TaskStatus::InProgress]);
        Task::factory()->create(['status' => TaskStatus::Pending]);

        $this->assertSame(2, Task::where('status', TaskStatus::InProgress)->count());
        $this->assertSame(0, Task::where('status', TaskStatus::Completed)->count());
    }

    public function test_tasks_are_overwritten_on_save(): void
    {
        $task = Task::factory()->create();

        $task->fill(['description' => 'changed', 'priority' => 3, 'status' => TaskStatus::Completed])->save();

        $this->assertSame(
            ['description' => 'changed', 'priority' => 3, 'status' => TaskStatus::Completed],
            Task::find($task->id)?->only('description', 'priority', 'status'),
        );
    }

    public function test_the_focus_session_of_many_tasks_is_assigned_and_cleared_at_once(): void
    {
        $session = FocusSession::factory()->create();
        [$a, $b] = Task::factory()->count(2)->create();

        Task::whereKey([$a->id, $b->id])->update(['focus_session_id' => $session->id]);
        $this->assertSame([$a->id, $b->id], $session->tasks()->inPriorityOrder()->pluck('id')->all());

        Task::whereKey([$a->id])->update(['focus_session_id' => null]);
        $this->assertNull($a->fresh()?->focus_session_id);
    }

    public function test_deleting_a_session_releases_its_tasks(): void
    {
        $session = FocusSession::factory()->create();
        $task = Task::factory()->create(['focus_session_id' => $session->id]);

        $session->delete();

        $this->assertNull($task->fresh()?->focus_session_id);
    }

    public function test_the_database_refuses_unknown_statuses(): void
    {
        $this->expectException(QueryException::class);

        DB::table('tasks')->insert(['id' => self::MISSING_ID, 'description' => 'a task', 'status' => 'done']);
    }

    public function test_sessions_get_a_uuid_on_create_and_are_found_by_them_pauses_included(): void
    {
        $created = FocusSession::factory()->create([
            'status' => FocusSessionStatus::Paused,
            'task_ids' => ['task-1', 'task-2'],
            'pauses' => [new Pause('pause-1', 1_500, null, 0)],
        ]);

        $found = FocusSession::find($created->id);

        $this->assertTrue(str($created->id)->isUuid());
        $this->assertSame(FocusSessionStatus::Paused, $found?->status);
        $this->assertSame(['task-1', 'task-2'], $found->task_ids);
        $this->assertEquals([new Pause('pause-1', 1_500, null, 0)], $found->pauses->all());
    }

    public function test_sessions_are_listed_oldest_first(): void
    {
        $first = FocusSession::factory()->create(['start_time' => 9]);
        $second = FocusSession::factory()->create(['start_time' => 1]);

        $this->assertSame([$first->id, $second->id], FocusSession::oldest()->pluck('id')->all());
    }

    public function test_the_newest_active_or_paused_session_is_current(): void
    {
        $this->assertNull(FocusSession::current()->first());

        FocusSession::factory()->create(['status' => FocusSessionStatus::Active]);
        $newest = FocusSession::factory()->create(['status' => FocusSessionStatus::Paused]);
        FocusSession::factory()->create(['status' => FocusSessionStatus::Finished]);

        $this->assertSame($newest->id, FocusSession::current()->first()?->id);
    }

    public function test_sessions_are_overwritten_on_save(): void
    {
        $session = FocusSession::factory()->create();
        $closedPause = new Pause('pause-1', 1_100, 1_400, 300);

        $session->fill(['status' => FocusSessionStatus::Finished, 'pauses' => [$closedPause]])->save();

        $found = FocusSession::find($session->id);
        $this->assertSame(FocusSessionStatus::Finished, $found?->status);
        $this->assertEquals([$closedPause], $found->pauses->all());
    }
}
