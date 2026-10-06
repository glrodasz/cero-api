defmodule CeroWeb.ErrorJSON do
  @moduledoc """
  Renders error bodies in the contract's shape: `{"message": ...}`.

  Phoenix calls it for the errors it handles itself (see `render_errors` in
  config/config.exs), such as an unknown route or a crash.
  `CeroWeb.FallbackController` calls it with the message of a refusal.
  """

  def render(_template, %{message: message}), do: %{message: message}

  def render("404.json", _assigns), do: %{message: "Not found"}

  # Never the exception itself: it can hold internals such as credentials.
  def render("500.json", _assigns), do: %{message: "Internal server error"}

  # Any other status, e.g. "406.json" becomes "Not Acceptable".
  def render(template, _assigns) do
    %{message: Phoenix.Controller.status_message_from_template(template)}
  end
end
