# Compile-time configuration shared by every environment. The file for the
# current environment is imported at the bottom and overrides it; environment
# variables are read at boot, in config/runtime.exs.
import Config

config :cero,
  ecto_repos: [Cero.Repo],
  generators: [timestamp_type: :utc_datetime, binary_id: true]

config :cero, CeroWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  # The errors Phoenix handles itself (unknown route, crash) render through
  # CeroWeb.ErrorJSON, in the contract's {"message": ...} shape.
  render_errors: [formats: [json: CeroWeb.ErrorJSON], layout: false]

config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
