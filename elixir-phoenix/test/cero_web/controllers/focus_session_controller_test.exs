defmodule CeroWeb.FocusSessionControllerTest do
  use CeroWeb.ConnCase, async: true

  import Cero.TasksFixtures

  alias Cero.FocusSessions

  @missing_id "00000000-0000-4000-8000-000000000000"

  test "answers {} for the active session when there is none", %{conn: conn} do
    assert json_response(get(conn, ~p"/focus-sessions/active"), 200) == %{}
  end

  test "starts a session without a body, with 201, in the contract's shape", %{conn: conn} do
    task = task_fixture()

    assert %{
             "id" => _,
             "status" => "active",
             "startTime" => start_time,
             "tasks" => [task_id],
             "pauses" => []
           } = json_response(post(conn, ~p"/focus-sessions"), 201)

    assert is_integer(start_time)
    assert task_id == task.id
  end

  test "reads the requested tasks and start time", %{conn: conn} do
    task = task_fixture()
    body = %{"tasks" => [task.id], "startTime" => 1_700_000_000_000}

    assert %{"tasks" => [task_id], "startTime" => 1_700_000_000_000} =
             json_response(post(conn, ~p"/focus-sessions", body), 201)

    assert task_id == task.id
  end

  test "renders pauses in the contract's shape", %{conn: conn} do
    {:ok, session} = FocusSessions.start(%{})
    {:ok, _} = FocusSessions.pause(session.id)

    assert %{"status" => "paused", "pauses" => [pause]} =
             json_response(get(conn, ~p"/focus-sessions/active"), 200)

    assert %{"id" => _, "startTime" => _, "endTime" => nil, "time" => 0} = pause
  end

  test "pauses the current session with the time it is given", %{conn: conn} do
    {:ok, _} = FocusSessions.start(%{})

    assert %{"pauses" => [%{"time" => 1_234}]} =
             json_response(patch(conn, ~p"/focus-sessions/pause", %{"time" => 1_234}), 200)
  end

  test "refuses a session start of the wrong shape", %{conn: conn} do
    for body <- [%{"tasks" => "all"}, %{"tasks" => [1, 2]}, %{"startTime" => "now"}] do
      assert %{"message" => _} = json_response(post(conn, ~p"/focus-sessions", body), 400)
    end
  end

  test "refuses a pause time that is not a number", %{conn: conn} do
    {:ok, _} = FocusSessions.start(%{})

    assert %{"message" => "time is invalid"} =
             json_response(patch(conn, ~p"/focus-sessions/pause", %{"time" => "soon"}), 400)
  end

  test "answers 404 with the canonical message when no session is current", %{conn: conn} do
    no_current_session = %{"message" => "No active focus session found"}

    for path <- [
          ~p"/focus-sessions/finish",
          ~p"/focus-sessions/pause",
          ~p"/focus-sessions/resume"
        ] do
      assert json_response(patch(conn, path), 404) == no_current_session
    end
  end

  test "answers 404 with the canonical message for an unknown session", %{conn: conn} do
    cannot_pause = "Focus session not found or cannot be paused"
    cannot_resume = "Focus session not found or cannot be resumed"

    for {path, message} <- [
          {~p"/focus-sessions/#{@missing_id}/finish", "Focus session not found"},
          {~p"/focus-sessions/#{@missing_id}/pause", cannot_pause},
          {~p"/focus-sessions/#{@missing_id}/resume", cannot_resume}
        ] do
      assert json_response(patch(conn, path), 404) == %{"message" => message}
    end
  end
end
