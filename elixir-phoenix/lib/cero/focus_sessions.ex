defmodule Cero.FocusSessions do
  @moduledoc """
  The focus session use cases: one public function per API endpoint.

  Functions answer `{:ok, session}`, `{:error, changeset}` when the request is
  invalid, or one of the reasons a session cannot be acted on:
  `:focus_session_not_found`, `:no_current_focus_session`, `:cannot_pause` and
  `:cannot_resume`.

  Functions that need the time take a `:now` option, in epoch milliseconds,
  so tests control the clock. It defaults to the system time.
  """

  import Ecto.Changeset, only: [cast: 4, apply_action: 2]
  import Ecto.Query, only: [from: 2, select: 3, where: 2]
  import Cero.Validations

  alias Cero.FocusSessions.FocusSession
  alias Cero.Repo
  alias Cero.Tasks.Task
  alias Ecto.Changeset
  alias Ecto.Multi

  @start_fields %{tasks: {:array, :string}, start_time: :integer}
  @pause_fields %{time: :integer}

  @doc "Every session, oldest first."
  @spec list() :: [FocusSession.t()]
  def list, do: Repo.all(from s in FocusSession, order_by: s.inserted_at)

  @doc "The current session as a client should display it, or `nil` when there is none."
  @spec get_current() :: FocusSession.t() | nil
  def get_current do
    with %FocusSession{} = session <- Repo.one(current_query()) do
      FocusSession.shift_start_time_by_closed_pauses(session)
    end
  end

  @doc """
  Starts an active session from `%{tasks: ids, start_time: ms}`, both optional.

  The session keeps the requested tasks that exist, in request order, or
  every unfinished task when none are requested. Each of them joins it.
  """
  @spec start(map(), keyword()) :: {:ok, FocusSession.t()} | {:error, Changeset.t()}
  def start(params, opts \\ []) do
    with {:ok, request} <- cast_request(params, @start_fields),
         {:ok, %{session: session}} <- Repo.transact(start_multi(new_session(request, opts))) do
      {:ok, session}
    end
  end

  @doc """
  Finishes the session: its open pause closes and its unfinished tasks leave
  it (completed ones keep it, as history).
  """
  @spec finish(String.t(), keyword()) ::
          {:ok, FocusSession.t()} | {:error, :focus_session_not_found}
  def finish(id, opts \\ []) do
    case Repo.fetch(FocusSession, id) do
      {:ok, session} -> finish_session(session, now(opts))
      :error -> {:error, :focus_session_not_found}
    end
  end

  @doc "Finishes the current session, like `finish/2`."
  @spec finish_current(keyword()) :: {:ok, FocusSession.t()} | {:error, :no_current_focus_session}
  def finish_current(opts \\ []) do
    with {:ok, session} <- fetch_current(), do: finish_session(session, now(opts))
  end

  @doc "Pauses an active session."
  @spec pause(String.t(), keyword()) :: {:ok, FocusSession.t()} | {:error, :cannot_pause}
  def pause(id, opts \\ []) do
    case Repo.fetch(FocusSession, id) do
      {:ok, %FocusSession{status: :active} = session} ->
        session |> FocusSession.pause_changeset(now(opts)) |> Repo.update()

      _missing_or_not_active ->
        {:error, :cannot_pause}
    end
  end

  @doc """
  Pauses the current session. Sending `time` always starts a fresh pause
  (closing an open one first); without it, an already paused session stays as is.
  """
  @spec pause_current(map(), keyword()) ::
          {:ok, FocusSession.t()} | {:error, :no_current_focus_session | Changeset.t()}
  def pause_current(params, opts \\ []) do
    with {:ok, request} <- cast_request(params, @pause_fields),
         {:ok, session} <- fetch_current() do
      if FocusSession.pause_open?(session) and not Map.has_key?(request, :time) do
        {:ok, session}
      else
        session
        |> FocusSession.pause_changeset(now(opts), Map.get(request, :time, 0))
        |> Repo.update()
      end
    end
  end

  @doc "Resumes a paused session."
  @spec resume(String.t(), keyword()) :: {:ok, FocusSession.t()} | {:error, :cannot_resume}
  def resume(id, opts \\ []) do
    case Repo.fetch(FocusSession, id) do
      {:ok, %FocusSession{status: :paused} = session} ->
        session |> FocusSession.resume_changeset(now(opts)) |> Repo.update()

      _missing_or_not_paused ->
        {:error, :cannot_resume}
    end
  end

  @doc "Resumes the current session. Without an open pause, it stays as is."
  @spec resume_current(keyword()) :: {:ok, FocusSession.t()} | {:error, :no_current_focus_session}
  def resume_current(opts \\ []) do
    with {:ok, session} <- fetch_current() do
      if FocusSession.pause_open?(session) do
        session |> FocusSession.resume_changeset(now(opts)) |> Repo.update()
      else
        {:ok, session}
      end
    end
  end

  # "The current session" is the newest one that is active or paused.
  defp current_query do
    from s in FocusSession,
      where: s.status in [:active, :paused],
      order_by: [desc: s.inserted_at],
      limit: 1
  end

  defp fetch_current do
    case Repo.one(current_query()) do
      nil -> {:error, :no_current_focus_session}
      session -> {:ok, session}
    end
  end

  # A schemaless changeset: the request is not a schema, but gets the same casting.
  defp cast_request(params, fields) do
    {%{}, fields}
    |> cast(params, Map.keys(fields), force_changes: true)
    |> validate_not_null(Map.keys(fields))
    |> apply_action(:validate)
  end

  defp new_session(request, opts) do
    %FocusSession{
      status: :active,
      start_time: Map.get_lazy(request, :start_time, fn -> now(opts) end),
      task_ids: session_task_ids(Map.get(request, :tasks, []))
    }
  end

  defp session_task_ids([]) do
    Task.unfinished() |> Task.in_list_order() |> select([t], t.id) |> Repo.all()
  end

  # Unknown (or malformed) ids are dropped; the rest keep the order they were requested in.
  defp session_task_ids(requested_ids) do
    ids = Enum.uniq(for id <- requested_ids, {:ok, uuid} <- [Ecto.UUID.cast(id)], do: uuid)
    existing_ids = MapSet.new(Repo.all(from t in Task, where: t.id in ^ids, select: t.id))
    Enum.filter(ids, &MapSet.member?(existing_ids, &1))
  end

  defp start_multi(session) do
    Multi.new()
    |> Multi.insert(:session, session)
    |> Multi.update_all(:join_tasks, &tasks_joining/1, [])
  end

  defp tasks_joining(%{session: session}) do
    from t in Task,
      where: t.id in ^session.task_ids,
      update: [set: [focus_session_id: ^session.id]]
  end

  defp finish_session(session, now) do
    unfinished_tasks = where(Task.unfinished(), focus_session_id: ^session.id)

    multi =
      Multi.new()
      |> Multi.update(:session, FocusSession.finish_changeset(session, now))
      |> Multi.update_all(:release_tasks, unfinished_tasks, set: [focus_session_id: nil])

    with {:ok, %{session: finished_session}} <- Repo.transact(multi) do
      {:ok, finished_session}
    end
  end

  defp now(opts), do: Keyword.get_lazy(opts, :now, fn -> System.os_time(:millisecond) end)
end
