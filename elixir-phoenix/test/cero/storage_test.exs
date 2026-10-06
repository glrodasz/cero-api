defmodule Cero.StorageTest do
  # The other stacks prove their storage with the core's repository contract
  # (shared/core-test-plan.md). Phoenix has no repository port, so these cases
  # check what the schemas and migrations promise about Postgres.
  use Cero.DataCase, async: true

  alias Cero.FocusSessions
  alias Cero.FocusSessions.{FocusSession, Pause}
  alias Cero.Tasks.Task

  describe "tasks" do
    test "finds nothing for unknown or malformed ids" do
      deleted = Repo.insert!(%Task{description: "a task", status: :pending})
      Repo.delete!(deleted)

      assert Repo.fetch(Task, deleted.id) == :error
      assert Repo.fetch(Task, "not-an-id") == :error
    end

    test "sorts by priority, then creation order" do
      second = Repo.insert!(%Task{description: "a task", status: :pending, priority: 1})
      third = Repo.insert!(%Task{description: "a task", status: :pending, priority: 1})
      first = Repo.insert!(%Task{description: "a task", status: :pending, priority: 0})

      sorted = Task.in_list_order() |> Repo.all() |> Enum.map(& &1.id)

      assert sorted == [first.id, second.id, third.id]
    end
  end

  describe "focus sessions" do
    test "assigns an id on create and finds the session by it, pauses included" do
      session =
        Repo.insert!(%FocusSession{
          status: :paused,
          start_time: 1_000,
          task_ids: [Ecto.UUID.generate(), Ecto.UUID.generate()],
          pauses: [%Pause{start_time: 1_500, end_time: nil, time: 0}]
        })

      assert is_binary(session.id)
      assert Repo.get!(FocusSession, session.id) == session
    end

    test "stores pauses under the API's key names" do
      Repo.insert!(%FocusSession{
        status: :paused,
        start_time: 1_000,
        pauses: [%Pause{start_time: 1_500}]
      })

      assert %{rows: [[[pause]]]} = Repo.query!("SELECT pauses FROM focus_sessions")
      assert pause |> Map.keys() |> Enum.sort() == ["endTime", "id", "startTime", "time"]
    end

    test "lists sessions oldest first" do
      {:ok, first} = FocusSessions.start(%{start_time: 9})
      {:ok, second} = FocusSessions.start(%{start_time: 1})

      assert Enum.map(FocusSessions.list(), & &1.id) == [first.id, second.id]
    end
  end
end
