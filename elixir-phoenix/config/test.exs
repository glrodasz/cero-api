import Config

# Every test runs inside a transaction that is rolled back (the SQL sandbox).
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :cero, Cero.Repo,
  username: "root",
  password: "root",
  hostname: "localhost",
  database: "cero_phoenix_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# Tests call the endpoint directly (Phoenix.ConnTest), without a server.
config :cero, CeroWeb.Endpoint, server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime
