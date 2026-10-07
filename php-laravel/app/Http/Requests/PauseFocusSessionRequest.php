<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** The body of PATCH /focus-sessions/pause, which may be missing altogether. */
class PauseFocusSessionRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'time' => ['sometimes', 'required', 'integer:strict'],
        ];
    }
}
