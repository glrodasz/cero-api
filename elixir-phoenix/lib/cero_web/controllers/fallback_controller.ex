defmodule CeroWeb.FallbackController do
  @moduledoc """
  Translates what the contexts answer instead of `{:ok, _}` into an HTTP
  error. Controllers name it with `action_fallback`, so their actions only
  describe success.
  """

  use CeroWeb, :controller

  # Every reason the contexts give for refusing an action is a 404 with the
  # contract's canonical message.
  @not_found_messages %{
    task_not_found: "Task not found",
    focus_session_not_found: "Focus session not found",
    no_current_focus_session: "No active focus session found",
    cannot_pause: "Focus session not found or cannot be paused",
    cannot_resume: "Focus session not found or cannot be resumed"
  }

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    conn
    |> put_status(:bad_request)
    |> put_view(json: CeroWeb.ChangesetJSON)
    |> render(:error, changeset: changeset)
  end

  def call(conn, {:error, reason}) when is_map_key(@not_found_messages, reason) do
    conn
    |> put_status(:not_found)
    |> put_view(json: CeroWeb.ErrorJSON)
    |> render(:"404", message: Map.fetch!(@not_found_messages, reason))
  end
end
