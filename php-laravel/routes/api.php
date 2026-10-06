<?php

use App\Exceptions\NotFoundException;
use App\Http\Controllers\FocusSessionController;
use App\Http\Controllers\TaskController;
use Illuminate\Support\Facades\Route;

// Routes match in the order they are declared.

Route::controller(TaskController::class)->prefix('tasks')->group(function () {
    Route::get('/', 'index');
    Route::post('/', 'store');
    Route::get('{task}', 'show');
    // Declared before {task}/{status}, which would otherwise capture them.
    Route::patch('{task}/complete', 'complete');
    Route::patch('{task}/reset', 'reset');
    // Laravel binds enum parameters before models, so an unknown status is
    // refused before the task is looked up.
    Route::patch('{task}/{status}', 'changeStatus');
    // {id}, not {task}: this route validates its body first, then looks the task up.
    Route::patch('{id}', 'update');
    Route::delete('{task}', 'destroy');
});

Route::controller(FocusSessionController::class)->prefix('focus-sessions')->group(function () {
    Route::get('/', 'index');
    Route::get('active', 'active');
    Route::post('/', 'start');
    // The current session. {focusSession}/finish has one more segment, so
    // PATCH /focus-sessions/finish never reaches it, whatever the order.
    Route::patch('finish', 'finishCurrent');
    Route::patch('pause', 'pauseCurrent');
    Route::patch('resume', 'resumeCurrent');
    Route::patch('{focusSession}/finish', 'finish');
    // A missing session gets the same message as one in the wrong state.
    Route::patch('{focusSession}/pause', 'pause')
        ->missing(fn () => throw NotFoundException::focusSessionCannotBePaused());
    Route::patch('{focusSession}/resume', 'resume')
        ->missing(fn () => throw NotFoundException::focusSessionCannotBeResumed());
});
