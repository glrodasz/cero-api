//! The behaviour itself is covered by the core tests and the shared contract
//! suite. These tests cover what is Axum's job: routing, extractors, errors.
//! `oneshot` sends a request straight into the router, without opening a port.

use std::sync::Arc;

use async_trait::async_trait;
use axum::Router;
use axum::body::{self, Body};
use axum::http::{Method, Request, StatusCode, header};
use cero_core::{
    CoreError, FocusSession, FocusSessionRepository, NewFocusSession, Repositories, Services,
    in_memory,
};
use serde_json::{Value, json};
use tower::ServiceExt;

fn app() -> Router {
    rust_axum::app(Services::new(in_memory::repositories()))
}

/// Sends one request, with a JSON body when one is given, and returns the status and the JSON answer.
async fn send(app: &Router, method: Method, uri: &str, body: Option<&str>) -> (StatusCode, Value) {
    let request = Request::builder().method(method).uri(uri);
    let request = match body {
        Some(json) => request
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(json.to_owned())),
        None => request.body(Body::empty()),
    };

    let response = app.clone().oneshot(request.unwrap()).await.unwrap();
    let status = response.status();
    let bytes = body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

fn assert_message(answer: &Value) {
    assert!(
        answer["message"].is_string(),
        "errors have the shape {{ message: string }}, got {answer}"
    );
}

#[tokio::test]
async fn routes_patch_complete_before_patch_status() {
    let app = app();
    let (_, task) = send(
        &app,
        Method::POST,
        "/tasks",
        Some(r#"{ "description": "routing" }"#),
    )
    .await;

    let uri = format!("/tasks/{}/complete", task["id"].as_str().unwrap());
    let (status, completed) = send(&app, Method::PATCH, &uri, None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(completed["status"], "completed");
}

#[tokio::test]
async fn answers_400_for_malformed_json() {
    let (status, answer) = send(&app(), Method::POST, "/tasks", Some("{ nope")).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_message(&answer);
}

#[tokio::test]
async fn answers_400_for_bodies_of_the_wrong_shape() {
    let app = app();
    let (_, task) = send(
        &app,
        Method::POST,
        "/tasks",
        Some(r#"{ "description": "typed" }"#),
    )
    .await;
    let task_uri = format!("/tasks/{}", task["id"].as_str().unwrap());

    for (method, uri, body) in [
        (Method::POST, "/tasks", json!({ "description": 42 })),
        (
            Method::PATCH,
            task_uri.as_str(),
            json!({ "description": null }),
        ),
        (
            Method::PATCH,
            task_uri.as_str(),
            json!({ "status": "done" }),
        ),
        (Method::POST, "/focus-sessions", json!({ "tasks": [1, 2] })),
    ] {
        let (status, answer) = send(&app, method, uri, Some(&body.to_string())).await;

        assert_eq!(status, StatusCode::BAD_REQUEST, "{uri} with {body}");
        assert_message(&answer);
    }
}

#[tokio::test]
async fn accepts_optional_bodies_that_are_left_out() {
    let app = app();

    let (started, _) = send(&app, Method::POST, "/focus-sessions", None).await;
    let (paused, session) = send(&app, Method::PATCH, "/focus-sessions/pause", None).await;

    assert_eq!(started, StatusCode::CREATED);
    assert_eq!(paused, StatusCode::OK);
    assert_eq!(session["pauses"][0]["time"], 0);
}

#[tokio::test]
async fn answers_404_for_unknown_routes_and_methods() {
    let app = app();

    for (method, uri) in [
        (Method::GET, "/nowhere"),
        (Method::GET, "/tasks/some-id/complete"),
    ] {
        let (status, answer) = send(&app, method, uri, None).await;

        assert_eq!(status, StatusCode::NOT_FOUND, "{uri}");
        assert_eq!(answer, json!({ "message": "Not found" }));
    }
}

#[tokio::test]
async fn hides_the_details_of_unexpected_errors() {
    let repositories = Repositories {
        focus_sessions: Arc::new(UnreachableFocusSessions),
        ..in_memory::repositories()
    };
    let app = rust_axum::app(Services::new(repositories));

    let (status, answer) = send(&app, Method::GET, "/tasks", None).await;

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(answer, json!({ "message": "Internal server error" }));
}

/// Focus session storage that is down: every call fails with details clients must not see.
struct UnreachableFocusSessions;

fn outage() -> CoreError {
    CoreError::repository("connection string with a password")
}

#[async_trait]
impl FocusSessionRepository for UnreachableFocusSessions {
    async fn find_all(&self) -> Result<Vec<FocusSession>, CoreError> {
        Err(outage())
    }

    async fn find_by_id(&self, _id: &str) -> Result<Option<FocusSession>, CoreError> {
        Err(outage())
    }

    async fn find_current(&self) -> Result<Option<FocusSession>, CoreError> {
        Err(outage())
    }

    async fn create(&self, _session: NewFocusSession) -> Result<FocusSession, CoreError> {
        Err(outage())
    }

    async fn save(&self, _session: &FocusSession) -> Result<(), CoreError> {
        Err(outage())
    }
}
