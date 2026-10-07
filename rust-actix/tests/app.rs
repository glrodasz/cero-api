//! The behaviour itself is covered by the core tests and the shared contract
//! suite. These tests cover what is Actix's job: routing, extractors, errors.
//! `actix_web::test` sends requests straight into the app, without opening a port.

use std::sync::Arc;

use actix_web::dev::{Service, ServiceResponse};
use actix_web::http::StatusCode;
use actix_web::http::header::ContentType;
use actix_web::test::{self, TestRequest};
use actix_web::{App, Error};
use async_trait::async_trait;
use cero_core::{
    CoreError, FocusSession, FocusSessionRepository, NewFocusSession, Repositories, Services,
    in_memory,
};
use serde_json::{Value, json};

async fn app(
    repositories: Repositories,
) -> impl Service<actix_http::Request, Response = ServiceResponse, Error = Error> {
    let services = Services::new(repositories);
    test::init_service(App::new().configure(rust_actix::configure(services))).await
}

/// Sends one request and returns the status and the JSON answer.
async fn send(
    app: &impl Service<actix_http::Request, Response = ServiceResponse, Error = Error>,
    request: TestRequest,
) -> (StatusCode, Value) {
    let response = test::call_service(app, request.to_request()).await;
    let status = response.status();
    (status, test::read_body_json(response).await)
}

fn assert_message(answer: &Value) {
    assert!(
        answer["message"].is_string(),
        "errors have the shape {{ message: string }}, got {answer}"
    );
}

#[actix_web::test]
async fn routes_patch_complete_before_patch_status() {
    let app = app(in_memory::repositories()).await;
    let create = TestRequest::post()
        .uri("/tasks")
        .set_json(json!({ "description": "routing" }));
    let (_, task) = send(&app, create).await;

    let uri = format!("/tasks/{}/complete", task["id"].as_str().unwrap());
    let (status, completed) = send(&app, TestRequest::patch().uri(&uri)).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(completed["status"], "completed");
}

#[actix_web::test]
async fn answers_400_for_malformed_json() {
    let app = app(in_memory::repositories()).await;
    let request = TestRequest::post()
        .uri("/tasks")
        .insert_header(ContentType::json())
        .set_payload("{ nope");

    let (status, answer) = send(&app, request).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_message(&answer);
}

#[actix_web::test]
async fn answers_400_for_bodies_of_the_wrong_shape() {
    let app = app(in_memory::repositories()).await;
    let create = TestRequest::post()
        .uri("/tasks")
        .set_json(json!({ "description": "typed" }));
    let (_, task) = send(&app, create).await;
    let task_uri = format!("/tasks/{}", task["id"].as_str().unwrap());

    for (request, body) in [
        (
            TestRequest::post().uri("/tasks"),
            json!({ "description": 42 }),
        ),
        (
            TestRequest::patch().uri(&task_uri),
            json!({ "description": null }),
        ),
        (
            TestRequest::patch().uri(&task_uri),
            json!({ "status": "done" }),
        ),
        (
            TestRequest::post().uri("/focus-sessions"),
            json!({ "tasks": [1, 2] }),
        ),
    ] {
        let (status, answer) = send(&app, request.set_json(&body)).await;

        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
        assert_message(&answer);
    }
}

#[actix_web::test]
async fn accepts_optional_bodies_that_are_left_out() {
    let app = app(in_memory::repositories()).await;

    let (started, _) = send(&app, TestRequest::post().uri("/focus-sessions")).await;
    let (paused, session) = send(&app, TestRequest::patch().uri("/focus-sessions/pause")).await;

    assert_eq!(started, StatusCode::CREATED);
    assert_eq!(paused, StatusCode::OK);
    assert_eq!(session["pauses"][0]["time"], 0);
}

#[actix_web::test]
async fn answers_404_for_unknown_routes_and_methods() {
    let app = app(in_memory::repositories()).await;

    for uri in ["/nowhere", "/tasks/some-id/complete"] {
        let (status, answer) = send(&app, TestRequest::get().uri(uri)).await;

        assert_eq!(status, StatusCode::NOT_FOUND, "{uri}");
        assert_eq!(answer, json!({ "message": "Not found" }));
    }
}

#[actix_web::test]
async fn hides_the_details_of_unexpected_errors() {
    let repositories = Repositories {
        focus_sessions: Arc::new(UnreachableFocusSessions),
        ..in_memory::repositories()
    };
    let app = app(repositories).await;

    let (status, answer) = send(&app, TestRequest::get().uri("/tasks")).await;

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
