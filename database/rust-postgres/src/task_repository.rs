use async_trait::async_trait;
use cero_core::{CoreError, NewTask, Task, TaskFilter, TaskRepository, TaskStatus};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{parse_id, parse_reference};

/// A row of the `tasks` table, as sqlx reads it.
#[derive(FromRow)]
struct TaskRow {
    id: Uuid,
    description: String,
    priority: i32,
    status: String,
    focus_session_id: Option<Uuid>,
}

impl TryFrom<TaskRow> for Task {
    type Error = CoreError;

    fn try_from(row: TaskRow) -> Result<Self, Self::Error> {
        Ok(Task {
            id: row.id.to_string(),
            description: row.description,
            priority: row.priority,
            status: row.status.parse().map_err(CoreError::repository)?,
            focus_session_id: row.focus_session_id.map(|id| id.to_string()),
        })
    }
}

/// [`TaskRepository`] over the `tasks` table.
pub struct PostgresTaskRepository {
    pool: PgPool,
}

impl PostgresTaskRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TaskRepository for PostgresTaskRepository {
    async fn find_by_id(&self, id: &str) -> Result<Option<Task>, CoreError> {
        let Some(id) = parse_id(id) else {
            return Ok(None);
        };

        let row: Option<TaskRow> = sqlx::query_as(
            "SELECT id, description, priority, status, focus_session_id FROM tasks WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(CoreError::repository)?;
        row.map(Task::try_from).transpose()
    }

    async fn find_many(&self, filter: &TaskFilter) -> Result<Vec<Task>, CoreError> {
        let ids: Option<Vec<Uuid>> = filter
            .ids
            .as_ref()
            .map(|ids| ids.iter().filter_map(|id| parse_id(id)).collect());
        let statuses: Option<Vec<&str>> = filter
            .statuses
            .as_ref()
            .map(|statuses| statuses.iter().map(|status| status.as_str()).collect());
        let focus_session_id = match filter.focus_session_id.as_deref().map(parse_id) {
            Some(None) => return Ok(Vec::new()), // a malformed session id matches no task
            parsed => parsed.flatten(),
        };

        // A criterion bound to NULL is left out, so one statement serves every filter.
        let rows: Vec<TaskRow> = sqlx::query_as(
            "SELECT id, description, priority, status, focus_session_id FROM tasks
             WHERE ($1::uuid[] IS NULL OR id = ANY($1))
               AND ($2::text[] IS NULL OR status = ANY($2))
               AND ($3::uuid IS NULL OR focus_session_id = $3)
             ORDER BY priority, created_at",
        )
        .bind(ids)
        .bind(statuses)
        .bind(focus_session_id)
        .fetch_all(&self.pool)
        .await
        .map_err(CoreError::repository)?;
        rows.into_iter().map(Task::try_from).collect()
    }

    async fn count_by_status(&self, status: TaskStatus) -> Result<usize, CoreError> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tasks WHERE status = $1")
            .bind(status.as_str())
            .fetch_one(&self.pool)
            .await
            .map_err(CoreError::repository)?;
        usize::try_from(count).map_err(CoreError::repository)
    }

    async fn create(&self, task: NewTask) -> Result<Task, CoreError> {
        let focus_session_id = task
            .focus_session_id
            .as_deref()
            .map(parse_reference)
            .transpose()?;

        let row: TaskRow = sqlx::query_as(
            "INSERT INTO tasks (description, priority, status, focus_session_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, description, priority, status, focus_session_id",
        )
        .bind(task.description)
        .bind(task.priority)
        .bind(task.status.as_str())
        .bind(focus_session_id)
        .fetch_one(&self.pool)
        .await
        .map_err(CoreError::repository)?;
        row.try_into()
    }

    async fn save(&self, task: &Task) -> Result<(), CoreError> {
        let Some(id) = parse_id(&task.id) else {
            return Ok(());
        };
        let focus_session_id = task
            .focus_session_id
            .as_deref()
            .map(parse_reference)
            .transpose()?;

        sqlx::query(
            "UPDATE tasks SET description = $2, priority = $3, status = $4, focus_session_id = $5
             WHERE id = $1",
        )
        .bind(id)
        .bind(&task.description)
        .bind(task.priority)
        .bind(task.status.as_str())
        .bind(focus_session_id)
        .execute(&self.pool)
        .await
        .map_err(CoreError::repository)?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), CoreError> {
        let Some(id) = parse_id(id) else {
            return Ok(());
        };

        sqlx::query("DELETE FROM tasks WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(CoreError::repository)?;
        Ok(())
    }

    async fn assign_focus_session(
        &self,
        task_ids: &[String],
        focus_session_id: Option<&str>,
    ) -> Result<(), CoreError> {
        let ids: Vec<Uuid> = task_ids.iter().filter_map(|id| parse_id(id)).collect();
        if ids.is_empty() {
            return Ok(());
        }
        let focus_session_id = focus_session_id.map(parse_reference).transpose()?;

        sqlx::query("UPDATE tasks SET focus_session_id = $2 WHERE id = ANY($1)")
            .bind(ids)
            .bind(focus_session_id)
            .execute(&self.pool)
            .await
            .map_err(CoreError::repository)?;
        Ok(())
    }
}
