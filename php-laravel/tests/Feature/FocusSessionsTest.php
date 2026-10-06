<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The focus session use cases of shared/core-test-plan.md ("FocusSessionsService"),
 * through HTTP. Each test is named after the service method it covers, then the case.
 *
 * The clock is frozen at 1_000_000 ms and only moves when a test travels in time.
 */
class FocusSessionsTest extends TestCase
{
    use RefreshDatabase;

    private const NOW = 1_000_000;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::createFromTimestampMs(self::NOW));
    }

    public function test_start_starts_an_active_session_with_every_in_progress_and_pending_task_by_default(): void
    {
        $active = $this->createTask('active');
        $done = $this->createTask('done');
        $this->patchJson("/tasks/{$done['id']}/complete")->assertOk();

        $session = $this->startSession();

        $this->assertSame(
            ['status' => 'active', 'startTime' => self::NOW, 'tasks' => [$active['id']], 'pauses' => []],
            array_diff_key($session, ['id' => true]),
        );
        $this->assertSame($session['id'], $this->getTask($active['id'])['focusSessionId']);
        $this->assertNull($this->getTask($done['id'])['focusSessionId']);
    }

    public function test_start_keeps_requested_tasks_in_request_order_dropping_unknown_and_repeated_ids(): void
    {
        $a = $this->createTask('a');
        $b = $this->createTask('b');

        $session = $this->startSession(['tasks' => [$b['id'], 'unknown', self::MISSING_ID, $a['id'], $b['id']]]);

        $this->assertSame([$b['id'], $a['id']], $session['tasks']);
    }

    public function test_start_uses_the_given_start_time(): void
    {
        $session = $this->startSession(['startTime' => 42]);

        $this->assertSame(42, $session['startTime']);
    }

    public function test_get_current_returns_null_when_no_session_is_current(): void
    {
        $this->startSession();
        $this->patchJson('/focus-sessions/finish')->assertOk();

        $response = $this->getJson('/focus-sessions/active')->assertOk();

        // The API's "null" is an empty object.
        $this->assertSame('{}', $response->getContent());
    }

    public function test_get_current_moves_start_time_forward_by_the_closed_pauses_only(): void
    {
        $session = $this->startSession();
        $this->patchJson("/focus-sessions/{$session['id']}/pause")->assertOk();
        $this->travel(300)->milliseconds();
        $this->patchJson("/focus-sessions/{$session['id']}/resume")->assertOk();
        $this->patchJson("/focus-sessions/{$session['id']}/pause")->assertOk();
        $this->travel(5_000)->milliseconds(); // still open: not counted yet

        $current = $this->getJson('/focus-sessions/active')->assertOk();

        $this->assertSame($session['startTime'] + 300, $current->json('startTime'));
    }

    public function test_get_current_returns_the_newest_current_session(): void
    {
        $this->startSession();
        $newest = $this->startSession();

        $this->getJson('/focus-sessions/active')->assertOk()->assertJsonPath('id', $newest['id']);
    }

    public function test_pause_opens_a_pause_on_an_active_session(): void
    {
        $session = $this->startSession();
        $this->travel(1_000)->milliseconds();

        $paused = $this->patchJson("/focus-sessions/{$session['id']}/pause")->assertOk();

        $paused->assertJsonPath('status', 'paused');
        $this->assertSame([['startTime' => self::NOW + 1_000, 'endTime' => null, 'time' => 0]], $this->withoutIds($paused->json('pauses')));
    }

    public function test_pause_refuses_sessions_that_are_not_active(): void
    {
        $session = $this->startSession();
        $this->patchJson("/focus-sessions/{$session['id']}/pause")->assertOk();
        $cannotPause = ['message' => 'Focus session not found or cannot be paused'];

        $this->patchJson("/focus-sessions/{$session['id']}/pause")->assertNotFound()->assertExactJson($cannotPause);
        $this->patchJson('/focus-sessions/'.self::MISSING_ID.'/pause')->assertNotFound()->assertExactJson($cannotPause);
    }

    public function test_pause_current_fails_when_no_session_is_current(): void
    {
        $this->patchJson('/focus-sessions/pause')
            ->assertNotFound()
            ->assertExactJson(['message' => 'No active focus session found']);
    }

    public function test_pause_current_opens_a_pause_on_an_active_session(): void
    {
        $this->startSession();

        $paused = $this->patchJson('/focus-sessions/pause')->assertOk();

        $paused->assertJsonPath('status', 'paused')->assertJsonCount(1, 'pauses')->assertJsonPath('pauses.0.endTime', null);
    }

    public function test_pause_current_leaves_an_already_paused_session_as_is_when_no_time_is_given(): void
    {
        $this->startSession();
        $paused = $this->patchJson('/focus-sessions/pause')->assertOk()->json();
        $this->travel(1_000)->milliseconds();

        $this->patchJson('/focus-sessions/pause')->assertOk()->assertExactJson($paused);
    }

    public function test_pause_current_closes_the_open_pause_and_opens_a_new_one_with_the_given_time(): void
    {
        $this->startSession();
        $this->patchJson('/focus-sessions/pause')->assertOk();
        $this->travel(1_000)->milliseconds();

        $paused = $this->patchJson('/focus-sessions/pause', ['time' => 25])->assertOk();

        $this->assertSame([
            ['startTime' => self::NOW, 'endTime' => self::NOW + 1_000, 'time' => 1_000],
            ['startTime' => self::NOW + 1_000, 'endTime' => null, 'time' => 25],
        ], $this->withoutIds($paused->json('pauses')));
    }

    public function test_resume_closes_the_open_pause_of_a_paused_session(): void
    {
        $session = $this->startSession();
        $this->patchJson("/focus-sessions/{$session['id']}/pause")->assertOk();
        $this->travel(700)->milliseconds();

        $resumed = $this->patchJson("/focus-sessions/{$session['id']}/resume")->assertOk();

        $resumed->assertJsonPath('status', 'active')
            ->assertJsonPath('pauses.0.endTime', self::NOW + 700)
            ->assertJsonPath('pauses.0.time', 700);
    }

    public function test_resume_refuses_sessions_that_are_not_paused(): void
    {
        $session = $this->startSession();

        $this->patchJson("/focus-sessions/{$session['id']}/resume")
            ->assertNotFound()
            ->assertExactJson(['message' => 'Focus session not found or cannot be resumed']);
    }

    public function test_resume_current_closes_the_open_pause_of_the_current_session(): void
    {
        $this->startSession();
        $this->patchJson('/focus-sessions/pause')->assertOk();
        $this->travel(200)->milliseconds();

        $resumed = $this->patchJson('/focus-sessions/resume')->assertOk();

        $resumed->assertJsonPath('status', 'active')->assertJsonPath('pauses.0.time', 200);
    }

    public function test_resume_current_leaves_a_session_without_an_open_pause_as_is(): void
    {
        $session = $this->startSession();

        $this->patchJson('/focus-sessions/resume')->assertOk()->assertExactJson($session);
    }

    public function test_resume_current_fails_when_no_session_is_current(): void
    {
        $this->patchJson('/focus-sessions/resume')
            ->assertNotFound()
            ->assertExactJson(['message' => 'No active focus session found']);
    }

    public function test_finish_closes_the_open_pause_and_releases_the_unfinished_tasks_only(): void
    {
        $unfinished = $this->createTask('unfinished');
        $done = $this->createTask('done');
        $session = $this->startSession();
        $this->patchJson("/tasks/{$done['id']}/complete")->assertOk();
        $this->patchJson("/focus-sessions/{$session['id']}/pause")->assertOk();
        $this->travel(400)->milliseconds();

        $finished = $this->patchJson("/focus-sessions/{$session['id']}/finish")->assertOk();

        $finished->assertJsonPath('status', 'finished')->assertJsonPath('pauses.0.time', 400);
        $this->assertNull($this->getTask($unfinished['id'])['focusSessionId']);
        $this->assertSame($session['id'], $this->getTask($done['id'])['focusSessionId']);
    }

    public function test_finish_fails_with_not_found_for_an_unknown_id(): void
    {
        $this->patchJson('/focus-sessions/'.self::MISSING_ID.'/finish')
            ->assertNotFound()
            ->assertExactJson(['message' => 'Focus session not found']);
    }

    public function test_finish_current_finishes_the_current_session(): void
    {
        $session = $this->startSession();

        $finished = $this->patchJson('/focus-sessions/finish')->assertOk();

        $finished->assertJsonPath('id', $session['id'])->assertJsonPath('status', 'finished');
    }

    public function test_finish_current_fails_when_no_session_is_current(): void
    {
        $this->patchJson('/focus-sessions/finish')
            ->assertNotFound()
            ->assertExactJson(['message' => 'No active focus session found']);
    }

    /**
     * Pause ids are random, so comparisons leave them out.
     *
     * @param  list<array<string, mixed>>  $pauses
     * @return list<array<string, mixed>>
     */
    private function withoutIds(array $pauses): array
    {
        return array_map(fn (array $pause) => array_diff_key($pause, ['id' => true]), $pauses);
    }
}
