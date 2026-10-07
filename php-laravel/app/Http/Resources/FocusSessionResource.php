<?php

namespace App\Http\Resources;

use App\Models\FocusSession;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A focus session as the API shows it.
 *
 * @mixin FocusSession
 */
class FocusSessionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'startTime' => $this->start_time,
            'tasks' => $this->task_ids,
            'pauses' => $this->pauses,
        ];
    }
}
