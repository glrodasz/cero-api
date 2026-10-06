import Config

# config/runtime.exs is executed for all environments, including during
# releases, after compilation and before the system starts. It reads the
# environment variables every Cero implementation shares (see shared/README.md).

# Phoenix uses Ecto contexts directly, so Postgres is its only storage.
storage = System.get_env("STORAGE", "postgres")

if storage != "postgres" do
  raise "elixir-phoenix only supports STORAGE=postgres (got STORAGE=#{storage})"
end

# If you use `mix release`, enable the server with PHX_SERVER=true.
if System.get_env("PHX_SERVER") do
  config :cero, CeroWeb.Endpoint, server: true
end

config :cero, CeroWeb.Endpoint, http: [port: String.to_integer(System.get_env("PORT", "4000"))]

if config_env() == :dev do
  if database_url = System.get_env("DATABASE_URL") do
    config :cero, Cero.Repo, url: database_url
  end
end

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  config :cero, Cero.Repo,
    # ssl: true,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    socket_options: maybe_ipv6

  host = System.get_env("PHX_HOST") || "example.com"

  config :cero, CeroWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See https://bandit.hexdocs.pm/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ]
end
