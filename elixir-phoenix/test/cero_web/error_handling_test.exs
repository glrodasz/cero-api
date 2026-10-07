defmodule CeroWeb.ErrorHandlingTest do
  # Not async: one test drops a table inside its sandbox transaction.
  use CeroWeb.ConnCase

  test "answers 404 for unknown routes", %{conn: conn} do
    assert json_response(get(conn, "/no-such-route"), 404) == %{"message" => "Not found"}
  end

  test "answers 400 for a body that is not JSON", %{conn: conn} do
    conn =
      conn
      |> put_req_header("content-type", "application/json")
      |> post(~p"/tasks", "{ not json")

    assert json_response(conn, 400) == %{"message" => "The request body is not valid JSON"}
  end

  # Phoenix renders a crash through CeroWeb.ErrorJSON, then re-raises it;
  # assert_error_sent/2 checks what the client received.
  @tag :capture_log
  test "hides the details of unexpected errors", %{conn: conn} do
    # Rolled back with the rest of the test's transaction.
    Cero.Repo.query!("DROP TABLE tasks")

    assert {500, _headers, body} = assert_error_sent(500, fn -> get(conn, ~p"/tasks") end)
    assert Jason.decode!(body) == %{"message" => "Internal server error"}
  end
end
