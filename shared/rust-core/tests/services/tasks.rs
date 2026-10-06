use cero_core::{StartFocusSession, Task, TaskChanges, TaskStatus, messages};

use crate::helpers::{App, assert_invalid, assert_not_found, ids, setup};

/// Creates the tasks one after another (creation order matters) and returns them in that order.
async fn create_tasks<const N: usize>(app: &App, descriptions: [&str; N]) -> [Task; N] {
    let mut tasks = Vec::with_capacity(N);
    for description in descriptions {
        tasks.push(app.create_task(description).await);
    }
    tasks.try_into().expect("one task per description")
}

async fn priorities(app: &App, tasks: &[&Task]) -> Vec<i32> {
    let mut priorities = Vec::with_capacity(tasks.len());
    for task in tasks {
        priorities.push(app.tasks.get(&task.id).await.unwrap().priority);
    }
    priorities
}

fn priority(priority: i32) -> TaskChanges {
    TaskChanges {
        priority: Some(priority),
        ..TaskChanges::default()
    }
}

mod list {
    use super::*;

    #[tokio::test]
    async fn lists_in_progress_and_pending_tasks_by_priority_when_no_session_is_current() {
        let app = setup();
        let [first, second, done] = create_tasks(&app, ["first", "second", "done"]).await;
        app.tasks.complete(&done.id).await.unwrap();
        app.tasks.update(&first.id, priority(5)).await.unwrap();

        let tasks = app.tasks.list().await.unwrap();

        assert_eq!(ids(&tasks), [&second.id, &first.id]);
    }

    #[tokio::test]
    async fn lists_the_current_sessions_tasks_completed_ones_included() {
        let app = setup();
        let in_session = app.create_task("in session").await;
        let only_this_task = StartFocusSession {
            task_ids: vec![in_session.id.clone()],
            ..StartFocusSession::default()
        };
        app.focus_sessions.start(only_this_task).await.unwrap();
        app.tasks.complete(&in_session.id).await.unwrap();
        let outside = app.create_task("created during the session").await;
        let detach = TaskChanges {
            focus_session_id: Some(None),
            ..TaskChanges::default()
        };
        app.tasks.update(&outside.id, detach).await.unwrap();

        let tasks = app.tasks.list().await.unwrap();

        assert_eq!(ids(&tasks), [&in_session.id]);
    }

    #[tokio::test]
    async fn keeps_creation_order_between_tasks_with_the_same_priority() {
        let app = setup();
        let descriptions = ["a", "b", "c"];
        create_tasks(&app, descriptions).await;

        let tasks = app.tasks.list().await.unwrap();

        let listed: Vec<&str> = tasks.iter().map(|task| task.description.as_str()).collect();
        assert_eq!(listed, descriptions);
    }
}

mod get {
    use super::*;

    #[tokio::test]
    async fn fails_with_not_found_for_an_unknown_id() {
        let app = setup();

        assert_not_found(app.tasks.get("unknown").await, messages::TASK_NOT_FOUND);
    }
}

mod create {
    use super::*;

    #[tokio::test]
    async fn starts_tasks_in_progress_until_three_are_in_progress_then_as_pending() {
        let app = setup();

        let tasks = create_tasks(&app, ["1", "2", "3", "4"]).await;

        let statuses = tasks.map(|task| task.status);
        use TaskStatus::{InProgress, Pending};
        assert_eq!(statuses, [InProgress, InProgress, InProgress, Pending]);
    }

    #[tokio::test]
    async fn creates_the_task_at_priority_0_without_a_session_when_none_is_current() {
        let app = setup();

        let task = app.create_task("write tests").await;

        let expected = Task {
            id: task.id.clone(),
            description: "write tests".into(),
            priority: 0,
            status: TaskStatus::InProgress,
            focus_session_id: None,
        };
        assert_eq!(task, expected);
    }

    #[tokio::test]
    async fn attaches_the_task_to_the_current_session() {
        let app = setup();
        let session = app
            .focus_sessions
            .start(StartFocusSession::default())
            .await
            .unwrap();

        let task = app.create_task("joins the session").await;

        assert_eq!(task.focus_session_id, Some(session.id));
    }
}

mod complete {
    use super::*;

    #[tokio::test]
    async fn puts_the_task_on_top_of_the_completed_group_and_renumbers_the_rest() {
        let app = setup();
        let [a, b, c] = create_tasks(&app, ["a", "b", "c"]).await;
        app.tasks.complete(&a.id).await.unwrap();
        app.tasks.complete(&b.id).await.unwrap();

        let completed = app.tasks.complete(&c.id).await.unwrap();

        assert_eq!(
            (completed.status, completed.priority),
            (TaskStatus::Completed, 0)
        );
        assert_eq!(priorities(&app, &[&c, &b, &a]).await, [0, 1, 2]);
    }

