<?php

use App\Exceptions\NotFoundException;
use App\Http\Middleware\EnsureJsonBodyIsValid;
use App\Models\FocusSession;
use App\Models\Task;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Routing\Exceptions\BackedEnumCaseNotFoundException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        // The contract serves /tasks and /focus-sessions, not /api/tasks.
        apiPrefix: '',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Strings are stored as sent: neither trimmed nor turned into null.
        $middleware->remove([TrimStrings::class, ConvertEmptyStringsToNull::class]);
        $middleware->append(EnsureJsonBodyIsValid::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $error = fn (string $message, int $status) => response()->json(['message' => $message], $status);

        // A model was not found (by route model binding, mostly): use its canonical message.
        $exceptions->map(fn (ModelNotFoundException $e) => match ($e->getModel()) {
            Task::class => NotFoundException::task(),
            FocusSession::class => NotFoundException::focusSession(),
            default => $e,
        });
        // The only enum bound from a route is {status} in PATCH /tasks/{task}/{status}.
        // Laravel treats an unknown case as a missing page; the contract, as invalid input.
        $exceptions->map(fn (BackedEnumCaseNotFoundException $e) => ValidationException::withMessages([
            'status' => 'Invalid task status',
        ]));
        $exceptions->dontReport(NotFoundException::class);

        // Laravel answers validation errors with a 422; the contract wants a 400.
        $exceptions->render(fn (ValidationException $e) => $error($e->getMessage(), 400));
        $exceptions->render(fn (NotFoundException $e) => $error($e->getMessage(), 404));
        // A path served for other methods only is just another unknown route.
        $exceptions->render(fn (NotFoundHttpException|MethodNotAllowedHttpException $e) => $error('Not found', 404));
        $exceptions->render(fn (HttpExceptionInterface $e) => $error($e->getMessage(), $e->getStatusCode()));
        // Anything else is unexpected: it is logged, and the client learns nothing
        // about it, even with APP_DEBUG on.
        $exceptions->render(fn (Throwable $e) => $error('Internal server error', 500));
    })->create();
