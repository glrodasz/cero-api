defmodule CeroWeb.Router do
  use CeroWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  # Routes match in the order they are declared. Any other route raises
  # Phoenix.Router.NoRouteError, which renders as 404 {"message": "Not found"}.

  scope "/tasks", CeroWeb do
    pipe_through :api

    get "/", TaskController, :index
    post "/", TaskController, :create
    get "/:id", TaskController, :show
    # Declared before "/:id/:status", which would otherwise capture them.
    patch "/:id/complete", TaskController, :complete
    patch "/:id/reset", TaskController, :reset
    patch "/:id/:status", TaskController, :change_status
    patch "/:id", TaskController, :update
    delete "/:id", TaskController, :delete
  end

  scope "/focus-sessions", CeroWeb do
    pipe_through :api

    get "/", FocusSessionController, :index
    get "/active", FocusSessionController, :active
    post "/", FocusSessionController, :create
    patch "/finish", FocusSessionController, :finish_current
    patch "/pause", FocusSessionController, :pause_current
    patch "/resume", FocusSessionController, :resume_current
    patch "/:id/finish", FocusSessionController, :finish
    patch "/:id/pause", FocusSessionController, :pause
    patch "/:id/resume", FocusSessionController, :resume
  end
end
