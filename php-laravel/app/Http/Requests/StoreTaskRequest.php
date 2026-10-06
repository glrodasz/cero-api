<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** The body of POST /tasks. */
class StoreTaskRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // `present`, not `required`: an empty description is still a string.
            'description' => ['present', 'string'],
        ];
    }
}
