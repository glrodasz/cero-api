defmodule CeroWeb.FocusSessionController do
  use CeroWeb, :controller

  alias Cero.FocusSessions
  alias CeroWeb.Params

  # Actions only handle success; anything else goes to the fallback controller.
  action_fallback CeroWeb.FallbackController

  # The API fields each action reads, and their names in the context.
  @start_fields %{"tasks" => :tasks, "startTime" => :start_time}
  @pause_fields %{"time" => :time}

  def index(conn, _params) do
    render(conn, :index, focus_sessions: FocusSessions.list())
  end

  def active(conn, _params) do
    case FocusSessions.get_current() do
      # The contract answers an empty object, not null, when no session is current.
      nil -> json(conn, %{})
      session -> render(conn, :show, focus_session: session)
    end
  end

  def create(conn, params) do
    with {:ok, session} <- FocusSessions.start(Params.take(params, @start_fields)) do
      conn
      |> put_status(:created)
      |> render(:show, focus_session: session)
    end
  end

  def finish_current(conn, _params) do
    with {:ok, session} <- FocusSessions.finish_current() do
      render(conn, :show, focus_session: session)
    end
  end

  def pause_current(conn, params) do
    with {:ok, session} <- FocusSessions.pause_current(Params.take(params, @pause_fields)) do
      render(conn, :show, focus_session: session)
    end
  end

  def resume_current(conn, _params) do
    with {:ok, session} <- FocusSessions.resume_current() do
      render(conn, :show, focus_session: session)
    end
  end

  def finish(conn, %{"id" => id}) do
    with {:ok, session} <- FocusSessions.finish(id) do
      render(conn, :show, focus_session: session)
    end
  end

  def pause(conn, %{"id" => id}) do
    with {:ok, session} <- FocusSessions.pause(id) do
      render(conn, :show, focus_session: session)
    end
  end

  def resume(conn, %{"id" => id}) do
    with {:ok, session} <- FocusSessions.resume(id) do
      render(conn, :show, focus_session: session)
    end
  end
end
