defmodule Cero.TasksFixtures do
  @moduledoc """
  Test helpers for creating tasks through the `Cero.Tasks` context.
  """

  alias Cero.Tasks

  @doc "Creates a task with the given description."
  def task_fixture(description \\ "a task") do
    {:ok, task} = Tasks.create(%{description: description})
    task
  end

  @doc "Creates the tasks one after another (creation order matters) and returns them in that order."
  def task_fixtures(descriptions), do: Enum.map(descriptions, &task_fixture/1)
end
