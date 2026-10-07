use async_trait::async_trait;

use super::task::{NewTask, Task, TaskStatus};
use crate::error::CoreError;

/// Every given criterion must match. The default, empty filter matches every task.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TaskFilter {
    pub ids: Option<Vec<String>>,
    pub statuses: Option<Vec<TaskStatus>>,
    pub focus_session_id: Option<String>,
}

impl TaskFilter {
    pub fn with_ids(self, ids: Vec<String>) -> Self {
        Self {
            ids: Some(ids),
            ..self
        }
    }

    pub fn with_statuses(self, statuses: &[TaskStatus]) -> Self {
        Self {
            statuses: Some(statuses.to_vec()),
            ..self
        }
    }

    pub fn in_focus_session(self, focus_session_id: &str) -> Self {
        Self {
            focus_session_id: Some(focus_session_id.to_owned()),
            ..self
        }
    }
}

/// The storage port for tasks. Adapters live in `database/` (Postgres) and in
/// [`crate::in_memory`]. See [`crate::Repositories`] for why it uses `#[async_trait]`.
///
/// Contract every adapter honours:
/// - a malformed id is simply "not found", it never fails;
/// - lists are sorted by priority, then creation order.
#[async_trait]
pub trait TaskRepository: Send + Sync {
    async fn find_by_id(&self, id: &str) -> Result<Option<Task>, CoreError>;

    async fn find_many(&self, filter: &TaskFilter) -> Result<Vec<Task>, CoreError>;

    async fn count_by_status(&self, status: TaskStatus) -> Result<usize, CoreError>;

    /// Storage assigns the id.
    async fn create(&self, task: NewTask) -> Result<Task, CoreError>;

    /// Overwrites the stored task with the same id.
    async fn save(&self, task: &Task) -> Result<(), CoreError>;

    async fn delete(&self, id: &str) -> Result<(), CoreError>;

    async fn assign_focus_session(
        &self,
        task_ids: &[String],
        focus_session_id: Option<&str>,
    ) -> Result<(), CoreError>;
}
