<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * What the request acts on does not exist, or is not in a state that allows the
 * action. Rendered as a 404 (see bootstrap/app.php) with one of these canonical
 * messages, identical in every implementation of the API.
 */
final class NotFoundException extends RuntimeException
{
    public static function task(): self
    {
        return new self('Task not found');
    }

    public static function focusSession(): self
    {
        return new self('Focus session not found');
    }

    public static function noCurrentFocusSession(): self
    {
        return new self('No active focus session found');
    }

    public static function focusSessionCannotBePaused(): self
    {
        return new self('Focus session not found or cannot be paused');
    }

    public static function focusSessionCannotBeResumed(): self
    {
        return new self('Focus session not found or cannot be resumed');
    }
}
