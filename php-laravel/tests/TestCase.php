<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** A well-formed UUID that no row will ever have. */
    protected const MISSING_ID = '00000000-0000-4000-8000-000000000000';

    /**
     * Creates a task through the API.
     *
     * @return array<string, mixed> the task as the API shows it
     */
    protected function createTask(string $description = 'a task'): array
    {
        return $this->postJson('/tasks', ['description' => $description])->assertCreated()->json();
    }

    /**
     * Reads a task through the API.
     *
     * @return array<string, mixed>
     */
    protected function getTask(string $id): array
    {
        return $this->getJson("/tasks/{$id}")->assertOk()->json();
    }

    /**
     * Starts a focus session through the API.
     *
     * @param  array<string, mixed>  $body
     * @return array<string, mixed> the session as the API shows it
     */
    protected function startSession(array $body = []): array
    {
        return $this->postJson('/focus-sessions', $body)->assertCreated()->json();
    }
}
