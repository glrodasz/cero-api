defmodule CeroWeb do
  @moduledoc """
  The entrypoint for defining the web interface, used as:

      use CeroWeb, :controller
      use CeroWeb, :router

  The definitions below will be executed for every controller and router, so
  keep them short and clean, focused on imports, uses and aliases.
  """

  def router do
    quote do
      use Phoenix.Router, helpers: false

      # Import common connection and controller functions to use in pipelines
      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def controller do
    quote do
      use Phoenix.Controller, formats: [:json]

      import Plug.Conn
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: CeroWeb.Endpoint,
        router: CeroWeb.Router
    end
  end

  @doc """
  When used, dispatch to the appropriate controller/router/etc.
  """
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
