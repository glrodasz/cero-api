defmodule Cero.Repo do
  use Ecto.Repo,
    otp_app: :cero,
    adapter: Ecto.Adapters.Postgres

  @doc """
  Fetches a record by an id a client sent.

  Ids are UUIDs, so anything else cannot exist: it answers `:error`, like an
  unknown id, where `get/2` would raise.
  """
  @spec fetch(Ecto.Queryable.t(), term()) :: {:ok, Ecto.Schema.t()} | :error
  def fetch(queryable, id) do
    with {:ok, uuid} <- Ecto.UUID.cast(id),
         %{} = record <- get(queryable, uuid) do
      {:ok, record}
    else
      _malformed_or_unknown -> :error
    end
  end
end
