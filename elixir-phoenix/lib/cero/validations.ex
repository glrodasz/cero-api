defmodule Cero.Validations do
  @moduledoc """
  Changeset validations the contexts share and Ecto does not ship.
  """

  import Ecto.Changeset

  @doc """
  Refuses an explicit `nil` for fields a client may leave out but not empty:
  JSON `null` is not a string, a number or a list.

  Cast with `force_changes: true`, so that a `nil` shows up as a change even
  when the data already holds `nil`.
  """
  @spec validate_not_null(Ecto.Changeset.t(), [atom()]) :: Ecto.Changeset.t()
  def validate_not_null(changeset, fields) do
    for field <- fields, fetch_change(changeset, field) == {:ok, nil}, reduce: changeset do
      changeset -> add_error(changeset, field, "can't be null", validation: :not_null)
    end
  end
end
