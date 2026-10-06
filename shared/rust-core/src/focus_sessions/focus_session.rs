use std::str::FromStr;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::UnknownStatus;
use crate::serde_fields::present;

/// Where a session is in its life: `active` → `paused` ⇄ `active` → `finished`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FocusSessionStatus {
    Active,
    Paused,
    Finished,
}

impl FocusSessionStatus {
    const ALL: [FocusSessionStatus; 3] = [Self::Active, Self::Paused, Self::Finished];

    /// The name used in JSON and storage.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Paused => "paused",
            Self::Finished => "finished",
        }
    }
}

impl FromStr for FocusSessionStatus {
    type Err = UnknownStatus;

    fn from_str(name: &str) -> Result<Self, Self::Err> {
        Self::ALL
            .into_iter()
            .find(|status| status.as_str() == name)
            .ok_or_else(|| UnknownStatus(name.to_owned()))
    }
}

/// A session in one of these statuses is "current": it has not been finished yet.
pub const CURRENT_SESSION_STATUSES: [FocusSessionStatus; 2] =
    [FocusSessionStatus::Active, FocusSessionStatus::Paused];

/// A break within a session. Pauses are values owned by their session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pause {
    pub id: String,
    pub start_time: i64,
    /// `None` while the pause is open.
    pub end_time: Option<i64>,
    /// How long the pause lasted once closed (or the time sent to `PATCH /focus-sessions/pause`).
    pub time: i64,
}

impl Pause {
    /// A new, open pause.
    pub fn new(start_time: i64, time: i64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            start_time,
            end_time: None,
            time,
        }
    }
}

/// A stretch of focused work on a set of tasks. Times are epoch milliseconds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSession {
    pub id: String,
    pub status: FocusSessionStatus,
    pub start_time: i64,
    /// Ids of the tasks the session started with.
    pub tasks: Vec<String>,
    /// Oldest first. Only the last pause can be open.
    pub pauses: Vec<Pause>,
}

/// A session as handed to storage, which assigns the id.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewFocusSession {
    pub status: FocusSessionStatus,
    pub start_time: i64,
    pub tasks: Vec<String>,
    pub pauses: Vec<Pause>,
}

/// What a client sends to start a session (`POST /focus-sessions`). The body is optional.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFocusSession {
    /// Left out or empty: every in-progress and pending task.
    #[serde(default, rename = "tasks")]
    pub task_ids: Vec<String>,
    /// Left out: now.
    #[serde(default, deserialize_with = "present")]
    pub start_time: Option<i64>,
}

/// What a client sends to pause the current session (`PATCH /focus-sessions/pause`).
/// The body is optional.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct PauseFocusSession {
    #[serde(default, deserialize_with = "present")]
    pub time: Option<i64>,
}

// The rules below are pure: they take a session and return a new one.
// The service decides when to apply them and persists the result.
impl FocusSession {
    pub fn open_pause(&self) -> Option<&Pause> {
        self.pauses.last().filter(|pause| pause.end_time.is_none())
    }

    /// Closing a pause sets its end to `now` and its time to how long it lasted.
    pub fn close_open_pause(mut self, now: i64) -> Self {
        if let Some(pause) = self
            .pauses
            .last_mut()
            .filter(|pause| pause.end_time.is_none())
        {
            pause.end_time = Some(now);
            pause.time = now - pause.start_time;
        }
        self
    }

    pub fn start_pause(mut self, pause: Pause) -> Self {
        self.pauses.push(pause);
        self.status = FocusSessionStatus::Paused;
        self
    }

    pub fn resume(self, now: i64) -> Self {
        Self {
            status: FocusSessionStatus::Active,
            ..self.close_open_pause(now)
        }
    }

    pub fn finish(self, now: i64) -> Self {
        Self {
            status: FocusSessionStatus::Finished,
            ..self.close_open_pause(now)
        }
    }

    /// Moves `start_time` forward by the time spent in closed pauses, so a
    /// client can compute the focused time as `now - startTime`.
    pub fn shift_start_time_by_closed_pauses(self) -> Self {
        let paused_time: i64 = self
            .pauses
            .iter()
            .filter_map(|pause| pause.end_time.map(|end_time| end_time - pause.start_time))
            .sum();

        Self {
            start_time: self.start_time + paused_time,
            ..self
        }
    }
}
