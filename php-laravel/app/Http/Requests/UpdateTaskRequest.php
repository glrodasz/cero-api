<?php

namespace App\Http\Requests;

use App\Enums\TaskStatus;
use App\Models\FocusSession;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The body of PATCH /tasks/{id}: any of the fields, each one optional. Other
 * fields (`id` included) are ignored.
 *
 * Laravel skips every rule but the `required` family for blank strings, so a
 * field that may be absent but not blank is `sometimes` + `required`.
 */
class UpdateTaskRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'description' => ['sometimes', 'string'],
            'priority' => ['sometimes', 'required', 'integer:strict'],
            'status' => ['sometimes', 'required', Rule::enum(TaskStatus::class)],
            // null takes the task out of its session; anything else, a blank string
            // included, must name one. bail keeps a malformed id away from Postgres,
            // which would reject it.
            'focusSessionId' => [
                'sometimes', 'nullable', 'bail',
                Rule::requiredIf($this->input('focusSessionId') !== null),
                'uuid',
                Rule::exists(FocusSession::class, 'id'),
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'status' => 'Invalid task status',
            'focusSessionId' => 'focusSessionId does not match any focus session',
        ];
    }

    /**
     * The validated changes, keyed by Task attribute (focusSessionId → focus_session_id).
     *
     * @return array<string, mixed>
     */
    public function changes(): array
    {
        return collect($this->validated())
            ->mapWithKeys(fn (mixed $value, string $field) => [Str::snake($field) => $value])
            ->all();
    }
}
