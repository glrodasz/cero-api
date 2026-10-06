<?php

namespace Tests\Feature;

use App\Actions\Tasks\ListTasks;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Exceptions;
use Mockery\MockInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

/**
 * What is Laravel's job rather than the use cases': routing, validation,
 * status codes and error bodies. The use cases are covered by TasksTest and
 * FocusSessionsTest, and the whole API by the shared contract suite.
 */
class HttpTest extends TestCase
{
    use RefreshDatabase;

    public function test_complete_and_reset_win_over_the_status_route(): void
    {
        $task = $this->createTask();

        $this->patchJson("/tasks/{$task['id']}/complete")->assertOk()->assertJsonPath('status', 'completed');
        $this->patchJson("/tasks/{$task['id']}/reset")->assertOk()->assertJsonPath('status', 'pending');
    }

    public function test_the_current_session_routes_are_not_taken_for_session_ids(): void
    {
        $session = $this->startSession();

        $this->patchJson('/focus-sessions/pause')->assertOk()->assertJsonPath('id', $session['id']);
        $this->patchJson('/focus-sessions/resume')->assertOk()->assertJsonPath('status', 'active');
        $this->patchJson('/focus-sessions/finish')->assertOk()->assertJsonPath('status', 'finished');
    }

    public function test_creating_answers_201(): void
    {
        $this->postJson('/tasks', ['description' => 'new'])->assertCreated();
        $this->postJson('/focus-sessions')->assertCreated();
    }

    /** @param  array<string, mixed>  $body */
    #[DataProvider('invalidRequests')]
    public function test_invalid_requests_answer_400_with_a_message(string $method, string $path, array $body): void
    {
        $task = $this->createTask();
        $this->startSession();

        $response = $this->json($method, str_replace('{task}', $task['id'], $path), $body);

        $response->assertBadRequest()->assertJsonStructure(['message']);
        $this->assertSame(['message'], array_keys($response->json()));
    }

    /** @return array<string, array{string, string, array<string, mixed>}> */
    public static function invalidRequests(): array
    {
        return [
            'a task without a description' => ['POST', '/tasks', []],
            'a description that is not a string' => ['POST', '/tasks', ['description' => 42]],
            'a null description' => ['PATCH', '/tasks/{task}', ['description' => null]],
            'a priority that is not an integer' => ['PATCH', '/tasks/{task}', ['priority' => 'high']],
            'a priority sent as a numeric string' => ['PATCH', '/tasks/{task}', ['priority' => '5']],
            'a blank priority' => ['PATCH', '/tasks/{task}', ['priority' => '']],
            'an unknown status in the body' => ['PATCH', '/tasks/{task}', ['status' => 'done']],
            'a malformed focusSessionId' => ['PATCH', '/tasks/{task}', ['focusSessionId' => 'not-an-id']],
            'a blank focusSessionId' => ['PATCH', '/tasks/{task}', ['focusSessionId' => '']],
            'an unknown status in the path' => ['PATCH', '/tasks/{task}/done', []],
            'session tasks that are not a list' => ['POST', '/focus-sessions', ['tasks' => 'all']],
            'session tasks given as an object' => ['POST', '/focus-sessions', ['tasks' => ['a' => 'b']]],
            'session tasks that are blank' => ['POST', '/focus-sessions', ['tasks' => '']],
            'session task ids that are not strings' => ['POST', '/focus-sessions', ['tasks' => [1, 2]]],
            'a start time that is not a number' => ['POST', '/focus-sessions', ['startTime' => 'now']],
            'a pause time that is not a number' => ['PATCH', '/focus-sessions/pause', ['time' => 'soon']],
        ];
    }

    public function test_optional_bodies_may_be_missing_or_empty(): void
    {
        $task = $this->createTask();

        $this->call('POST', '/focus-sessions')->assertCreated()->assertJsonPath('tasks', [$task['id']]);
        $this->postJson('/focus-sessions', ['tasks' => []])->assertCreated()->assertJsonPath('tasks', [$task['id']]);
        $this->call('PATCH', '/focus-sessions/pause')->assertOk()->assertJsonPath('status', 'paused');
    }

