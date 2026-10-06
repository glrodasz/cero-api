//! `/tasks`: one handler per use case.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, patch};
use axum::{Json, Router};
use cero_core::{CreateTask, Task, TaskChanges, TasksService};

use crate::http::{ApiError, JsonBody};

/// The `/tasks` routes, with the one service they need as their state.
pub fn routes(tasks: TasksService) -> Router {
    Router::new()
        .route("/", get(list_tasks).post(create_task))
        .route(
            "/{id}",
            get(get_task).patch(update_task).delete(delete_task),
        )
        // Axum's router prefers fixed segments, so these two win over "/{id}/{status}".
        .route("/{id}/complete", patch(complete_task))
        .route("/{id}/reset", patch(reset_task))
        .route("/{id}/{status}", patch(change_task_status))
        .with_state(tasks)
}

async fn list_tasks(State(tasks): State<TasksService>) -> Result<Json<Vec<Task>>, ApiError> {
    Ok(Json(tasks.list().await?))
}

async fn get_task(
    State(tasks): State<TasksService>,
    Path(id): Path<String>,
) -> Result<Json<Task>, ApiError> {
    Ok(Json(tasks.get(&id).await?))
}

async fn create_task(
    State(tasks): State<TasksService>,
    JsonBody(request): JsonBody<CreateTask>,
) -> Result<(StatusCode, Json<Task>), ApiError> {
    Ok((StatusCode::CREATED, Json(tasks.create(request).await?)))
}

async fn complete_task(
    State(tasks): State<TasksService>,
    Path(id): Path<String>,
) -> Result<Json<Task>, ApiError> {
    Ok(Json(tasks.complete(&id).await?))
}

async fn reset_task(
    State(tasks): State<TasksService>,
    Path(id): Path<String>,
) -> Result<Json<Task>, ApiError> {
    Ok(Json(tasks.reset(&id).await?))
}

async fn change_task_status(
    State(tasks): State<TasksService>,
    Path((id, status)): Path<(String, String)>,
) -> Result<Json<Task>, ApiError> {
    Ok(Json(tasks.change_status(&id, &status).await?))
}

async fn update_task(
    State(tasks): State<TasksService>,
    Path(id): Path<String>,
    JsonBody(changes): JsonBody<TaskChanges>,
) -> Result<Json<Task>, ApiError> {
    Ok(Json(tasks.update(&id, changes).await?))
}

async fn delete_task(
    State(tasks): State<TasksService>,
    Path(id): Path<String>,
) -> Result<Json<Task>, ApiError> {
    Ok(Json(tasks.delete(&id).await?))
}
