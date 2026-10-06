//! The domain and use cases of the Cero API, shared by every Rust implementation.
//! No framework, no database: plain types, traits and functions.
//!
//! ```
//! use cero_core::{CreateTask, Services, TaskStatus, in_memory};
//!
//! # #[tokio::main(flavor = "current_thread")]
//! # async fn main() -> Result<(), cero_core::CoreError> {
//! let services = Services::new(in_memory::repositories());
//! let task = services.tasks.create(CreateTask { description: "Write the README".into() }).await?;
//! assert_eq!(task.status, TaskStatus::InProgress);
//! # Ok(())
//! # }
//! ```

use std::sync::Arc;

mod clock;
mod error;
pub mod focus_sessions;
pub mod in_memory;
mod serde_fields;
pub mod tasks;
#[cfg(feature = "testing")]
pub mod testing;

pub use clock::{Clock, SystemClock};
pub use error::{CoreError, UnknownStatus, messages};
pub use focus_sessions::{
    FocusSession, FocusSessionRepository, FocusSessionStatus, FocusSessionsService,
    NewFocusSession, Pause, PauseFocusSession, StartFocusSession,
};
pub use tasks::{
    CreateTask, NewTask, Task, TaskChanges, TaskFilter, TaskRepository, TaskStatus, TasksService,
};

/// What a storage adapter provides: one repository per aggregate.
///
/// The repositories are trait objects (`Arc<dyn …>`), and their traits use
/// `#[async_trait]`. Rust's native `async fn` in traits cannot be called
/// through `dyn`, so without the macro the services would have to be generic
/// over their storage (`TasksService<T: TaskRepository>`), and that generic
/// parameter would spread into every Axum and Actix handler and their shared
/// state. Boxing each call's future (what `#[async_trait]` does) costs one
/// allocation per call, which is nothing next to a database round trip.
#[derive(Clone)]
pub struct Repositories {
    pub tasks: Arc<dyn TaskRepository>,
    pub focus_sessions: Arc<dyn FocusSessionRepository>,
}

/// The use cases, ready to be handed to a transport. Cheap to clone.
#[derive(Clone)]
pub struct Services {
    pub tasks: TasksService,
    pub focus_sessions: FocusSessionsService,
}

impl Services {
    /// The composition root of the core: plug in any storage, get the use cases.
    pub fn new(repositories: Repositories) -> Self {
        Self::with_clock(repositories, Arc::new(SystemClock))
    }

    /// Like [`Services::new`], telling time with the given clock (tests use a manual one).
    pub fn with_clock(repositories: Repositories, clock: Arc<dyn Clock>) -> Self {
        Self {
            tasks: TasksService::new(repositories.clone()),
            focus_sessions: FocusSessionsService::new(repositories, clock),
        }
    }
}
