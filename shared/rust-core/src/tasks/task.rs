use std::str::FromStr;

use serde::{Deserialize, Serialize};

use crate::error::UnknownStatus;
use crate::serde_fields::present;

/// The group a task belongs to. Priorities are numbered within each group.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskStatus {
    InProgress,
    Pending,
    Completed,
}

impl TaskStatus {
    const ALL: [TaskStatus; 3] = [Self::InProgress, Self::Pending, Self::Completed];

    /// The name used in JSON, URLs and storage.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::InProgress => "in-progress",
            Self::Pending => "pending",
            Self::Completed => "completed",
        }
    }
}

impl FromStr for TaskStatus {
    type Err = UnknownStatus;

    fn from_str(name: &str) -> Result<Self, Self::Err> {
        Self::ALL
            .into_iter()
            .find(|status| status.as_str() == name)
            .ok_or_else(|| UnknownStatus(name.to_owned()))
    }
}

/// Tasks that still need work.
pub const ACTIVE_TASK_STATUSES: [TaskStatus; 2] = [TaskStatus::InProgress, TaskStatus::Pending];

/// Focus rule: a new task only starts in progress while fewer than this many are.
pub const MAX_IN_PROGRESS_TASKS: usize = 3;

/// Something to do, in a status group and, while it is worked on, in a focus session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub description: String,
    /// 0 is the top of its status group.
    pub priority: i32,
    pub status: TaskStatus,
    /// The session the task is being worked on in.
    pub focus_session_id: Option<String>,
}

/// A task as handed to storage, which assigns the id.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewTask {
    pub description: String,
    pub priority: i32,
    pub status: TaskStatus,
    pub focus_session_id: Option<String>,
}

/// What a client sends to create a task (`POST /tasks`).
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTask {
    pub description: String,
}

/// A partial update (`PATCH /tasks/:id`): `None` leaves a field as it is.
///
/// Unknown fields, `id` included, are ignored. `null` is refused for every
/// field except `focusSessionId`, where it detaches the task from its session.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskChanges {
    #[serde(default, deserialize_with = "present")]
    pub description: Option<String>,
    #[serde(default, deserialize_with = "present")]
    pub priority: Option<i32>,
    #[serde(default, deserialize_with = "present")]
    pub status: Option<TaskStatus>,
    /// `None`: unchanged. `Some(None)`: detach. `Some(Some(id))`: move to that session.
    #[serde(default, deserialize_with = "present")]
    pub focus_session_id: Option<Option<String>>,
}

/// New tasks start in progress until the focus rule says enough are.
pub fn status_for_new_task(in_progress_count: usize) -> TaskStatus {
    if in_progress_count < MAX_IN_PROGRESS_TASKS {
        TaskStatus::InProgress
    } else {
        TaskStatus::Pending
    }
}

/// Gives the tasks consecutive priorities 1..n, keeping their order.
pub fn renumber(tasks: Vec<Task>) -> Vec<Task> {
    tasks
        .into_iter()
        .zip(1..)
        .map(|(task, priority)| Task { priority, ..task })
        .collect()
}
