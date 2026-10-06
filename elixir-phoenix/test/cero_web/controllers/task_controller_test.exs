defmodule CeroWeb.TaskControllerTest do
  use CeroWeb.ConnCase, async: true

  import Cero.TasksFixtures

  # The rules are covered by the context tests and the shared contract suite.
  # These tests cover Phoenix's part: routing, params, status codes, JSON.

  @missing_id "00000000-0000-4000-8000-000000000000"

  test "creates a task with 201 and renders it in the contract's shape", %{conn: conn} do
    conn = post(conn, ~p"/tasks", %{"description" => "write tests"})

    assert %{
             "id" => id,
             "description" => "write tests",
             "priority" => 0,
             "status" => "in-progress",
             "focusSessionId" => nil
           } = json_response(conn, 201)

    assert [%{"id" => ^id}] = json_response(get(build_conn(), ~p"/tasks"), 200)
  end

  test "routes PATCH /tasks/:id/complete before PATCH /tasks/:id/:status", %{conn: conn} do
    task = task_fixture()

    assert %{"status" => "completed"} =
             json_response(patch(conn, ~p"/tasks/#{task.id}/complete"), 200)
  end

  test "sets the status named in the path", %{conn: conn} do
    task = task_fixture()

    assert %{"status" => "pending"} =
             json_response(patch(conn, ~p"/tasks/#{task.id}/pending"), 200)
  end

  test "refuses an unknown status, even for an unknown task", %{conn: conn} do
    assert %{"message" => "status is invalid"} =
             json_response(patch(conn, ~p"/tasks/#{@missing_id}/done"), 400)
  end

  test "answers 404 with the canonical message for unknown and malformed ids", %{conn: conn} do
    for path <- [~p"/tasks/#{@missing_id}", ~p"/tasks/not-a-valid-id"] do
      assert json_response(get(conn, path), 404) == %{"message" => "Task not found"}
    end
  end

  test "refuses a task without a string description", %{conn: conn} do
    for body <- [%{}, %{"description" => 42}, %{"description" => nil}] do
      assert %{"message" => _} = json_response(post(conn, ~p"/tasks", body), 400)
    end
  end

  test "refuses changes of the wrong type", %{conn: conn} do
    task = task_fixture()

    for body <- [%{"priority" => "high"}, %{"status" => "done"}, %{"description" => nil}] do
      assert %{"message" => _} = json_response(patch(conn, ~p"/tasks/#{task.id}", body), 400)
    end
  end

  test "names fields as the API does in validation messages", %{conn: conn} do
    task = task_fixture()
    conn = patch(conn, ~p"/tasks/#{task.id}", %{"focusSessionId" => @missing_id})

    assert json_response(conn, 400) == %{
             "message" => "focusSessionId does not match any focus session"
           }
  end

  test "ignores an id and unknown fields in the body of an update", %{conn: conn} do
    task = task_fixture("keeps its id")
    body = %{"id" => @missing_id, "priority" => 3, "focus_session_id" => @missing_id}

    assert json_response(patch(conn, ~p"/tasks/#{task.id}", body), 200) == %{
             "id" => task.id,
             "description" => "keeps its id",
             "priority" => 3,
             "status" => "in-progress",
             "focusSessionId" => nil
           }
  end

  test "deletes a task and returns it", %{conn: conn} do
    task = task_fixture()

    assert %{"id" => id} = json_response(delete(conn, ~p"/tasks/#{task.id}"), 200)
    assert id == task.id
    assert json_response(get(build_conn(), ~p"/tasks/#{id}"), 404)
  end
end
