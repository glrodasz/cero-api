//! The repository contract for [`TaskRepository`](crate::TaskRepository).
//! Each case receives repositories over empty storage.

use super::{new_session, new_task};
use crate::{NewTask, Repositories, Task, TaskFilter, TaskStatus};

fn ids(tasks: &[Task]) -> Vec<&str> {
    tasks.iter().map(|task| task.id.as_str()).collect()
}

pub async fn assigns_an_id_on_create_and_finds_the_task_by_it(repositories: &Repositories) {
    let created = repositories
        .tasks
        .create(NewTask {
            description: "stored".into(),
            ..new_task()
        })
        .await
        .unwrap();

    assert!(!created.id.is_empty());
    assert_eq!(
        repositories.tasks.find_by_id(&created.id).await.unwrap(),
        Some(created)
    );
}

pub async fn finds_nothing_for_unknown_or_malformed_ids(repositories: &Repositories) {
    let deleted = repositories.tasks.create(new_task()).await.unwrap();
    repositories.tasks.delete(&deleted.id).await.unwrap();

    assert_eq!(
        repositories.tasks.find_by_id(&deleted.id).await.unwrap(),
        None
    );
    assert_eq!(
        repositories.tasks.find_by_id("not-an-id").await.unwrap(),
        None
    );
}

pub async fn sorts_by_priority_then_creation_order(repositories: &Repositories) {
    let tasks = &repositories.tasks;
    let second = tasks
        .create(NewTask {
            priority: 1,
            ..new_task()
        })
        .await
        .unwrap();
    let third = tasks
        .create(NewTask {
            priority: 1,
            ..new_task()
        })
        .await
        .unwrap();
    let first = tasks
        .create(NewTask {
            priority: 0,
            ..new_task()
        })
        .await
        .unwrap();

    let found = tasks.find_many(&TaskFilter::default()).await.unwrap();

    assert_eq!(ids(&found), [&first.id, &second.id, &third.id]);
}

pub async fn combines_every_filter_criterion(repositories: &Repositories) {
    let session = repositories
        .focus_sessions
        .create(new_session())
        .await
        .unwrap();
    let in_session = || Some(session.id.clone());
    let tasks = &repositories.tasks;
    let matching = tasks
        .create(NewTask {
            status: TaskStatus::Pending,
            focus_session_id: in_session(),
            ..new_task()
        })
        .await
        .unwrap();
    tasks
        .create(NewTask {
            status: TaskStatus::Completed,
            focus_session_id: in_session(),
            ..new_task()
        })
        .await
        .unwrap();
    let other = tasks
        .create(NewTask {
            status: TaskStatus::Pending,
            ..new_task()
        })
        .await
        .unwrap();

    let by_all = TaskFilter::default()
        .with_ids(vec![
            matching.id.clone(),
            other.id.clone(),
            "not-an-id".into(),
        ])
        .with_statuses(&[TaskStatus::Pending, TaskStatus::InProgress])
        .in_focus_session(&session.id);

    assert_eq!(
        ids(&tasks.find_many(&by_all).await.unwrap()),
        [&matching.id]
    );
    assert_eq!(
        tasks
            .find_many(&TaskFilter::default().with_ids(Vec::new()))
            .await
            .unwrap(),
        []
    );
}

pub async fn counts_tasks_by_status(repositories: &Repositories) {
    let tasks = &repositories.tasks;
    for status in [
        TaskStatus::InProgress,
        TaskStatus::InProgress,
        TaskStatus::Pending,
    ] {
        tasks
            .create(NewTask {
                status,
                ..new_task()
            })
            .await
            .unwrap();
    }

    assert_eq!(
        tasks.count_by_status(TaskStatus::InProgress).await.unwrap(),
        2
    );
    assert_eq!(
        tasks.count_by_status(TaskStatus::Completed).await.unwrap(),
        0
    );
}

pub async fn overwrites_a_task_on_save(repositories: &Repositories) {
    let task = repositories.tasks.create(new_task()).await.unwrap();
    let changed = Task {
        description: "changed".into(),
        priority: 3,
        status: TaskStatus::Completed,
        ..task.clone()
    };

    repositories.tasks.save(&changed).await.unwrap();

    assert_eq!(
        repositories.tasks.find_by_id(&task.id).await.unwrap(),
        Some(changed)
    );
}

pub async fn assigns_and_clears_the_focus_session_of_many_tasks_at_once(
    repositories: &Repositories,
) {
    let session = repositories
        .focus_sessions
        .create(new_session())
        .await
        .unwrap();
    let tasks = &repositories.tasks;
    let a = tasks.create(new_task()).await.unwrap();
    let b = tasks.create(new_task()).await.unwrap();

    let task_ids = [a.id.clone(), b.id.clone(), "not-an-id".into()];
    tasks
        .assign_focus_session(&task_ids, Some(&session.id))
        .await
        .unwrap();
    let in_session = TaskFilter::default().in_focus_session(&session.id);
    assert_eq!(
        ids(&tasks.find_many(&in_session).await.unwrap()),
        [&a.id, &b.id]
    );

    tasks
        .assign_focus_session(std::slice::from_ref(&a.id), None)
        .await
        .unwrap();
    let a = tasks
        .find_by_id(&a.id)
        .await
        .unwrap()
        .expect("a still exists");
    assert_eq!(a.focus_session_id, None);
}

pub async fn ignores_malformed_ids_on_save_and_delete(repositories: &Repositories) {
    let tasks = &repositories.tasks;
    let malformed = Task {
        id: "not-an-id".into(),
        description: "a task".into(),
        priority: 0,
        status: TaskStatus::Pending,
        focus_session_id: None,
    };

    tasks.save(&malformed).await.unwrap();
    tasks.delete("not-an-id").await.unwrap();

    assert_eq!(tasks.find_many(&TaskFilter::default()).await.unwrap(), []);
}
