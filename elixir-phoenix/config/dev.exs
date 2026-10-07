import Config

# The database from the repository's docker-compose.yml. DATABASE_URL, when
# set, overrides it (see config/runtime.exs).
config :cero, Cero.Repo,
  username: "root",
  password: "root",
  hostname: "localhost",
  database: "cero_phoenix",
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

# The port comes from PORT, in config/runtime.exs.
config :cero, CeroWeb.Endpoint,
  # Binding to loopback ipv4 address prevents access from other machines.
  http: [ip: {127, 0, 0, 1}],
  code_reloader: true,
  # The contract wants {"message": ...} error bodies in every environment, so
  # errors render through CeroWeb.ErrorJSON rather than the debug error page.
  debug_errors: false

# Do not include metadata nor timestamps in development logs
config :logger, :default_formatter, format: "[$level] $message\n"

# Set a higher stacktrace during development. Avoid configuring such
# in production as building large stacktraces may be expensive.
config :phoenix, :stacktrace_depth, 20

# Initialize plugs at runtime for faster development compilation
config :phoenix, :plug_init_mode, :runtime
