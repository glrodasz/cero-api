defmodule Cero.Tasks do
  @moduledoc """
  The task use cases: one public function per API endpoint.

  Functions answer `{:ok, result}`, `{:error, :task_not_found}`, or
  `{:error, changeset}` when the request is invalid. Requests are validated
  before the task is looked up, so an invalid request about a missing task is
  refused as invalid.
  """

  import Ecto.Query, only: [from: 2, where: 2]

  alias Cero.FocusSessions
  alias Cero.FocusSessions.FocusSession
  alias Cero.Repo
  alias Cero.Tasks.Task
  alias Ecto.Changeset
  alias Ecto.Multi

  @doc "What the user should be looking at: the current session's tasks, or every unfinished task."
  @spec list() :: [Task.t()]
  def list do
    query =
      case FocusSessions.get_current() do
        nil -> Task.unfinished()
        session -> where(Task, focus_session_id: ^session.id)
      end

    query |> Task.in_list_order() |> Repo.all()
  end

  @doc "The task with this id. A malformed id is simply not found."
  @spec get(String.t()) :: {:ok, Task.t()} | {:error, :task_not_found}
  def get(id) do
    case Repo.fetch(Task, id) do
      {:ok, task} -> {:ok, task}
      :error -> {:error, :task_not_found}
    end
  end

  @doc """
  Creates a task from `%{description: ...}` at priority 0, in progress while
  fewer than three tasks are (pending otherwise), in the current session if
  there is one.
  """
  @spec create(map()) :: {:ok, Task.t()} | {:error, Changeset.t()}
  def create(attrs) do
    in_progress_count = Repo.aggregate(where(Task, status: :"in-progress"), :count)
    current_session = FocusSessions.get_current()

    %Task{
      status: Task.status_for_new_task(in_progress_count),
      focus_session_id: current_session && current_session.id
    }
    |> Task.create_changeset(attrs)
    |> Repo.insert()
  end

  @doc "Puts the task on top of the completed group; the rest of the group follows."
  @spec complete(String.t()) :: {:ok, Task.t()} | {:error, :task_not_found}
  def complete(id), do: move_to_top_of(id, :completed)

  @doc "Puts the task on top of the pending group; the rest of the group follows."
  @spec reset(String.t()) :: {:ok, Task.t()} | {:error, :task_not_found}
  def reset(id), do: move_to_top_of(id, :pending)

  @doc "Sets the status only."
  @spec change_status(String.t(), String.t()) ::
          {:ok, Task.t()} | {:error, :task_not_found | Changeset.t()}
  def change_status(id, status), do: update(id, %{status: status})

  @doc """
  Updates the given fields among `description`, `priority`, `status` and
  `focus_session_id`, which must name an existing session (or be `nil`).
  """
  @spec update(String.t(), map()) :: {:ok, Task.t()} | {:error, :task_not_found | Changeset.t()}
  def update(id, attrs) do
    with {:ok, changes} <- validate_changes(attrs),
         {:ok, task} <- get(id) do
      task |> Changeset.change(changes) |> Repo.update()
    end
  end

  @doc "Deletes the task and returns it."
  @spec delete(String.t()) :: {:ok, Task.t()} | {:error, :task_not_found}
  def delete(id) do
    with {:ok, task} <- get(id), do: Repo.delete(task)
  end

  # The task becomes priority 0 of the group; the rest of the group follows as 1..n.
  defp move_to_top_of(id, status) do
    with {:ok, task} <- get(id),
         {:ok, %{task: moved_task}} <- Repo.transact(move_to_top_multi(task, status)) do
      {:ok, moved_task}
    end
  end

  # A Multi only describes the work: the group is read and rewritten in one transaction.
  defp move_to_top_multi(task, status) do
    rest_of_group =
      from t in Task.in_list_order(), where: t.status == ^status and t.id != ^task.id

    Multi.new()
    |> Multi.all(:rest_of_group, rest_of_group)
    |> Multi.merge(fn %{rest_of_group: tasks} -> renumber_multi(tasks) end)
    |> Multi.update(:task, Changeset.change(task, status: status, priority: 0))
  end

  defp renumber_multi(tasks) do
    tasks
    |> Task.renumber()
    |> Enum.reduce(Multi.new(), &Multi.update(&2, {:renumber, &1.data.id}, &1))
  end

  defp validate_changes(attrs) do
    changeset =
      attrs
      |> Task.changes_changeset()
      |> Changeset.validate_change(:focus_session_id, &validate_session_exists/2)

    if changeset.valid?, do: {:ok, changeset.changes}, else: {:error, changeset}
  end

  defp validate_session_exists(:focus_session_id, session_id) do
    if Repo.exists?(where(FocusSession, id: ^session_id)),
      do: [],
      else: [focus_session_id: "does not match any focus session"]
  end
end
