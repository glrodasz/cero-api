defmodule CeroWeb.TaskJSON do
  alias Cero.Tasks.Task

  @doc "Renders a list of tasks."
  def index(%{tasks: tasks}), do: for(task <- tasks, do: data(task))

  @doc "Renders a single task."
  def show(%{task: task}), do: data(task)

  defp data(%Task{} = task) do
    %{
      id: task.id,
      description: task.description,
      priority: task.priority,
      status: task.status,
      focusSessionId: task.focus_session_id
    }
  end
end
