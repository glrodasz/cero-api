defmodule CeroWeb.Params do
  @moduledoc """
  Bridges the API's camelCase JSON fields and the snake_case fields the
  contexts take.
  """

  @doc """
  Keeps the API fields present in `params`, renamed for the context. Anything
  else in the body, such as an `id` or an unknown field, is dropped.

      iex> CeroWeb.Params.take(%{"focusSessionId" => nil, "id" => "x"}, %{"focusSessionId" => :focus_session_id})
      %{focus_session_id: nil}

  """
  @spec take(map(), %{String.t() => atom()}) :: map()
  def take(params, fields) do
    for {api_field, field} <- fields, Map.has_key?(params, api_field), into: %{} do
      {field, Map.fetch!(params, api_field)}
    end
  end
end
