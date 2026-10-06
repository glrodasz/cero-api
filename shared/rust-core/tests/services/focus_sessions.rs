use cero_core::{FocusSession, FocusSessionStatus, PauseFocusSession, StartFocusSession, messages};

use crate::helpers::{App, assert_not_found, setup};

async fn start(app: &App) -> FocusSession {
    app.focus_sessions
        .start(StartFocusSession::default())
        .await
        .unwrap()
}

async fn pause_current(app: &App) -> FocusSession {
    app.focus_sessions
        .pause_current(PauseFocusSession::default())
        .await
        .unwrap()
}

/// The pauses without their generated ids: `(start_time, end_time, time)`.
fn pauses(session: &FocusSession) -> Vec<(i64, Option<i64>, i64)> {
    session
        .pauses
        .iter()
        .map(|pause| (pause.start_time, pause.end_time, pause.time))
        .collect()
}

mod start {
    use super::*;

    #[tokio::test]
    async fn starts_an_active_session_with_every_in_progress_and_pending_task_by_default() {
        let app = setup();
        let active = app.create_task("active").await;
        let done = app.create_task("done").await;
        app.tasks.complete(&done.id).await.unwrap();

        let session = start(&app).await;

        let expected = FocusSession {
            id: session.id.clone(),
            status: FocusSessionStatus::Active,
            start_time: app.now(),
            tasks: vec![active.id.clone()],
            pauses: Vec::new(),
        };
        assert_eq!(session, expected);
        assert_eq!(
            app.tasks.get(&active.id).await.unwrap().focus_session_id,
            Some(session.id)
        );
        assert_eq!(
            app.tasks.get(&done.id).await.unwrap().focus_session_id,
            None
        );
    }

    #[tokio::test]
    async fn keeps_requested_tasks_in_request_order_dropping_unknown_and_repeated_ids() {
        let app = setup();
        let a = app.create_task("a").await;
        let b = app.create_task("b").await;

        let task_ids = vec![b.id.clone(), "unknown".into(), a.id.clone(), b.id.clone()];
        let request = StartFocusSession {
            task_ids,
            ..StartFocusSession::default()
        };
        let session = app.focus_sessions.start(request).await.unwrap();

        assert_eq!(session.tasks, [b.id, a.id]);
    }

    #[tokio::test]
    async fn uses_the_given_start_time() {
        let app = setup();

        let request = StartFocusSession {
            start_time: Some(42),
            ..StartFocusSession::default()
        };
        let session = app.focus_sessions.start(request).await.unwrap();

        assert_eq!(session.start_time, 42);
    }
}

mod get_current {
    use super::*;

    #[tokio::test]
    async fn returns_none_when_no_session_is_current() {
        let app = setup();
        start(&app).await;
        app.focus_sessions.finish_current().await.unwrap();

        assert_eq!(app.focus_sessions.get_current().await.unwrap(), None);
    }

    #[tokio::test]
    async fn moves_start_time_forward_by_the_closed_pauses_only() {
        let app = setup();
        let session = start(&app).await;
        app.focus_sessions.pause(&session.id).await.unwrap();
        app.advance_clock(300);
        app.focus_sessions.resume(&session.id).await.unwrap();
        app.focus_sessions.pause(&session.id).await.unwrap();
        app.advance_clock(5_000); // still open: not counted yet

        let current = app
            .focus_sessions
            .get_current()
            .await
            .unwrap()
            .expect("a current session");

        assert_eq!(current.start_time, session.start_time + 300);
    }

    #[tokio::test]
    async fn returns_the_newest_current_session() {
        let app = setup();
        start(&app).await;
        let newest = start(&app).await;

        let current = app.focus_sessions.get_current().await.unwrap();

        assert_eq!(current.map(|session| session.id), Some(newest.id));
    }
}

mod pause {
    use super::*;

    #[tokio::test]
    async fn opens_a_pause_on_an_active_session() {
        let app = setup();
        let session = start(&app).await;
        app.advance_clock(1_000);

        let paused = app.focus_sessions.pause(&session.id).await.unwrap();

        assert_eq!(paused.status, FocusSessionStatus::Paused);
        assert_eq!(pauses(&paused), [(app.now(), None, 0)]);
    }

    #[tokio::test]
    async fn refuses_sessions_that_are_not_active() {
        let app = setup();
        let session = start(&app).await;
        app.focus_sessions.pause(&session.id).await.unwrap();

        assert_not_found(
            app.focus_sessions.pause(&session.id).await,
            messages::CANNOT_PAUSE,
        );
        assert_not_found(
            app.focus_sessions.pause("unknown").await,
            messages::CANNOT_PAUSE,
        );
    }
}

mod pause_current {
    use super::*;

    #[tokio::test]
    async fn fails_when_no_session_is_current() {
        let app = setup();

        let result = app
            .focus_sessions
            .pause_current(PauseFocusSession::default())
            .await;

        assert_not_found(result, messages::NO_CURRENT_FOCUS_SESSION);
    }

