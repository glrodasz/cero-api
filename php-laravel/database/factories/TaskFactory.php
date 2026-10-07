<?php

namespace Database\Factories;

use App\Enums\TaskStatus;
use App\Models\Task;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'description' => fake()->sentence(),
            'priority' => 0,
            'status' => TaskStatus::Pending,
            'focus_session_id' => null,
        ];
    }
}
