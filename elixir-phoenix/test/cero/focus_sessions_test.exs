defmodule Cero.FocusSessionsTest do
  use Cero.DataCase, async: true

  import Cero.TasksFixtures

  alias Cero.FocusSessions
  alias Cero.FocusSessions.{FocusSession, Pause}
  alias Cero.Tasks
  alias Cero.Tasks.Task

  # A clock moved by hand: every call that reads the time gets `now:`.
  @now 1_000_000

  describe "start/2" do
    test "starts an active session with every in-progress and pending task by default" do
      active = task_fixture("active")
      done = task_fixture("done")
      {:ok, _} = Tasks.complete(done.id)

      assert {:ok, session} = FocusSessions.start(%{}, now: @now)

      assert %FocusSession{status: :active, start_time: @now, pauses: []} = session
      assert session.task_ids == [active.id]
      assert focus_session_id(active) == session.id
      assert focus_session_id(done) == nil
    end

    test "keeps requested tasks in request order, dropping unknown and repeated ids" do
      [a, b] = task_fixtures(["a", "b"])

      assert {:ok, session} = FocusSessions.start(%{tasks: [b.id, "unknown", a.id, b.id]})
      assert session.task_ids == [b.id, a.id]
    end

    test "uses the given start time" do
      assert {:ok, %FocusSession{start_time: 42}} = FocusSessions.start(%{start_time: 42})
    end

    test "refuses a request of the wrong shape" do
      for params <- [%{tasks: "all"}, %{tasks: [1, 2]}, %{tasks: nil}, %{start_time: "now"}] do
        assert {:error, %Ecto.Changeset{}} = FocusSessions.start(params)
      end
    end
  end

  describe "get_current/0" do
    test "returns nil when no session is current" do
      {:ok, _} = FocusSessions.start(%{})
      {:ok, _} = FocusSessions.finish_current()

      assert FocusSessions.get_current() == nil
    end

    test "moves startTime forward by the closed pauses only" do
      {:ok, session} = FocusSessions.start(%{}, now: @now)
      {:ok, _} = FocusSessions.pause(session.id, now: @now)
      {:ok, _} = FocusSessions.resume(session.id, now: @now + 300)
      # Still open: not counted yet.
      {:ok, _} = FocusSessions.pause(session.id, now: @now + 300)

      assert FocusSessions.get_current().start_time == @now + 300
    end

    test "returns the newest current session" do
      {:ok, _older} = FocusSessions.start(%{})
      {:ok, newest} = FocusSessions.start(%{})

      assert FocusSessions.get_current().id == newest.id
    end
  end

  describe "pause/2" do
    test "opens a pause on an active session" do
      {:ok, session} = FocusSessions.start(%{}, now: @now)
      paused_at = @now + 1_000

      assert {:ok, paused} = FocusSessions.pause(session.id, now: paused_at)
      assert paused.status == :paused
      assert [%Pause{start_time: ^paused_at, end_time: nil, time: 0}] = paused.pauses
    end

    test "refuses sessions that are not active" do
      {:ok, session} = FocusSessions.start(%{})
      {:ok, _} = FocusSessions.pause(session.id)

      assert FocusSessions.pause(session.id) == {:error, :cannot_pause}
      assert FocusSessions.pause(Ecto.UUID.generate()) == {:error, :cannot_pause}
    end
  end

  describe "pause_current/2" do
    test "fails when no session is current" do
      assert FocusSessions.pause_current(%{}) == {:error, :no_current_focus_session}
    end

    test "opens a pause on an active session" do
      {:ok, _} = FocusSessions.start(%{})

      assert {:ok, paused} = FocusSessions.pause_current(%{})
      assert %FocusSession{status: :paused, pauses: [%Pause{end_time: nil}]} = paused
    end

    test "leaves an already paused session as is when no time is given" do
      {:ok, _} = FocusSessions.start(%{}, now: @now)
      {:ok, paused} = FocusSessions.pause_current(%{}, now: @now)

      assert FocusSessions.pause_current(%{}, now: @now + 1_000) == {:ok, paused}
    end

    test "closes the open pause and opens a new one with the given time" do
      {:ok, _} = FocusSessions.start(%{}, now: @now)
      {:ok, _} = FocusSessions.pause_current(%{}, now: @now)
      later = @now + 1_000

      assert {:ok, paused} = FocusSessions.pause_current(%{time: 25}, now: later)

      assert [
               %Pause{start_time: @now, end_time: ^later, time: 1_000},
               %Pause{start_time: ^later, end_time: nil, time: 25}
             ] = paused.pauses
    end

    test "refuses a time that is not a number" do
      {:ok, _} = FocusSessions.start(%{})

      assert {:error, changeset} = FocusSessions.pause_current(%{time: "soon"})
      assert %{time: ["is invalid"]} = errors_on(changeset)
    end
  end

  describe "resume/2" do
    test "closes the open pause of a paused session" do
      {:ok, session} = FocusSessions.start(%{}, now: @now)
      {:ok, _} = FocusSessions.pause(session.id, now: @now)
      resumed_at = @now + 700

      assert {:ok, resumed} = FocusSessions.resume(session.id, now: resumed_at)
      assert resumed.status == :active
      assert [%Pause{end_time: ^resumed_at, time: 700}] = resumed.pauses
    end

    test "refuses sessions that are not paused" do
      {:ok, session} = FocusSessions.start(%{})

      assert FocusSessions.resume(session.id) == {:error, :cannot_resume}
      assert FocusSessions.resume(Ecto.UUID.generate()) == {:error, :cannot_resume}
    end
  end

  describe "resume_current/1" do
    test "closes the open pause of the current session" do
      {:ok, _} = FocusSessions.start(%{}, now: @now)
      {:ok, _} = FocusSessions.pause_current(%{}, now: @now)

      assert {:ok, resumed} = FocusSessions.resume_current(now: @now + 200)
      assert %FocusSession{status: :active, pauses: [%Pause{time: 200}]} = resumed
    end

    test "leaves a session without an open pause as is" do
      {:ok, session} = FocusSessions.start(%{})

      assert FocusSessions.resume_current() == {:ok, session}
    end

    test "fails when no session is current" do
      assert FocusSessions.resume_current() == {:error, :no_current_focus_session}
    end
  end

  describe "finish/2" do
    test "closes the open pause and releases the unfinished tasks only" do
      unfinished = task_fixture("unfinished")
      done = task_fixture("done")
      {:ok, session} = FocusSessions.start(%{}, now: @now)
      {:ok, _} = Tasks.complete(done.id)
      {:ok, _} = FocusSessions.pause(session.id, now: @now)

      assert {:ok, finished} = FocusSessions.finish(session.id, now: @now + 400)
      assert %FocusSession{status: :finished, pauses: [%Pause{time: 400}]} = finished
      assert focus_session_id(unfinished) == nil
      assert focus_session_id(done) == session.id
    end

    test "fails with not found for an unknown id" do
      assert FocusSessions.finish(Ecto.UUID.generate()) == {:error, :focus_session_not_found}
    end
  end

  describe "finish_current/1" do
    test "finishes the current session" do
      {:ok, session} = FocusSessions.start(%{})

      assert {:ok, %FocusSession{id: id, status: :finished}} = FocusSessions.finish_current()
      assert id == session.id
    end

    test "fails when no session is current" do
      assert FocusSessions.finish_current() == {:error, :no_current_focus_session}
    end
  end

  defp focus_session_id(task), do: Repo.get!(Task, task.id).focus_session_id
end
