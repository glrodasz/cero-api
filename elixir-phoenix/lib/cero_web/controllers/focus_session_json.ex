defmodule CeroWeb.FocusSessionJSON do
  alias Cero.FocusSessions.{FocusSession, Pause}

  @doc "Renders a list of focus sessions."
  def index(%{focus_sessions: sessions}), do: for(session <- sessions, do: data(session))

  @doc "Renders a single focus session."
  def show(%{focus_session: session}), do: data(session)

  defp data(%FocusSession{} = session) do
    %{
      id: session.id,
      status: session.status,
      startTime: session.start_time,
      tasks: session.task_ids,
      pauses: for(pause <- session.pauses, do: pause_data(pause))
    }
  end

  defp pause_data(%Pause{} = pause) do
    %{
      id: pause.id,
      startTime: pause.start_time,
      endTime: pause.end_time,
      time: pause.time
    }
  end
end
