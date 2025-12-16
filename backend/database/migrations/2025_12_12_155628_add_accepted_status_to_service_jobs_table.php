<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * SQLite doesn't support ALTER TABLE to modify CHECK constraints,
     * so we need to recreate the table with the updated constraint.
     */
    public function up(): void
    {
        // For SQLite, we need to recreate the table
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('
                CREATE TABLE service_jobs_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    job_number VARCHAR NOT NULL UNIQUE,
                    order_id INTEGER NOT NULL,
                    order_item_id INTEGER NOT NULL,
                    status VARCHAR CHECK (status IN (\'PENDING\', \'ACCEPTED\', \'ASSIGNED\', \'IN_PROGRESS\', \'ON_HOLD\', \'QA_REVIEW\', \'COMPLETED\', \'REJECTED\')) NOT NULL DEFAULT \'PENDING\',
                    assigned_to INTEGER,
                    priority VARCHAR CHECK (priority IN (\'low\', \'normal\', \'high\', \'urgent\')) NOT NULL DEFAULT \'normal\',
                    due_date DATETIME,
                    started_at DATETIME,
                    completed_at DATETIME,
                    notes TEXT,
                    rework_count INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
                    FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL
                )
            ');
            
            // Copy data from old table to new table
            DB::statement('
                INSERT INTO service_jobs_new 
                SELECT * FROM service_jobs
            ');
            
            // Drop old table
            DB::statement('DROP TABLE service_jobs');
            
            // Rename new table
            DB::statement('ALTER TABLE service_jobs_new RENAME TO service_jobs');
            
            // Recreate indexes
            DB::statement('CREATE INDEX service_jobs_status_due_date_index ON service_jobs (status, due_date)');
            DB::statement('CREATE INDEX service_jobs_assigned_to_index ON service_jobs (assigned_to)');
            DB::statement('CREATE INDEX service_jobs_priority_index ON service_jobs (priority)');
        } else {
            // For other databases, we can use a simpler approach if needed
            // For now, this migration is SQLite-specific
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert to original constraint (without ACCEPTED)
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('
                CREATE TABLE service_jobs_old (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    job_number VARCHAR NOT NULL UNIQUE,
                    order_id INTEGER NOT NULL,
                    order_item_id INTEGER NOT NULL,
                    status VARCHAR CHECK (status IN (\'PENDING\', \'ASSIGNED\', \'IN_PROGRESS\', \'ON_HOLD\', \'QA_REVIEW\', \'COMPLETED\', \'REJECTED\')) NOT NULL DEFAULT \'PENDING\',
                    assigned_to INTEGER,
                    priority VARCHAR CHECK (priority IN (\'low\', \'normal\', \'high\', \'urgent\')) NOT NULL DEFAULT \'normal\',
                    due_date DATETIME,
                    started_at DATETIME,
                    completed_at DATETIME,
                    notes TEXT,
                    rework_count INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
                    FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL
                )
            ');
            
            DB::statement('
                INSERT INTO service_jobs_old 
                SELECT * FROM service_jobs
            ');
            
            DB::statement('DROP TABLE service_jobs');
            DB::statement('ALTER TABLE service_jobs_old RENAME TO service_jobs');
            
            DB::statement('CREATE INDEX service_jobs_status_due_date_index ON service_jobs (status, due_date)');
            DB::statement('CREATE INDEX service_jobs_assigned_to_index ON service_jobs (assigned_to)');
            DB::statement('CREATE INDEX service_jobs_priority_index ON service_jobs (priority)');
        }
    }
};
