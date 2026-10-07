use std::error::Error;

/// The ways a use case can fail. Transports translate them: REST answers
/// 404 / 400 / 500, GraphQL sets `extensions.code`.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    /// The resource does not exist, or is not in a state that allows the action.
    #[error("{0}")]
    NotFound(&'static str),

    /// The request breaks a rule. The core's messages are canonical; a
    /// transport may add its own (a body that does not parse, for example).
    #[error("{0}")]
    Invalid(String),

    /// Storage failed. The details are for the logs, never for clients.
    #[error("repository failed: {0}")]
    Repository(Box<dyn Error + Send + Sync>),
}

impl CoreError {
    /// Wraps a storage failure. Adapters call it as `.map_err(CoreError::repository)`,
    /// since the orphan rule keeps them from writing `From<sqlx::Error> for CoreError`.
    pub fn repository(error: impl Into<Box<dyn Error + Send + Sync>>) -> Self {
        Self::Repository(error.into())
    }
}

/// A status name that matches no status (see `TaskStatus` and `FocusSessionStatus`).
#[derive(Debug, thiserror::Error)]
#[error("unknown status {0:?}")]
pub struct UnknownStatus(pub String);

/// Canonical messages, identical in every implementation of the API.
pub mod messages {
    pub const TASK_NOT_FOUND: &str = "Task not found";
    pub const FOCUS_SESSION_NOT_FOUND: &str = "Focus session not found";
    pub const NO_CURRENT_FOCUS_SESSION: &str = "No active focus session found";
    pub const CANNOT_PAUSE: &str = "Focus session not found or cannot be paused";
    pub const CANNOT_RESUME: &str = "Focus session not found or cannot be resumed";
    pub const INVALID_TASK_STATUS: &str = "Invalid task status";
    pub const UNKNOWN_FOCUS_SESSION: &str = "focusSessionId does not match any focus session";
    pub const ROUTE_NOT_FOUND: &str = "Not found";
    pub const INTERNAL_ERROR: &str = "Internal server error";
}
