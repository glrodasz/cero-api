defmodule Cero.Repo.Migrations.CreateFocusSessions do
  use Ecto.Migration

  # Mirrors database/postgres/schema.sql; Ecto names the creation timestamp inserted_at.
  def change do
    create table(:focus_sessions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      add :status, :text, null: false
      # Epoch milliseconds, as the API speaks.
      add :start_time, :bigint, null: false
      # Snapshot of the task ids the session started with.
      add :task_ids, {:array, :binary_id}, null: false, default: []
      # Pauses are values owned by their session: [{id, startTime, endTime, time}].
      add :pauses, :jsonb, null: false, default: fragment("'[]'::jsonb")

      timestamps(type: :timestamptz, updated_at: false, default: fragment("clock_timestamp()"))
    end

    create constraint(:focus_sessions, :focus_sessions_status_check,
             check: "status IN ('active', 'paused', 'finished')"
           )

    # "The current session" is the newest active or paused one.
    create index(:focus_sessions, ["inserted_at DESC"],
             name: :focus_sessions_current_idx,
             where: "status IN ('active', 'paused')"
           )
  end
end
