use std::collections::HashSet;
use std::sync::Arc;

use super::focus_session::{
    FocusSession, FocusSessionStatus, NewFocusSession, Pause, PauseFocusSession, StartFocusSession,
};
use super::repository::FocusSessionRepository;
use crate::Repositories;
use crate::clock::Clock;
use crate::error::{CoreError, messages};
use crate::tasks::{ACTIVE_TASK_STATUSES, Task, TaskFilter, TaskRepository};

/// The focus session use cases. One public method per API endpoint.
///
/// Cheap to clone: it only holds shared handles to the repositories and the clock.
#[derive(Clone)]
pub struct FocusSessionsService {
    focus_sessions: Arc<dyn FocusSessionRepository>,
    tasks: Arc<dyn TaskRepository>,
    clock: Arc<dyn Clock>,
}

impl FocusSessionsService {
    pub fn new(repositories: Repositories, clock: Arc<dyn Clock>) -> Self {
        Self {
            focus_sessions: repositories.focus_sessions,
            tasks: repositories.tasks,
            clock,
        }
    }

    pub async fn list(&self) -> Result<Vec<FocusSession>, CoreError> {
        self.focus_sessions.find_all().await
    }

    /// The current session as a client should display it, or `None` when there is none.
    pub async fn get_current(&self) -> Result<Option<FocusSession>, CoreError> {
        let session = self.focus_sessions.find_current().await?;
        Ok(session.map(FocusSession::shift_start_time_by_closed_pauses))
    }

    pub async fn start(&self, request: StartFocusSession) -> Result<FocusSession, CoreError> {
        let task_ids = if request.task_ids.is_empty() {
            self.unfinished_task_ids().await?
        } else {
            self.existing_in_request_order(&request.task_ids).await?
        };

        let session = self
            .focus_sessions
            .create(NewFocusSession {
                status: FocusSessionStatus::Active,
                start_time: request.start_time.unwrap_or_else(|| self.clock.now()),
                tasks: task_ids,
                pauses: Vec::new(),
            })
            .await?;
        self.tasks
            .assign_focus_session(&session.tasks, Some(&session.id))
            .await?;
        Ok(session)
    }

    pub async fn finish(&self, id: &str) -> Result<FocusSession, CoreError> {
        let session = self.get(id).await?;
        self.finish_session(session).await
    }

    pub async fn finish_current(&self) -> Result<FocusSession, CoreError> {
        let session = self.current_or_fail().await?;
        self.finish_session(session).await
    }

    pub async fn pause(&self, id: &str) -> Result<FocusSession, CoreError> {
        let session = self
            .focus_sessions
            .find_by_id(id)
            .await?
            .filter(|session| session.status == FocusSessionStatus::Active)
            .ok_or(CoreError::NotFound(messages::CANNOT_PAUSE))?;

        self.save(session.start_pause(Pause::new(self.clock.now(), 0)))
            .await
    }

    /// Pauses the current session. Sending `time` always starts a fresh pause
    /// (closing an open one first); without it, an already paused session stays as is.
    pub async fn pause_current(
        &self,
        request: PauseFocusSession,
    ) -> Result<FocusSession, CoreError> {
        let session = self.current_or_fail().await?;
        if session.open_pause().is_some() && request.time.is_none() {
            return Ok(session);
        }

        let now = self.clock.now();
        let pause = Pause::new(now, request.time.unwrap_or(0));
        self.save(session.close_open_pause(now).start_pause(pause))
            .await
    }

    pub async fn resume(&self, id: &str) -> Result<FocusSession, CoreError> {
        let session = self
            .focus_sessions
            .find_by_id(id)
            .await?
            .filter(|session| session.status == FocusSessionStatus::Paused)
            .ok_or(CoreError::NotFound(messages::CANNOT_RESUME))?;

        self.save(session.resume(self.clock.now())).await
    }

    pub async fn resume_current(&self) -> Result<FocusSession, CoreError> {
        let session = self.current_or_fail().await?;
        if session.open_pause().is_none() {
            return Ok(session);
        }

        self.save(session.resume(self.clock.now())).await
    }

    async fn get(&self, id: &str) -> Result<FocusSession, CoreError> {
        self.focus_sessions
            .find_by_id(id)
            .await?
            .ok_or(CoreError::NotFound(messages::FOCUS_SESSION_NOT_FOUND))
    }

    async fn current_or_fail(&self) -> Result<FocusSession, CoreError> {
        self.focus_sessions
            .find_current()
            .await?
            .ok_or(CoreError::NotFound(messages::NO_CURRENT_FOCUS_SESSION))
    }

    /// Finished sessions let go of their unfinished tasks; completed ones keep the session as history.
    async fn finish_session(&self, session: FocusSession) -> Result<FocusSession, CoreError> {
        let finished_session = self.save(session.finish(self.clock.now())).await?;

        let unfinished_tasks = TaskFilter::default()
            .in_focus_session(&finished_session.id)
            .with_statuses(&ACTIVE_TASK_STATUSES);
        let task_ids = ids(self.tasks.find_many(&unfinished_tasks).await?);
        self.tasks.assign_focus_session(&task_ids, None).await?;
        Ok(finished_session)
    }

    async fn unfinished_task_ids(&self) -> Result<Vec<String>, CoreError> {
        let filter = TaskFilter::default().with_statuses(&ACTIVE_TASK_STATUSES);
        Ok(ids(self.tasks.find_many(&filter).await?))
    }

    /// Unknown and repeated ids are dropped; the rest keep the order they were requested in.
    async fn existing_in_request_order(
        &self,
        task_ids: &[String],
    ) -> Result<Vec<String>, CoreError> {
        let found = self
            .tasks
            .find_many(&TaskFilter::default().with_ids(task_ids.to_vec()))
            .await?;
        let existing: HashSet<String> = ids(found).into_iter().collect();

        let mut seen = HashSet::new();
        Ok(task_ids
            .iter()
            .filter(|id| existing.contains(*id) && seen.insert(*id))
            .cloned()
            .collect())
    }

    async fn save(&self, session: FocusSession) -> Result<FocusSession, CoreError> {
        self.focus_sessions.save(&session).await?;
        Ok(session)
    }
}

fn ids(tasks: Vec<Task>) -> Vec<String> {
    tasks.into_iter().map(|task| task.id).collect()
}
