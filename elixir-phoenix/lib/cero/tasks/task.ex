defmodule Cero.Tasks.Task do
  @moduledoc """
  A task, and the pure rules about tasks: how a new one starts, how a group
  is renumbered, and the queries the contexts compose.
  """

  use Ecto.Schema

  import Ecto.Changeset
  import Ecto.Query, only: [order_by: 3, where: 3]
  import Cero.Validations

  alias Cero.FocusSessions.FocusSession

  @type status :: :"in-progress" | :pending | :completed

  @type t :: %__MODULE__{
          id: Ecto.UUID.t() | nil,
          description: String.t() | nil,
          priority: integer(),
          status: status() | nil,
          focus_session_id: Ecto.UUID.t() | nil,
          inserted_at: DateTime.t() | nil
        }

  # Focus rule: a new task only starts in progress while fewer than this many are.
  @max_in_progress 3

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "tasks" do
    field :description, :string
    # 0 is the top of its status group.
    field :priority, :integer, default: 0
    # Quoted atoms keep the API's spelling. The `in_progress: "in-progress"`
    # form would also accept "in_progress" from clients.
    field :status, Ecto.Enum, values: [:"in-progress", :pending, :completed]
    belongs_to :focus_session, FocusSession

    # Creation order breaks ties between equal priorities.
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  @doc "A new task: clients only choose its description."
  @spec create_changeset(t(), map()) :: Ecto.Changeset.t()
  def create_changeset(%__MODULE__{} = task, attrs) do
    task
    # An empty description is still a string, which is all the API asks for.
    |> cast(attrs, [:description], empty_values: [])
    |> validate_required(:description)
  end

  @doc """
  The fields a client may change, cast onto an empty task so a request is
  validated before the task it targets is looked up.

  Every given field becomes a change; only `focus_session_id` may be `nil`.
  """
  @spec changes_changeset(map()) :: Ecto.Changeset.t()
  def changes_changeset(attrs) do
    %__MODULE__{}
    |> cast(attrs, [:description, :priority, :status, :focus_session_id],
      empty_values: [],
      force_changes: true
    )
    |> validate_not_null([:description, :priority, :status])
  end

  @doc "The status of a new task, given how many tasks are in progress."
  @spec status_for_new_task(non_neg_integer()) :: status()
  def status_for_new_task(in_progress_count) when in_progress_count < @max_in_progress,
    do: :"in-progress"

  def status_for_new_task(_in_progress_count), do: :pending

  @doc "Gives the tasks consecutive priorities 1..n, keeping their order."
  @spec renumber([t()]) :: [Ecto.Changeset.t()]
  def renumber(tasks) do
    for {task, priority} <- Enum.with_index(tasks, 1), do: change(task, priority: priority)
  end

  @doc "Tasks that still need work: in progress or pending."
  @spec unfinished(Ecto.Queryable.t()) :: Ecto.Query.t()
  def unfinished(query \\ __MODULE__) do
    where(query, [task], task.status in [:"in-progress", :pending])
  end

  @doc "Tasks in the order clients see them: by priority, then creation order."
  @spec in_list_order(Ecto.Queryable.t()) :: Ecto.Query.t()
  def in_list_order(query \\ __MODULE__) do
    order_by(query, [task], [task.priority, task.inserted_at])
  end
end
