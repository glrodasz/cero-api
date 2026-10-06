<?php

namespace App\Http\Controllers;

use App\Actions\FocusSessions\FinishFocusSession;
use App\Actions\FocusSessions\GetCurrentFocusSession;
use App\Actions\FocusSessions\PauseCurrentFocusSession;
use App\Actions\FocusSessions\PauseFocusSession;
use App\Actions\FocusSessions\ResumeCurrentFocusSession;
use App\Actions\FocusSessions\ResumeFocusSession;
use App\Actions\FocusSessions\StartFocusSession;
use App\Http\Requests\PauseFocusSessionRequest;
use App\Http\Requests\StartFocusSessionRequest;
use App\Http\Resources\FocusSessionResource;
use App\Models\FocusSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** /focus-sessions. Either a {focusSession} from route model binding, or the current session. */
class FocusSessionController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return FocusSessionResource::collection(FocusSession::oldest()->get());
    }

    public function active(GetCurrentFocusSession $getCurrent): FocusSessionResource|JsonResponse
    {
        $session = $getCurrent->handle();

        // The contract answers an empty object, not null, when no session is current.
        return $session ? new FocusSessionResource($session) : new JsonResponse((object) []);
    }

    /** Answers 201: Laravel does it for a model created during the request. */
    public function start(StartFocusSessionRequest $request, StartFocusSession $start): FocusSessionResource
    {
        return new FocusSessionResource($start->handle(
            taskIds: $request->validated('tasks', []),
            startTime: $request->validated('startTime'),
        ));
    }

    public function finish(FocusSession $focusSession, FinishFocusSession $finish): FocusSessionResource
    {
        return new FocusSessionResource($finish->handle($focusSession));
    }

    public function finishCurrent(FinishFocusSession $finish): FocusSessionResource
    {
        return new FocusSessionResource($finish->handle(FocusSession::currentOrFail()));
    }

    public function pause(FocusSession $focusSession, PauseFocusSession $pause): FocusSessionResource
    {
        return new FocusSessionResource($pause->handle($focusSession));
    }

    public function pauseCurrent(PauseFocusSessionRequest $request, PauseCurrentFocusSession $pauseCurrent): FocusSessionResource
    {
        return new FocusSessionResource($pauseCurrent->handle($request->validated('time')));
    }

    public function resume(FocusSession $focusSession, ResumeFocusSession $resume): FocusSessionResource
    {
        return new FocusSessionResource($resume->handle($focusSession));
    }

    public function resumeCurrent(ResumeCurrentFocusSession $resumeCurrent): FocusSessionResource
    {
        return new FocusSessionResource($resumeCurrent->handle());
    }
}
