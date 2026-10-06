use std::sync::Arc;

use super::repository::{TaskFilter, TaskRepository};
use super::task::{
    ACTIVE_TASK_STATUSES, CreateTask, NewTask, Task, TaskChanges, TaskStatus, renumber,
    status_for_new_task,
};
use crate::Repositories;
use crate::error::{CoreError, messages};
use crate::focus_sessions::FocusSessionRepository;

/// The task use cases. One public method per API endpoint.
///
/// Cheap to clone: it only holds shared handles to the repositories.
#[derive(Clone)]
pub struct TasksService {
    tasks: Arc<dyn TaskRepository>,
    focus_sessions: Arc<dyn FocusSessionRepository>,
}

impl TasksService {
    pub fn new(repositories: Repositories) -> Self {
        Self {
            tasks: repositories.tasks,
            focus_sessions: repositories.focus_sessions,
        }
    }

    /// What the user should be looking at: the current session's tasks, or every unfinished task.
    pub async fn list(&self) -> Result<Vec<Task>, CoreError> {
        let filter = match self.focus_sessions.find_current().await? {
            Some(session) => TaskFilter::default().in_focus_session(&session.id),
            None => TaskFilter::default().with_statuses(&ACTIVE_TASK_STATUSES),
        };
        self.tasks.find_many(&filter).await
    }

    pub async fn get(&self, id: &str) -> Result<Task, CoreError> {
        self.tasks
            .find_by_id(id)
            .await?
            .ok_or(CoreError::NotFound(messages::TASK_NOT_FOUND))
    }

    pub async fn create(&self, CreateTask { description }: CreateTask) -> Result<Task, CoreError> {
        let in_progress_count = self.tasks.count_by_status(TaskStatus::InProgress).await?;
        let current_session = self.focus_sessions.find_current().await?;

        self.tasks
            .create(NewTask {
                description,
                priority: 0,
                status: status_for_new_task(in_progress_count),
                focus_session_id: current_session.map(|session| session.id),
            })
            .await
    }

    pub async fn complete(&self, id: &str) -> Result<Task, CoreError> {
        let task = self.get(id).await?;
        self.move_to_top_of(TaskStatus::Completed, task).await
    }

    pub async fn reset(&self, id: &str) -> Result<Task, CoreError> {
        let task = self.get(id).await?;
        self.move_to_top_of(TaskStatus::Pending, task).await
    }

    /// `status` comes straight from the URL, so it is checked before the task is looked up.
    pub async fn change_status(&self, id: &str, status: &str) -> Result<Task, CoreError> {
        let status: TaskStatus = status
            .parse()
            .map_err(|_| CoreError::Invalid(messages::INVALID_TASK_STATUS.into()))?;

        let task = Task {
            status,
            ..self.get(id).await?
        };
        self.tasks.save(&task).await?;
        Ok(task)
    }

    pub async fn update(&self, id: &str, changes: TaskChanges) -> Result<Task, CoreError> {
        self.validate_changes(&changes).await?;
        let task = self.get(id).await?;

        let updated_task = Task {
            id: task.id,
            description: changes.description.unwrap_or(task.description),
            priority: changes.priority.unwrap_or(task.priority),
            status: changes.status.unwrap_or(task.status),
            focus_session_id: changes.focus_session_id.unwrap_or(task.focus_session_id),
        };
        self.tasks.save(&updated_task).await?;
        Ok(updated_task)
    }

    pub async fn delete(&self, id: &str) -> Result<Task, CoreError> {
        let task = self.get(id).await?;
        self.tasks.delete(&task.id).await?;
        Ok(task)
    }

    /// The task becomes priority 0 of the group; the rest of the group follows as 1..n.
    async fn move_to_top_of(&self, status: TaskStatus, task: Task) -> Result<Task, CoreError> {
        let group = self
            .tasks
            .find_many(&TaskFilter::default().with_statuses(&[status]))
            .await?;
        let rest = group
            .into_iter()
            .filter(|member| member.id != task.id)
            .collect();

        for member in renumber(rest) {
            self.tasks.save(&member).await?;
        }
        let moved_task = Task {
            status,
            priority: 0,
            ..task
        };
        self.tasks.save(&moved_task).await?;
        Ok(moved_task)
    }

    /// The status is already valid (its type guarantees it); the session must exist.
    async fn validate_changes(&self, changes: &TaskChanges) -> Result<(), CoreError> {
        if let Some(Some(session_id)) = &changes.focus_session_id
            && self.focus_sessions.find_by_id(session_id).await?.is_none()
        {
            return Err(CoreError::Invalid(messages::UNKNOWN_FOCUS_SESSION.into()));
        }
        Ok(())
    }
}
