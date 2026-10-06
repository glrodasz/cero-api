<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The task use cases of shared/core-test-plan.md ("TasksService"), through HTTP.
 * Each test is named after the service method it covers, then the case.
 */
class TasksTest extends TestCase
{
    use RefreshDatabase;

    public function test_list_lists_in_progress_and_pending_tasks_by_priority_when_no_session_is_current(): void
    {
        $first = $this->createTask('first');
        $second = $this->createTask('second');
        $done = $this->createTask('done');
        $this->patchJson("/tasks/{$done['id']}/complete")->assertOk();
        $this->patchJson("/tasks/{$first['id']}", ['priority' => 5])->assertOk();

        $tasks = $this->getJson('/tasks')->assertOk();

        $this->assertSame([$second['id'], $first['id']], $tasks->json('*.id'));
    }

    public function test_list_lists_the_current_sessions_tasks_completed_ones_included(): void
    {
        $inSession = $this->createTask('in session');
        $this->startSession(['tasks' => [$inSession['id']]]);
        $this->patchJson("/tasks/{$inSession['id']}/complete")->assertOk();
        $outside = $this->createTask('created during the session');
        $this->patchJson("/tasks/{$outside['id']}", ['focusSessionId' => null])->assertOk();

        $tasks = $this->getJson('/tasks')->assertOk();

        $this->assertSame([$inSession['id']], $tasks->json('*.id'));
    }

    public function test_list_keeps_creation_order_between_tasks_with_the_same_priority(): void
    {
        $descriptions = ['a', 'b', 'c'];
        foreach ($descriptions as $description) {
            $this->createTask($description);
        }

        $tasks = $this->getJson('/tasks')->assertOk();

        $this->assertSame($descriptions, $tasks->json('*.description'));
    }

    public function test_get_fails_with_not_found_for_an_unknown_id(): void
    {
        $this->getJson('/tasks/'.self::MISSING_ID)
            ->assertNotFound()
            ->assertExactJson(['message' => 'Task not found']);
    }

    public function test_create_starts_tasks_in_progress_until_three_are_in_progress_then_as_pending(): void
    {
        $statuses = array_map(fn (string $description) => $this->createTask($description)['status'], ['1', '2', '3', '4']);

        $this->assertSame(['in-progress', 'in-progress', 'in-progress', 'pending'], $statuses);
    }

    public function test_create_creates_the_task_at_priority_0_without_a_session_when_none_is_current(): void
    {
        $task = $this->createTask('write tests');

        $this->assertIsString($task['id']);
        $this->assertSame(
            ['description' => 'write tests', 'priority' => 0, 'status' => 'in-progress', 'focusSessionId' => null],
            array_diff_key($task, ['id' => true]),
        );
    }

    public function test_create_attaches_the_task_to_the_current_session(): void
    {
        $session = $this->startSession();

        $task = $this->createTask('joins the session');

        $this->assertSame($session['id'], $task['focusSessionId']);
    }

    public function test_complete_puts_the_task_on_top_of_the_completed_group_and_renumbers_the_rest(): void
    {
        [$a, $b, $c] = $this->createTasks('a', 'b', 'c');
        $this->patchJson("/tasks/{$a['id']}/complete")->assertOk();
        $this->patchJson("/tasks/{$b['id']}/complete")->assertOk();

        $completed = $this->patchJson("/tasks/{$c['id']}/complete")->assertOk();

        $completed->assertJson(['status' => 'completed', 'priority' => 0]);
        $this->assertSame([0, 1, 2], $this->priorities($c, $b, $a));
    }

    public function test_complete_changes_nothing_when_the_task_does_not_exist(): void
    {
        [$a] = $this->createTasks('a');
        $this->patchJson("/tasks/{$a['id']}/complete")->assertOk();
        $this->patchJson("/tasks/{$a['id']}", ['priority' => 7])->assertOk();

        $this->patchJson('/tasks/'.self::MISSING_ID.'/complete')->assertNotFound();

        $this->assertSame([7], $this->priorities($a));
    }

    public function test_reset_puts_the_task_on_top_of_the_pending_group_and_renumbers_the_rest(): void
    {
        [$a, $b, $c, $d] = $this->createTasks('a', 'b', 'c', 'd'); // d starts pending
        $this->patchJson("/tasks/{$c['id']}/reset")->assertOk();

        $reset = $this->patchJson("/tasks/{$a['id']}/reset")->assertOk();

        $reset->assertJson(['status' => 'pending', 'priority' => 0]);
        $this->assertSame([0, 1, 2], $this->priorities($a, $c, $d));
        $this->assertSame('in-progress', $this->getTask($b['id'])['status']);
    }

    public function test_change_status_sets_only_the_status(): void
    {
        [$task] = $this->createTasks('a');
        $this->patchJson("/tasks/{$task['id']}", ['priority' => 4])->assertOk();

        $updated = $this->patchJson("/tasks/{$task['id']}/pending")->assertOk();

        $updated->assertJson(['status' => 'pending', 'priority' => 4]);
    }

    public function test_change_status_rejects_an_unknown_status_before_looking_the_task_up(): void
    {
        $this->patchJson('/tasks/'.self::MISSING_ID.'/done')
            ->assertBadRequest()
            ->assertExactJson(['message' => 'Invalid task status']);
    }

    public function test_update_changes_only_the_given_fields(): void
    {
        $this->startSession();
        $task = $this->createTask('before'); // joins the session

        $updated = $this->patchJson("/tasks/{$task['id']}", ['description' => 'after', 'focusSessionId' => null]);

        $updated->assertOk()->assertExactJson([...$task, 'description' => 'after', 'focusSessionId' => null]);
    }

    public function test_update_rejects_an_unknown_status(): void
    {
        [$task] = $this->createTasks('a');

        $this->patchJson("/tasks/{$task['id']}", ['status' => 'done'])
            ->assertBadRequest()
            ->assertExactJson(['message' => 'Invalid task status']);
    }

    public function test_update_rejects_a_focus_session_id_that_does_not_match_a_session(): void
    {
        [$task] = $this->createTasks('a');

        $this->patchJson("/tasks/{$task['id']}", ['focusSessionId' => self::MISSING_ID])
            ->assertBadRequest()
            ->assertExactJson(['message' => 'focusSessionId does not match any focus session']);
    }

    public function test_delete_removes_the_task_and_returns_it(): void
    {
        [$task] = $this->createTasks('a');

        $this->deleteJson("/tasks/{$task['id']}")->assertOk()->assertExactJson($task);

        $this->getJson("/tasks/{$task['id']}")->assertNotFound();
    }

    public function test_delete_fails_with_not_found_for_an_unknown_id(): void
    {
        $this->deleteJson('/tasks/'.self::MISSING_ID)
            ->assertNotFound()
            ->assertExactJson(['message' => 'Task not found']);
    }

    /**
     * Creates the tasks one after another (creation order matters).
     *
     * @return list<array<string, mixed>>
     */
    private function createTasks(string ...$descriptions): array
    {
        return array_map($this->createTask(...), $descriptions);
    }

    /**
     * The current priority of each task, read back through the API.
     *
     * @param  array<string, mixed>  ...$tasks
     * @return list<int>
     */
    private function priorities(array ...$tasks): array
    {
        return array_map(fn (array $task) => $this->getTask($task['id'])['priority'], $tasks);
    }
}
