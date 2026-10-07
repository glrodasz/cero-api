//! Tasks: the domain, the storage port and the use cases.

mod repository;
mod service;
mod task;

pub use repository::{TaskFilter, TaskRepository};
pub use service::TasksService;
pub use task::{
    ACTIVE_TASK_STATUSES, CreateTask, MAX_IN_PROGRESS_TASKS, NewTask, Task, TaskChanges,
    TaskStatus, renumber, status_for_new_task,
};
