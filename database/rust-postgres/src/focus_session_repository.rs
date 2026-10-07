use async_trait::async_trait;
use cero_core::{CoreError, FocusSession, FocusSessionRepository, NewFocusSession, Pause};
use sqlx::types::Json;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{parse_id, parse_reference};

/// A row of the `focus_sessions` table. Pauses are a `jsonb` array, which sqlx
/// reads and writes through serde with the `Json` wrapper.
#[derive(FromRow)]
struct FocusSessionRow {
    id: Uuid,
    status: String,
    start_time: i64,
    task_ids: Vec<Uuid>,
    pauses: Json<Vec<Pause>>,
}

impl TryFrom<FocusSessionRow> for FocusSession {
    type Error = CoreError;

    fn try_from(row: FocusSessionRow) -> Result<Self, Self::Error> {
        Ok(FocusSession {
            id: row.id.to_string(),
            status: row.status.parse().map_err(CoreError::repository)?,
            start_time: row.start_time,
            tasks: row.task_ids.iter().map(Uuid::to_string).collect(),
            pauses: row.pauses.0,
        })
    }
}

fn parse_task_ids(task_ids: &[String]) -> Result<Vec<Uuid>, CoreError> {
    task_ids.iter().map(|id| parse_reference(id)).collect()
}

/// [`FocusSessionRepository`] over the `focus_sessions` table.
pub struct PostgresFocusSessionRepository {
    pool: PgPool,
}

impl PostgresFocusSessionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl FocusSessionRepository for PostgresFocusSessionRepository {
    async fn find_all(&self) -> Result<Vec<FocusSession>, CoreError> {
        let rows: Vec<FocusSessionRow> = sqlx::query_as(
            "SELECT id, status, start_time, task_ids, pauses FROM focus_sessions ORDER BY created_at",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(CoreError::repository)?;
        rows.into_iter().map(FocusSession::try_from).collect()
    }

    async fn find_by_id(&self, id: &str) -> Result<Option<FocusSession>, CoreError> {
        let Some(id) = parse_id(id) else {
            return Ok(None);
        };

        let row: Option<FocusSessionRow> = sqlx::query_as(
            "SELECT id, status, start_time, task_ids, pauses FROM focus_sessions WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(CoreError::repository)?;
        row.map(FocusSession::try_from).transpose()
    }

    async fn find_current(&self) -> Result<Option<FocusSession>, CoreError> {
        // The statuses are spelled out, not bound, so Postgres can use the
        // partial index `focus_sessions_current_idx`.
        let row: Option<FocusSessionRow> = sqlx::query_as(
            "SELECT id, status, start_time, task_ids, pauses FROM focus_sessions
             WHERE status IN ('active', 'paused')
             ORDER BY created_at DESC
             LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(CoreError::repository)?;
        row.map(FocusSession::try_from).transpose()
    }

    async fn create(&self, session: NewFocusSession) -> Result<FocusSession, CoreError> {
        let row: FocusSessionRow = sqlx::query_as(
            "INSERT INTO focus_sessions (status, start_time, task_ids, pauses)
             VALUES ($1, $2, $3, $4)
             RETURNING id, status, start_time, task_ids, pauses",
        )
        .bind(session.status.as_str())
        .bind(session.start_time)
        .bind(parse_task_ids(&session.tasks)?)
        .bind(Json(&session.pauses))
        .fetch_one(&self.pool)
        .await
        .map_err(CoreError::repository)?;
        row.try_into()
    }

    async fn save(&self, session: &FocusSession) -> Result<(), CoreError> {
        let Some(id) = parse_id(&session.id) else {
            return Ok(());
        };

        sqlx::query(
            "UPDATE focus_sessions SET status = $2, start_time = $3, task_ids = $4, pauses = $5
             WHERE id = $1",
        )
        .bind(id)
        .bind(session.status.as_str())
        .bind(session.start_time)
        .bind(parse_task_ids(&session.tasks)?)
        .bind(Json(&session.pauses))
        .execute(&self.pool)
        .await
        .map_err(CoreError::repository)?;
        Ok(())
    }
}
