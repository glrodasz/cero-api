defmodule CeroWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :cero

  # Code reloading can be explicitly enabled under the
  # :code_reloader configuration of your endpoint.
  if code_reloading? do
    plug Phoenix.CodeReloader
    plug Phoenix.Ecto.CheckRepoStatus, otp_app: :cero
  end

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  # JSON in: a body that is not JSON is answered with a 400.
  plug CeroWeb.JSONBodyParser,
    parsers: [:json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Plug.Head
  plug CeroWeb.Router
end
