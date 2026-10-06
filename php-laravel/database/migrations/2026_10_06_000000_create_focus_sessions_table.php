<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Mirrors database/postgres/schema.sql. Times are epoch milliseconds (bigint)
// because that is what the API speaks.

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('focus_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // On Postgres, enum() is a varchar with a CHECK constraint.
            $table->enum('status', ['active', 'paused', 'finished']);
            $table->bigInteger('start_time');
            // Snapshot of the task ids the session started with.
            $table->jsonb('task_ids')->default('[]');
            // Pauses are values owned by their session: [{id, startTime, endTime, time}].
            $table->jsonb('pauses')->default('[]');
            // Microseconds, and clock_timestamp() rather than now(), keep creation
            // order exact even for rows inserted by one transaction.
            $table->timestampTz('created_at', precision: 6)->default(new Expression('clock_timestamp()'));
        });

        // "The current session" is the newest active or paused one. The schema
        // builder has no partial indexes, so this one is written in SQL.
        DB::statement(<<<'SQL'
            CREATE INDEX focus_sessions_current_idx
                ON focus_sessions (created_at DESC)
                WHERE status IN ('active', 'paused')
            SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('focus_sessions');
    }
};