    public function test_validation_comes_before_looking_the_task_up(): void
    {
        $this->patchJson('/tasks/'.self::MISSING_ID.'/done')->assertBadRequest();
        $this->patchJson('/tasks/'.self::MISSING_ID, ['priority' => 'high'])->assertBadRequest();
        $this->patchJson('/tasks/'.self::MISSING_ID, ['priority' => 1])->assertNotFound();
    }

    public function test_unknown_fields_and_the_id_in_the_body_are_ignored(): void
    {
        $task = $this->createTask();

        $this->patchJson("/tasks/{$task['id']}", ['id' => self::MISSING_ID, 'colour' => 'red', 'priority' => 3])
            ->assertOk()
            ->assertExactJson([...$task, 'priority' => 3]);
    }

    public function test_strings_are_stored_as_sent(): void
    {
        $this->postJson('/tasks', ['description' => ''])->assertCreated()->assertJsonPath('description', '');
        $this->postJson('/tasks', ['description' => '  padded  '])->assertCreated()->assertJsonPath('description', '  padded  ');
    }

    public function test_malformed_json_answers_400(): void
    {
        $response = $this->call('POST', '/tasks', server: ['CONTENT_TYPE' => 'application/json'], content: '{ nope');

        $response->assertBadRequest()->assertExactJson(['message' => 'The request body is not valid JSON']);
    }

    /** @return array<string, array{string, string}> */
    public static function unknownRoutes(): array
    {
        return [
            'an unknown path' => ['GET', '/no-such-route'],
            'a path served for other methods only' => ['DELETE', '/tasks'],
            "Laravel's health check, which this API does not have" => ['GET', '/up'],
            "Laravel's local file serving, which this API does not have" => ['GET', '/storage/file.txt'],
        ];
    }

    #[DataProvider('unknownRoutes')]
    public function test_unknown_routes_answer_404_not_found(string $method, string $path): void
    {
        $this->json($method, $path)->assertNotFound()->assertExactJson(['message' => 'Not found']);
    }

    /** @return array<string, array{string, string, string}> */
    public static function malformedIds(): array
    {
        return [
            'GET a task' => ['GET', '/tasks/not-a-valid-id', 'Task not found'],
            'PATCH a task' => ['PATCH', '/tasks/not-a-valid-id', 'Task not found'],
            'complete a task' => ['PATCH', '/tasks/not-a-valid-id/complete', 'Task not found'],
            'DELETE a task' => ['DELETE', '/tasks/not-a-valid-id', 'Task not found'],
            'finish a session' => ['PATCH', '/focus-sessions/not-a-valid-id/finish', 'Focus session not found'],
            'pause a session' => ['PATCH', '/focus-sessions/not-a-valid-id/pause', 'Focus session not found or cannot be paused'],
            'resume a session' => ['PATCH', '/focus-sessions/not-a-valid-id/resume', 'Focus session not found or cannot be resumed'],
        ];
    }

    #[DataProvider('malformedIds')]
    public function test_a_malformed_id_is_simply_not_found(string $method, string $path, string $message): void
    {
        $this->json($method, $path)->assertNotFound()->assertExactJson(['message' => $message]);
    }

    public function test_unexpected_errors_answer_500_without_details(): void
    {
        Exceptions::fake();
        config(['app.debug' => true]);
        $this->mock(ListTasks::class, function (MockInterface $mock) {
            $mock->expects('handle')->andThrow(new RuntimeException('connection string with a password'));
        });

        $this->getJson('/tasks')->assertInternalServerError()->assertExactJson(['message' => 'Internal server error']);
        Exceptions::assertReported(RuntimeException::class);
    }

    public function test_any_origin_may_call_the_api(): void
    {
        $this->getJson('/tasks', ['Origin' => 'https://example.com'])->assertHeader('Access-Control-Allow-Origin', '*');
    }
}
