defmodule CeroWeb.ChangesetJSON do
  @doc """
  Renders an invalid changeset as one readable message, naming fields as the
  API does: `{"message": "priority is invalid; description can't be null"}`.
  """
  def error(%{changeset: changeset}) do
    message =
      changeset
      |> Ecto.Changeset.traverse_errors(&translate_error/1)
      |> Enum.map_join("; ", fn {field, messages} ->
        "#{Phoenix.Naming.camelize(to_string(field), :lower)} #{Enum.join(messages, ", ")}"
      end)

    %{message: message}
  end

  defp translate_error({message, opts}) do
    Enum.reduce(opts, message, fn {key, value}, acc ->
      String.replace(acc, "%{#{key}}", fn _ -> to_string(value) end)
    end)
  end
end