    #[tokio::test]
    async fn opens_a_pause_on_an_active_session() {
        let app = setup();
        start(&app).await;

        let paused = pause_current(&app).await;

        assert_eq!(paused.status, FocusSessionStatus::Paused);
        assert_eq!(paused.pauses.len(), 1);
        assert_eq!(paused.pauses[0].end_time, None);
    }

    #[tokio::test]
    async fn leaves_an_already_paused_session_as_is_when_no_time_is_given() {
        let app = setup();
        start(&app).await;
        let paused = pause_current(&app).await;
        app.advance_clock(1_000);

        assert_eq!(pause_current(&app).await, paused);
    }

    #[tokio::test]
    async fn closes_the_open_pause_and_opens_a_new_one_with_the_given_time() {
        let app = setup();
        start(&app).await;
        pause_current(&app).await;
        let first_pause_start = app.now();
        app.advance_clock(1_000);

        let with_time = PauseFocusSession { time: Some(25) };
        let paused = app.focus_sessions.pause_current(with_time).await.unwrap();

        let now = app.now();
        assert_eq!(
            pauses(&paused),
            [(first_pause_start, Some(now), 1_000), (now, None, 25)]
        );
    }
}

mod resume {
    use super::*;

    #[tokio::test]
    async fn closes_the_open_pause_of_a_paused_session() {
        let app = setup();
        let session = start(&app).await;
        app.focus_sessions.pause(&session.id).await.unwrap();
        app.advance_clock(700);

        let resumed = app.focus_sessions.resume(&session.id).await.unwrap();

        assert_eq!(resumed.status, FocusSessionStatus::Active);
        let closed: Vec<_> = pauses(&resumed)
            .into_iter()
            .map(|(_, end_time, time)| (end_time, time))
            .collect();
        assert_eq!(closed, [(Some(app.now()), 700)]);
    }

    #[tokio::test]
    async fn refuses_sessions_that_are_not_paused() {
        let app = setup();
        let session = start(&app).await;

        assert_not_found(
            app.focus_sessions.resume(&session.id).await,
            messages::CANNOT_RESUME,
        );
    }
}

mod resume_current {
    use super::*;

    #[tokio::test]
    async fn closes_the_open_pause_of_the_current_session() {
        let app = setup();
        start(&app).await;
        pause_current(&app).await;
        app.advance_clock(200);

        let resumed = app.focus_sessions.resume_current().await.unwrap();

        assert_eq!(resumed.status, FocusSessionStatus::Active);
        assert_eq!(resumed.pauses[0].time, 200);
    }

    #[tokio::test]
    async fn leaves_a_session_without_an_open_pause_as_is() {
        let app = setup();
        let session = start(&app).await;

        assert_eq!(app.focus_sessions.resume_current().await.unwrap(), session);
    }

    #[tokio::test]
    async fn fails_when_no_session_is_current() {
        let app = setup();

        let result = app.focus_sessions.resume_current().await;

        assert_not_found(result, messages::NO_CURRENT_FOCUS_SESSION);
    }
}

mod finish {
    use super::*;

    #[tokio::test]
    async fn closes_the_open_pause_and_releases_the_unfinished_tasks_only() {
        let app = setup();
        let unfinished = app.create_task("unfinished").await;
        let done = app.create_task("done").await;
        let session = start(&app).await;
        app.tasks.complete(&done.id).await.unwrap();
        app.focus_sessions.pause(&session.id).await.unwrap();
        app.advance_clock(400);

        let finished = app.focus_sessions.finish(&session.id).await.unwrap();

        assert_eq!(finished.status, FocusSessionStatus::Finished);
        assert_eq!(finished.pauses[0].time, 400);
        assert_eq!(
            app.tasks
                .get(&unfinished.id)
                .await
                .unwrap()
                .focus_session_id,
            None
        );
        assert_eq!(
            app.tasks.get(&done.id).await.unwrap().focus_session_id,
            Some(session.id)
        );
    }

    #[tokio::test]
    async fn fails_with_not_found_for_an_unknown_id() {
        let app = setup();

        let result = app.focus_sessions.finish("unknown").await;

        assert_not_found(result, messages::FOCUS_SESSION_NOT_FOUND);
    }
}

mod finish_current {
    use super::*;

    #[tokio::test]
    async fn finishes_the_current_session() {
        let app = setup();
        let session = start(&app).await;

        let finished = app.focus_sessions.finish_current().await.unwrap();

        assert_eq!(
            (finished.id, finished.status),
            (session.id, FocusSessionStatus::Finished)
        );
    }

    #[tokio::test]
    async fn fails_when_no_session_is_current() {
        let app = setup();

        let result = app.focus_sessions.finish_current().await;

        assert_not_found(result, messages::NO_CURRENT_FOCUS_SESSION);
    }
}
