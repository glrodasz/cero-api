<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** The body of POST /focus-sessions, which may be missing altogether. */
class StartFocusSessionRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // `required` refuses blank strings, which every other rule skips (see
            // UpdateTaskRequest), but it refuses [] too, which means "every
            // unfinished task". So it only applies to what is not an array.
            'tasks' => ['sometimes', Rule::requiredIf(! is_array($this->input('tasks'))), 'list'],
            'tasks.*' => ['string'],
            'startTime' => ['sometimes', 'required', 'integer:strict'],
        ];
    }
}