    #[tokio::test]
    async fn changes_nothing_when_the_task_does_not_exist() {
        let app = setup();
        let a = app.create_task("a").await;
        app.tasks.complete(&a.id).await.unwrap();
        app.tasks.update(&a.id, priority(7)).await.unwrap();

        assert_not_found(
            app.tasks.complete("unknown").await,
            messages::TASK_NOT_FOUND,
        );

        assert_eq!(priorities(&app, &[&a]).await, [7]);
    }
}

mod reset {
    use super::*;

    #[tokio::test]
    async fn puts_the_task_on_top_of_the_pending_group_and_renumbers_the_rest() {
        let app = setup();
        let [a, b, c, d] = create_tasks(&app, ["a", "b", "c", "d"]).await; // d starts pending
        app.tasks.reset(&c.id).await.unwrap();

        let reset = app.tasks.reset(&a.id).await.unwrap();

        assert_eq!((reset.status, reset.priority), (TaskStatus::Pending, 0));
        assert_eq!(priorities(&app, &[&a, &c, &d]).await, [0, 1, 2]);
        assert_eq!(
            app.tasks.get(&b.id).await.unwrap().status,
            TaskStatus::InProgress
        );
    }
}

mod change_status {
    use super::*;

    #[tokio::test]
    async fn sets_only_the_status() {
        let app = setup();
        let task = app.create_task("a").await;
        app.tasks.update(&task.id, priority(4)).await.unwrap();

        let updated = app.tasks.change_status(&task.id, "pending").await.unwrap();

        assert_eq!((updated.status, updated.priority), (TaskStatus::Pending, 4));
    }

    #[tokio::test]
    async fn rejects_an_unknown_status_before_looking_the_task_up() {
        let app = setup();

        let result = app.tasks.change_status("unknown", "done").await;

        assert_invalid(result, messages::INVALID_TASK_STATUS);
    }
}

mod update {
    use serde_json::json;

    use super::*;

    #[tokio::test]
    async fn changes_only_the_given_fields() {
        let app = setup();
        app.focus_sessions
            .start(StartFocusSession::default())
            .await
            .unwrap();
        let task = app.create_task("before").await; // joins the session

        let changes = TaskChanges {
            description: Some("after".into()),
            focus_session_id: Some(None),
            ..TaskChanges::default()
        };
        let updated = app.tasks.update(&task.id, changes).await.unwrap();

        let expected = Task {
            description: "after".into(),
            focus_session_id: None,
            ..task
        };
        assert_eq!(updated, expected);
    }

    /// `TaskChanges::status` is a `TaskStatus`, so an unknown status cannot
    /// even be expressed: it is refused while the request body is read.
    #[test]
    fn rejects_an_unknown_status() {
        let changes = serde_json::from_value::<TaskChanges>(json!({ "status": "done" }));

        assert!(changes.is_err());
    }

    #[tokio::test]
    async fn rejects_a_focus_session_id_that_does_not_match_a_session() {
        let app = setup();
        let task = app.create_task("a").await;

        let changes = TaskChanges {
            focus_session_id: Some(Some("unknown".into())),
            ..TaskChanges::default()
        };
        let result = app.tasks.update(&task.id, changes).await;

        assert_invalid(result, messages::UNKNOWN_FOCUS_SESSION);
    }

    #[test]
    fn tells_a_missing_field_from_null() {
        let read = |body| serde_json::from_value::<TaskChanges>(body);

        assert_eq!(read(json!({})).unwrap().focus_session_id, None);
        assert_eq!(
            read(json!({ "focusSessionId": null }))
                .unwrap()
                .focus_session_id,
            Some(None)
        );
        assert!(
            read(json!({ "description": null })).is_err(),
            "only focusSessionId may be null"
        );
    }
}

mod delete {
    use super::*;

    #[tokio::test]
    async fn removes_the_task_and_returns_it() {
        let app = setup();
        let task = app.create_task("a").await;

        let deleted = app.tasks.delete(&task.id).await.unwrap();

        assert_eq!(deleted, task);
        assert_not_found(app.tasks.get(&task.id).await, messages::TASK_NOT_FOUND);
    }

    #[tokio::test]
    async fn fails_with_not_found_for_an_unknown_id() {
        let app = setup();

        assert_not_found(app.tasks.delete("unknown").await, messages::TASK_NOT_FOUND);
    }
}
