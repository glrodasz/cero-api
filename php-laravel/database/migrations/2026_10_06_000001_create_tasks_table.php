<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Mirrors database/postgres/schema.sql.

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('description');
            $table->integer('priority')->default(0);
            // On Postgres, enum() is a varchar with a CHECK constraint.
            $table->enum('status', ['in-progress', 'pending', 'completed']);
            $table->foreignUuid('focus_session_id')->nullable()->constrained()->nullOnDelete();
            $table->timestampTz('created_at', precision: 6)->default(new Expression('clock_timestamp()'));

            $table->index(['status', 'priority', 'created_at'], 'tasks_status_priority_idx');
            $table->index(['focus_session_id', 'priority', 'created_at'], 'tasks_focus_session_priority_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
