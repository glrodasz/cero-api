-- The reference schema (database/postgres/schema.sql), applied by
-- `supabase start` / `supabase db reset` and, for a hosted project, `supabase db push`.
-- Keep the two in sync.
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

-- PostgREST publishes every table in `public` to anyone holding the anon key.
-- Row Level Security without a single policy denies every row to the anon and
-- authenticated roles; only the service role, which bypasses RLS, gets through.
-- The Edge Function holds that key, so it is the only way in.
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
