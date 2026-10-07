//! Test support, behind the `testing` feature: a clock moved by hand, and the
//! behaviour every storage adapter must honour (the repository contract) as
//! runnable tests.
//!
//! An adapter crate turns on the feature in its `[dev-dependencies]` and runs
//! the contract from one of its test files:
//!
//! ```
//! use cero_core::{Repositories, in_memory};
//!
//! /// Repositories over empty storage. These are the in-memory ones; an
//! /// adapter returns its own, over a freshly emptied database.
//! async fn empty_storage() -> Repositories {
//!     in_memory::repositories()
//! }
//!
//! cero_core::repository_contract_tests!(empty_storage);
//! # fn main() {}
//! ```

use std::sync::atomic::{AtomicI64, Ordering};

use crate::clock::Clock;
use crate::{FocusSessionStatus, NewFocusSession, NewTask, TaskStatus};

pub mod focus_sessions_contract;
pub mod tasks_contract;

/// A clock that only moves when told to.
#[derive(Debug)]
pub struct ManualClock {
    now: AtomicI64,
}

impl ManualClock {
    pub fn starting_at(now: i64) -> Self {
        Self {
            now: AtomicI64::new(now),
        }
    }

    pub fn advance(&self, milliseconds: i64) {
        self.now.fetch_add(milliseconds, Ordering::SeqCst);
    }
}

impl Clock for ManualClock {
    fn now(&self) -> i64 {
        self.now.load(Ordering::SeqCst)
    }
}

/// A task for the contract cases to store; they override what they care about.
fn new_task() -> NewTask {
    NewTask {
        description: "a task".into(),
        priority: 0,
        status: TaskStatus::Pending,
        focus_session_id: None,
    }
}

/// A session for the contract cases to store; they override what they care about.
fn new_session() -> NewFocusSession {
    NewFocusSession {
        status: FocusSessionStatus::Active,
        start_time: 1_000,
        tasks: Vec::new(),
        pauses: Vec::new(),
    }
}

/// Generates one `#[tokio::test]` per case of the repository contract, in the
/// modules `tasks` and `focus_sessions`.
///
/// `$empty_storage` names an async function of the calling module that returns
/// repositories over empty storage, or anything that borrows as
/// [`Repositories`](crate::Repositories). Each case calls it once. The calling
/// crate needs `tokio` (features `macros` and `rt`) as a dev-dependency.
#[macro_export]
macro_rules! repository_contract_tests {
    ($empty_storage:ident) => {
        $crate::repository_contract_tests!(@cases $empty_storage, tasks_contract as tasks [
            assigns_an_id_on_create_and_finds_the_task_by_it,
            finds_nothing_for_unknown_or_malformed_ids,
            sorts_by_priority_then_creation_order,
            combines_every_filter_criterion,
            counts_tasks_by_status,
            overwrites_a_task_on_save,
            assigns_and_clears_the_focus_session_of_many_tasks_at_once,
            ignores_malformed_ids_on_save_and_delete,
        ]);
        $crate::repository_contract_tests!(@cases $empty_storage, focus_sessions_contract as focus_sessions [
            assigns_an_id_on_create_and_finds_the_session_by_it_pauses_included,
            lists_sessions_oldest_first,
            finds_the_newest_active_or_paused_session_as_current,
            overwrites_a_session_on_save,
        ]);
    };
    (@cases $empty_storage:ident, $contract:ident as $group:ident [$($case:ident),* $(,)?]) => {
        mod $group {
            $(
                #[tokio::test]
                async fn $case() {
                    let storage = super::$empty_storage().await;
                    let repositories = ::std::borrow::Borrow::<$crate::Repositories>::borrow(&storage);
                    $crate::testing::$contract::$case(repositories).await;
                }
            )*
        }
    };
}
