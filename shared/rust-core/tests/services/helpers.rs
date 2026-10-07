use std::fmt::Debug;
use std::sync::Arc;

use cero_core::testing::ManualClock;
use cero_core::{
    Clock, CoreError, CreateTask, FocusSessionsService, Services, Task, TasksService, in_memory,
};

/// Services wired to in-memory storage and a clock the test moves by hand.
pub struct App {
    pub tasks: TasksService,
    pub focus_sessions: FocusSessionsService,
    clock: Arc<ManualClock>,
}

pub fn setup() -> App {
    let clock = Arc::new(ManualClock::starting_at(1_000_000));
    let Services {
        tasks,
        focus_sessions,
    } = Services::with_clock(in_memory::repositories(), clock.clone());
    App {
        tasks,
        focus_sessions,
        clock,
    }
}

impl App {
    pub fn advance_clock(&self, milliseconds: i64) {
        self.clock.advance(milliseconds);
    }

    pub fn now(&self) -> i64 {
        self.clock.now()
    }

    pub async fn create_task(&self, description: &str) -> Task {
        let request = CreateTask {
            description: description.into(),
        };
        self.tasks
            .create(request)
            .await
            .expect("the task is created")
    }
}

pub fn ids(tasks: &[Task]) -> Vec<&str> {
    tasks.iter().map(|task| task.id.as_str()).collect()
}

pub fn assert_not_found<T: Debug>(result: Result<T, CoreError>, expected_message: &str) {
    assert!(
        matches!(&result, Err(CoreError::NotFound(message)) if *message == expected_message),
        "expected NotFound({expected_message:?}), got {result:?}",
    );
}

pub fn assert_invalid<T: Debug>(result: Result<T, CoreError>, expected_message: &str) {
    assert!(
        matches!(&result, Err(CoreError::Invalid(message)) if message == expected_message),
        "expected Invalid({expected_message:?}), got {result:?}",
    );
}
