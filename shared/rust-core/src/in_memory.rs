//! Storage adapters that keep everything in memory. They back the unit tests
//! and let any app run without a database (`STORAGE=memory`).
//!
//! A `Vec` keeps insertion order, which doubles as creation order. Values are
//! cloned on the way in and out, so callers can never change stored state.

use std::sync::{Arc, Mutex, MutexGuard};

use async_trait::async_trait;
use uuid::Uuid;

use crate::Repositories;
use crate::error::CoreError;
use crate::focus_sessions::{
    CURRENT_SESSION_STATUSES, FocusSession, FocusSessionRepository, NewFocusSession,
};
use crate::tasks::{NewTask, Task, TaskFilter, TaskRepository, TaskStatus};

/// Repositories over empty in-memory storage.
pub fn repositories() -> Repositories {
    Repositories {
        tasks: Arc::new(InMemoryTaskRepository::default()),
        focus_sessions: Arc::new(InMemoryFocusSessionRepository::default()),
    }
}

/// [`TaskRepository`] over a `Vec`.
#[derive(Debug, Default)]
pub struct InMemoryTaskRepository {
    tasks: Mutex<Vec<Task>>,
}

impl InMemoryTaskRepository {
    // A std `Mutex` is enough: every method locks in synchronous code and
    // releases the lock before returning, never holding it across an `.await`.
    fn tasks(&self) -> MutexGuard<'_, Vec<Task>> {
        self.tasks
            .lock()
            .expect("no thread panics while holding the lock")
    }
}

fn matches(filter: &TaskFilter, task: &Task) -> bool {
    filter.ids.as_ref().is_none_or(|ids| ids.contains(&task.id))
        && filter
            .statuses
            .as_ref()
            .is_none_or(|statuses| statuses.contains(&task.status))
        && filter
            .focus_session_id
            .as_ref()
            .is_none_or(|id| task.focus_session_id.as_ref() == Some(id))
}

#[async_trait]
impl TaskRepository for InMemoryTaskRepository {
    async fn find_by_id(&self, id: &str) -> Result<Option<Task>, CoreError> {
        Ok(self.tasks().iter().find(|task| task.id == id).cloned())
    }

    async fn find_many(&self, filter: &TaskFilter) -> Result<Vec<Task>, CoreError> {
        let mut tasks: Vec<Task> = self
            .tasks()
            .iter()
            .filter(|task| matches(filter, task))
            .cloned()
            .collect();
        tasks.sort_by_key(|task| task.priority); // stable: ties keep creation order
        Ok(tasks)
    }

    async fn count_by_status(&self, status: TaskStatus) -> Result<usize, CoreError> {
        Ok(self
            .tasks()
            .iter()
            .filter(|task| task.status == status)
            .count())
    }

    async fn create(&self, task: NewTask) -> Result<Task, CoreError> {
        let task = Task {
            id: Uuid::new_v4().to_string(),
            description: task.description,
            priority: task.priority,
            status: task.status,
            focus_session_id: task.focus_session_id,
        };
        self.tasks().push(task.clone());
        Ok(task)
    }

    async fn save(&self, task: &Task) -> Result<(), CoreError> {
        if let Some(stored) = self.tasks().iter_mut().find(|stored| stored.id == task.id) {
            *stored = task.clone();
        }
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), CoreError> {
        self.tasks().retain(|task| task.id != id);
        Ok(())
    }

    async fn assign_focus_session(
        &self,
        task_ids: &[String],
        focus_session_id: Option<&str>,
    ) -> Result<(), CoreError> {
        for task in self
            .tasks()
            .iter_mut()
            .filter(|task| task_ids.contains(&task.id))
        {
            task.focus_session_id = focus_session_id.map(str::to_owned);
        }
        Ok(())
    }
}

/// [`FocusSessionRepository`] over a `Vec`.
#[derive(Debug, Default)]
pub struct InMemoryFocusSessionRepository {
    sessions: Mutex<Vec<FocusSession>>,
}

impl InMemoryFocusSessionRepository {
    fn sessions(&self) -> MutexGuard<'_, Vec<FocusSession>> {
        self.sessions
            .lock()
            .expect("no thread panics while holding the lock")
    }
}

#[async_trait]
impl FocusSessionRepository for InMemoryFocusSessionRepository {
    async fn find_all(&self) -> Result<Vec<FocusSession>, CoreError> {
        Ok(self.sessions().clone())
    }

    async fn find_by_id(&self, id: &str) -> Result<Option<FocusSession>, CoreError> {
        Ok(self
            .sessions()
            .iter()
            .find(|session| session.id == id)
            .cloned())
    }

    async fn find_current(&self) -> Result<Option<FocusSession>, CoreError> {
        let sessions = self.sessions();
        let mut newest_first = sessions.iter().rev();
        Ok(newest_first
            .find(|session| CURRENT_SESSION_STATUSES.contains(&session.status))
            .cloned())
    }

    async fn create(&self, session: NewFocusSession) -> Result<FocusSession, CoreError> {
        let session = FocusSession {
            id: Uuid::new_v4().to_string(),
            status: session.status,
            start_time: session.start_time,
            tasks: session.tasks,
            pauses: session.pauses,
        };
        self.sessions().push(session.clone());
        Ok(session)
    }

    async fn save(&self, session: &FocusSession) -> Result<(), CoreError> {
        if let Some(stored) = self
            .sessions()
            .iter_mut()
            .find(|stored| stored.id == session.id)
        {
            *stored = session.clone();
        }
        Ok(())
    }
}
