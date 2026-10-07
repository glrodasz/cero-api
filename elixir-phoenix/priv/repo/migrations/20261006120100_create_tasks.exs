defmodule Cero.Repo.Migrations.CreateTasks do
  use Ecto.Migration

  # Mirrors database/postgres/schema.sql; Ecto names the creation timestamp inserted_at.
  def change do
    create table(:tasks, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")
      add :description, :text, null: false
      add :priority, :integer, null: false, default: 0
      add :status, :text, null: false

      add :focus_session_id,
          references(:focus_sessions, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :timestamptz, updated_at: false, default: fragment("clock_timestamp()"))
    end

    create constraint(:tasks, :tasks_status_check,
             check: "status IN ('in-progress', 'pending', 'completed')"
           )

    create index(:tasks, [:status, :priority, :inserted_at], name: :tasks_status_priority_idx)

    create index(:tasks, [:focus_session_id, :priority, :inserted_at],
             name: :tasks_focus_session_priority_idx
           )
  end
end
