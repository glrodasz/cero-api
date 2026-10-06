defmodule Cero.FocusSessions.FocusSession do
  @moduledoc """
  A focus session, and the pure rules about its pauses.

  The rules take a session and return a changeset; the context decides when
  to apply them and persists the result.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Cero.FocusSessions.Pause

  @type t :: %__MODULE__{
          id: Ecto.UUID.t() | nil,
          status: :active | :paused | :finished | nil,
          start_time: integer() | nil,
          task_ids: [Ecto.UUID.t()],
          pauses: [Pause.t()],
          inserted_at: DateTime.t() | nil
        }

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "focus_sessions" do
    field :status, Ecto.Enum, values: [:active, :paused, :finished]
    field :start_time, :integer
    # The ids of the tasks the session started with.
    field :task_ids, {:array, :binary_id}, default: []
    embeds_many :pauses, Pause, on_replace: :delete

    # "The current session" is the newest one that is not finished.
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  @doc "Whether the session has an open pause (only the last one can be)."
  @spec pause_open?(t()) :: boolean()
  def pause_open?(%__MODULE__{pauses: pauses}) do
    match?(%Pause{end_time: nil}, List.last(pauses))
  end

  @doc """
  Closes the open pause, if any, and appends a new open pause starting `now`:
  the session is paused.
  """
  @spec pause_changeset(t(), integer(), integer()) :: Ecto.Changeset.t()
  def pause_changeset(%__MODULE__{} = session, now, time \\ 0) do
    new_pause = %Pause{start_time: now, end_time: nil, time: time}

    session
    |> change(status: :paused)
    |> put_embed(:pauses, close_open_pause(session.pauses, now) ++ [new_pause])
  end

  @doc "Closes the open pause: the session is active again."
  @spec resume_changeset(t(), integer()) :: Ecto.Changeset.t()
  def resume_changeset(%__MODULE__{} = session, now) do
    session
    |> change(status: :active)
    |> put_embed(:pauses, close_open_pause(session.pauses, now))
  end

  @doc "Closes the open pause, if any: the session is over."
  @spec finish_changeset(t(), integer()) :: Ecto.Changeset.t()
  def finish_changeset(%__MODULE__{} = session, now) do
    session
    |> change(status: :finished)
    |> put_embed(:pauses, close_open_pause(session.pauses, now))
  end

  @doc """
  Moves `start_time` forward by the time spent in closed pauses, so a client
  can compute the focused time as `now - start_time`.
  """
  @spec shift_start_time_by_closed_pauses(t()) :: t()
  def shift_start_time_by_closed_pauses(%__MODULE__{} = session) do
    paused_time =
      Enum.sum(
        for %Pause{end_time: end_time} = pause <- session.pauses,
            end_time != nil,
            do: end_time - pause.start_time
      )

    %{session | start_time: session.start_time + paused_time}
  end

  # The closed pause goes back as a changeset: put_embed/3 would not persist
  # the new fields of a modified struct.
  defp close_open_pause(pauses, now) do
    case List.pop_at(pauses, -1) do
      {%Pause{end_time: nil} = open_pause, earlier} -> earlier ++ [Pause.close(open_pause, now)]
      _no_open_pause -> pauses
    end
  end
end
