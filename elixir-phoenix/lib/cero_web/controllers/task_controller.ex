defmodule CeroWeb.TaskController do
  use CeroWeb, :controller

  alias Cero.Tasks
  alias CeroWeb.Params

  # Actions only handle success; anything else goes to the fallback controller.
  action_fallback CeroWeb.FallbackController

  # The API fields each action reads, and their names in the context.
  @create_fields %{"description" => :description}
  @update_fields %{
    "description" => :description,
    "priority" => :priority,
    "status" => :status,
    "focusSessionId" => :focus_session_id
  }

  def index(conn, _params) do
    render(conn, :index, tasks: Tasks.list())
  end

  def show(conn, %{"id" => id}) do
    with {:ok, task} <- Tasks.get(id) do
      render(conn, :show, task: task)
    end
  end

  def create(conn, params) do
    with {:ok, task} <- Tasks.create(Params.take(params, @create_fields)) do
      conn
      |> put_status(:created)
      |> render(:show, task: task)
    end
  end

  def complete(conn, %{"id" => id}) do
    with {:ok, task} <- Tasks.complete(id) do
      render(conn, :show, task: task)
    end
  end

  def reset(conn, %{"id" => id}) do
    with {:ok, task} <- Tasks.reset(id) do
      render(conn, :show, task: task)
    end
  end

  def change_status(conn, %{"id" => id, "status" => status}) do
    with {:ok, task} <- Tasks.change_status(id, status) do
      render(conn, :show, task: task)
    end
  end

  def update(conn, %{"id" => id} = params) do
    with {:ok, task} <- Tasks.update(id, Params.take(params, @update_fields)) do
      render(conn, :show, task: task)
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, task} <- Tasks.delete(id) do
      render(conn, :show, task: task)
    end
  end
end
