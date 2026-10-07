use async_trait::async_trait;

use super::focus_session::{FocusSession, NewFocusSession};
use crate::error::CoreError;

/// The storage port for focus sessions. Pauses are stored inside their session.
/// See [`crate::Repositories`] for why it uses `#[async_trait]`.
///
/// Contract every adapter honours:
/// - a malformed id is simply "not found", it never fails;
/// - `find_all` lists sessions oldest first.
#[async_trait]
pub trait FocusSessionRepository: Send + Sync {
    async fn find_all(&self) -> Result<Vec<FocusSession>, CoreError>;

    async fn find_by_id(&self, id: &str) -> Result<Option<FocusSession>, CoreError>;

    /// The newest session that is active or paused.
    async fn find_current(&self) -> Result<Option<FocusSession>, CoreError>;

    /// Storage assigns the id.
    async fn create(&self, session: NewFocusSession) -> Result<FocusSession, CoreError>;

    /// Overwrites the stored session with the same id.
    async fn save(&self, session: &FocusSession) -> Result<(), CoreError>;
}
