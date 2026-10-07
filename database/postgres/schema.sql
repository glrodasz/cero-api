-- Reference schema shared by every Postgres-backed stack.
--
-- Each stack applies it with its own migration tool (goose, sqlx, Alembic,
-- Supabase migrations); Laravel and Phoenix express the same shape with their
-- native migrations. Keep this file and those migrations in sync.
--
-- Times are epoch milliseconds (bigint) because that is what the API speaks.

CREATE TABLE focus_sessions (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    status      text        NOT NULL CHECK (status IN ('active', 'paused', 'finished')),
    start_time  bigint      NOT NULL,
    -- Snapshot of the task ids the session started with.
    task_ids    uuid[]      NOT NULL DEFAULT '{}',
    -- Pauses are values owned by their session: [{id, startTime, endTime, time}].
    pauses      jsonb       NOT NULL DEFAULT '[]',
    created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- "The current session" is the newest active or paused one.
CREATE INDEX focus_sessions_current_idx
    ON focus_sessions (created_at DESC)
    WHERE status IN ('active', 'paused');

CREATE TABLE tasks (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    description       text        NOT NULL,
    priority          integer     NOT NULL DEFAULT 0,
    status            text        NOT NULL CHECK (status IN ('in-progress', 'pending', 'completed')),
    focus_session_id  uuid        NULL REFERENCES focus_sessions (id) ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX tasks_status_priority_idx ON tasks (status, priority, created_at);
CREATE INDEX tasks_focus_session_priority_idx ON tasks (focus_session_id, priority, created_at);
