//! `/tasks`: one handler per use case.

use actix_web::{HttpResponse, web};
use cero_core::{CreateTask, TaskChanges, TasksService};

use crate::http::ApiError;

/// Registers the `/tasks` routes. The service comes from the app data (`web::Data`).
pub fn routes(config: &mut web::ServiceConfig) {
    config
        .route("", web::get().to(list_tasks))
        .route("", web::post().to(create_task))
        .route("/{id}", web::get().to(get_task))
        // Actix tries routes in the order they are registered, so these two
        // must come before "/{id}/{status}", which would capture them.
        .route("/{id}/complete", web::patch().to(complete_task))
        .route("/{id}/reset", web::patch().to(reset_task))
        .route("/{id}/{status}", web::patch().to(change_task_status))
        .route("/{id}", web::patch().to(update_task))
        .route("/{id}", web::delete().to(delete_task));
}

async fn list_tasks(tasks: web::Data<TasksService>) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(tasks.list().await?))
}

async fn get_task(
    tasks: web::Data<TasksService>,
    id: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(tasks.get(&id).await?))
}

async fn create_task(
    tasks: web::Data<TasksService>,
    request: web::Json<CreateTask>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Created().json(tasks.create(request.into_inner()).await?))
}

async fn complete_task(
    tasks: web::Data<TasksService>,
    id: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(tasks.complete(&id).await?))
}

async fn reset_task(
    tasks: web::Data<TasksService>,
    id: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(tasks.reset(&id).await?))
}

async fn change_task_status(
    tasks: web::Data<TasksService>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (id, status) = path.into_inner();
    Ok(HttpResponse::Ok().json(tasks.change_status(&id, &status).await?))
}

async fn update_task(
    tasks: web::Data<TasksService>,
    id: web::Path<String>,
    changes: web::Json<TaskChanges>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(tasks.update(&id, changes.into_inner()).await?))
}

async fn delete_task(
    tasks: web::Data<TasksService>,
    id: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(tasks.delete(&id).await?))
}
