//! The repository contract for [`FocusSessionRepository`](crate::FocusSessionRepository).
//! Each case receives repositories over empty storage.

use super::{new_session, new_task};
use crate::{FocusSession, FocusSessionStatus, NewFocusSession, Pause, Repositories};

pub async fn assigns_an_id_on_create_and_finds_the_session_by_it_pauses_included(
    repositories: &Repositories,
) {
    // Task ids are storage-specific (UUID, ObjectId...), so the session refers to real tasks.
    let first = repositories.tasks.create(new_task()).await.unwrap();
    let second = repositories.tasks.create(new_task()).await.unwrap();
    let created = repositories
        .focus_sessions
        .create(NewFocusSession {
            status: FocusSessionStatus::Paused,
            tasks: vec![second.id, first.id],
            pauses: vec![Pause {
                id: "pause-1".into(),
                start_time: 1_500,
                end_time: None,
                time: 0,
            }],
            ..new_session()
        })
        .await
        .unwrap();

    assert!(!created.id.is_empty());
    let found = repositories
        .focus_sessions
        .find_by_id(&created.id)
        .await
        .unwrap();
    assert_eq!(found, Some(created));
    assert_eq!(
        repositories
            .focus_sessions
            .find_by_id("not-an-id")
            .await
            .unwrap(),
        None
    );
}

pub async fn lists_sessions_oldest_first(repositories: &Repositories) {
    let sessions = &repositories.focus_sessions;
    let first = sessions
        .create(NewFocusSession {
            start_time: 9,
            ..new_session()
        })
        .await
        .unwrap();
    let second = sessions
        .create(NewFocusSession {
            start_time: 1,
            ..new_session()
        })
        .await
        .unwrap();

    let all = sessions.find_all().await.unwrap();

    let ids: Vec<&str> = all.iter().map(|session| session.id.as_str()).collect();
    assert_eq!(ids, [&first.id, &second.id]);
}

pub async fn finds_the_newest_active_or_paused_session_as_current(repositories: &Repositories) {
    let sessions = &repositories.focus_sessions;
    assert_eq!(sessions.find_current().await.unwrap(), None);

    let with_status = |status| NewFocusSession {
        status,
        ..new_session()
    };
    sessions
        .create(with_status(FocusSessionStatus::Active))
        .await
        .unwrap();
    let newest = sessions
        .create(with_status(FocusSessionStatus::Paused))
        .await
        .unwrap();
    sessions
        .create(with_status(FocusSessionStatus::Finished))
        .await
        .unwrap();

    let current = sessions.find_current().await.unwrap();
    assert_eq!(current.map(|session| session.id), Some(newest.id));
}

pub async fn overwrites_a_session_on_save(repositories: &Repositories) {
    let session = repositories
        .focus_sessions
        .create(new_session())
        .await
        .unwrap();
    let changed = FocusSession {
        status: FocusSessionStatus::Finished,
        pauses: vec![Pause {
            id: "pause-1".into(),
            start_time: 1_100,
            end_time: Some(1_400),
            time: 300,
        }],
        ..session.clone()
    };

    repositories.focus_sessions.save(&changed).await.unwrap();

    assert_eq!(
        repositories
            .focus_sessions
            .find_by_id(&session.id)
            .await
            .unwrap(),
        Some(changed)
    );
}
