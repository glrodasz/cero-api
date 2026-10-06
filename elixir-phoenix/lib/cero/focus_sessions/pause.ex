defmodule Cero.FocusSessions.Pause do
  @moduledoc """
  A break inside a focus session. Pauses are values owned by their session:
  they are embedded in its `pauses` jsonb column, oldest first.
  """

  use Ecto.Schema

  @type t :: %__MODULE__{
          id: Ecto.UUID.t() | nil,
          start_time: integer(),
          end_time: integer() | nil,
          time: integer()
        }

  # The jsonb keys follow the API, as in database/postgres/schema.sql.
  @primary_key {:id, :binary_id, autogenerate: true}
  embedded_schema do
    field :start_time, :integer, source: :startTime
    # nil while the pause is open.
    field :end_time, :integer, source: :endTime
    # The duration once closed, or the value a client sent when pausing.
    field :time, :integer, default: 0
  end

  @doc "Closes the pause at `now`: it lasted `now - start_time`."
  @spec close(t(), integer()) :: Ecto.Changeset.t()
  def close(%__MODULE__{} = pause, now) do
    Ecto.Changeset.change(pause, end_time: now, time: now - pause.start_time)
  end
end
