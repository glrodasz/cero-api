<?php

namespace Database\Factories;

use App\Enums\FocusSessionStatus;
use App\Models\FocusSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FocusSession>
 */
class FocusSessionFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'status' => FocusSessionStatus::Active,
            'start_time' => 1_000,
            'task_ids' => [],
            'pauses' => [],
        ];
    }
}
