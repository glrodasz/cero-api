<?php

namespace App\Http\Resources;

use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A task as the API shows it.
 *
 * @mixin Task
 */
class TaskResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'description' => $this->description,
            'priority' => $this->priority,
            'status' => $this->status,
            'focusSessionId' => $this->focus_session_id,
        ];
    }
}
