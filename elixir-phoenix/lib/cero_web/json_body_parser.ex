defmodule CeroWeb.JSONBodyParser do
  @moduledoc """
  `Plug.Parsers` for JSON bodies that answers a malformed body with a 400 itself.

  Plug.Parsers raises on a body that is not JSON. Phoenix would render that as
  a 400 too, but it re-raises the exception afterwards, and Bandit closes the
  connection after any exception: a client that reuses the connection for its
  next request would see that request fail.
  """

  @behaviour Plug

  import Plug.Conn

  @impl true
  def init(opts), do: Plug.Parsers.init(opts)

  @impl true
  def call(conn, parsers) do
    Plug.Parsers.call(conn, parsers)
  rescue
    Plug.Parsers.ParseError ->
      conn
      |> put_status(:bad_request)
      |> Phoenix.Controller.json(%{message: "The request body is not valid JSON"})
      |> halt()
  end
end
