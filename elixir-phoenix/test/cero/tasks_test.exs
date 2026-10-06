defmodule Cero.TasksTest do
  use Cero.DataCase, async: true

  import Cero.TasksFixtures

  alias Cero.FocusSessions
  alias Cero.Tasks
  alias Cero.Tasks.Task

  describe "list/0" do
    test "lists in-progress and pending tasks by priority when no session is current" do
      [first, second, done] = task_fixtures(["first", "second", "done"])
      {:ok, _} = Tasks.complete(done.id)
      {:ok, _} = Tasks.update(first.id, %{priority: 5})

      assert ids(Tasks.list()) == [second.id, first.id]
    end

    test "lists the current session's tasks, completed ones included" do
      in_session = task_fixture("in session")
      {:ok, _} = FocusSessions.start(%{tasks: [in_session.id]})
      {:ok, _} = Tasks.complete(in_session.id)
      outside = task_fixture("created during the session")
      {:ok, _} = Tasks.update(outside.id, %{focus_session_id: nil})

      assert ids(Tasks.list()) == [in_session.id]
    end

    test "keeps creation order between tasks with the same priority" do
      task_fixtures(["a", "b", "c"])

      assert Enum.map(Tasks.list(), & &1.description) == ["a", "b", "c"]
    end
  end

  describe "get/1" do
    test "fails with not found for an unknown id" do
      assert Tasks.get(Ecto.UUID.generate()) == {:error, :task_not_found}
      assert Tasks.get("not-a-uuid") == {:error, :task_not_found}
    end
  end

  describe "create/1" do
    test "starts tasks in progress until three are in progress, then as pending" do
      statuses = for task <- task_fixtures(["1", "2", "3", "4"]), do: task.status

      assert statuses == [:"in-progress", :"in-progress", :"in-progress", :pending]
    end

    test "creates the task at priority 0 without a session when none is current" do
      assert {:ok, task} = Tasks.create(%{description: "write tests"})

      assert %Task{
               description: "write tests",
               priority: 0,
               status: :"in-progress",
               focus_session_id: nil
             } = task
    end

    test "attaches the task to the current session" do
      {:ok, session} = FocusSessions.start(%{})

      assert task_fixture("joins the session").focus_session_id == session.id
    end

    test "requires a string description, even an empty one" do
      assert {:ok, %Task{description: ""}} = Tasks.create(%{description: ""})

      for attrs <- [%{}, %{description: nil}, %{description: 42}] do
        assert {:error, changeset} = Tasks.create(attrs)
        assert %{description: [_message]} = errors_on(changeset)
      end
    end
  end

  describe "complete/1" do
    test "puts the task on top of the completed group and renumbers the rest" do
      [a, b, c] = task_fixtures(["a", "b", "c"])
      {:ok, _} = Tasks.complete(a.id)
      {:ok, _} = Tasks.complete(b.id)

      assert {:ok, %Task{status: :completed, priority: 0}} = Tasks.complete(c.id)
      assert priorities([c, b, a]) == [0, 1, 2]
    end

    test "changes nothing when the task does not exist" do
      a = task_fixture("a")
      {:ok, _} = Tasks.complete(a.id)
      {:ok, _} = Tasks.update(a.id, %{priority: 7})

      assert Tasks.complete(Ecto.UUID.generate()) == {:error, :task_not_found}
      assert priorities([a]) == [7]
    end
  end

  describe "reset/1" do
    test "puts the task on top of the pending group and renumbers the rest" do
      # The fourth task starts pending.
      [a, b, c, d] = task_fixtures(["a", "b", "c", "d"])
      {:ok, _} = Tasks.reset(c.id)

      assert {:ok, %Task{status: :pending, priority: 0}} = Tasks.reset(a.id)
      assert priorities([a, c, d]) == [0, 1, 2]
      assert {:ok, %Task{status: :"in-progress"}} = Tasks.get(b.id)
    end
  end

  describe "change_status/2" do
    test "sets only the status" do
      task = task_fixture("a")
      {:ok, _} = Tasks.update(task.id, %{priority: 4})

      assert {:ok, %Task{status: :pending, priority: 4}} = Tasks.change_status(task.id, "pending")
    end

    test "rejects an unknown status before looking the task up" do
      assert {:error, changeset} = Tasks.change_status(Ecto.UUID.generate(), "done")
      assert %{status: ["is invalid"]} = errors_on(changeset)
    end
  end

  describe "update/2" do
    test "changes only the given fields" do
      {:ok, _} = FocusSessions.start(%{})
      task = task_fixture("before")

      assert {:ok, updated} =
               Tasks.update(task.id, %{description: "after", focus_session_id: nil})

      assert updated == %{task | description: "after", focus_session_id: nil}
    end

    test "rejects an unknown status" do
      task = task_fixture("a")

      assert {:error, changeset} = Tasks.update(task.id, %{status: "done"})
      assert %{status: ["is invalid"]} = errors_on(changeset)
    end

    test "rejects a focusSessionId that does not match a session" do
      task = task_fixture("a")

      assert {:error, changeset} =
               Tasks.update(task.id, %{focus_session_id: Ecto.UUID.generate()})

      assert %{focus_session_id: ["does not match any focus session"]} = errors_on(changeset)
    end

    test "rejects wrong types and nulls before looking the task up" do
      for changes <- [
            %{priority: "high"},
            %{description: nil},
            %{status: nil},
            %{focus_session_id: Ecto.UUID.generate()}
          ] do
        assert {:error, %Ecto.Changeset{}} = Tasks.update(Ecto.UUID.generate(), changes)
      end
    end
  end

  describe "delete/1" do
    test "removes the task and returns it" do
      task = task_fixture("a")

      assert {:ok, %Task{id: id, description: "a"}} = Tasks.delete(task.id)
      assert id == task.id
      assert Tasks.get(task.id) == {:error, :task_not_found}
    end

    test "fails with not found for an unknown id" do
      assert Tasks.delete(Ecto.UUID.generate()) == {:error, :task_not_found}
    end
  end

  defp ids(tasks), do: Enum.map(tasks, & &1.id)

  defp priorities(tasks), do: for(task <- tasks, do: Repo.get!(Task, task.id).priority)
end
