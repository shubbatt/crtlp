<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = DB::getDriverName();
        
        if ($driver === 'sqlite') {
            // SQLite doesn't support ALTER COLUMN for enum, need to recreate
            DB::statement('
                CREATE TABLE service_jobs_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    job_number VARCHAR NOT NULL UNIQUE,
                    order_id INTEGER NOT NULL,
                    order_item_id INTEGER NOT NULL,
                    status VARCHAR CHECK (status IN (\'PENDING\', \'ACCEPTED\', \'ASSIGNED\', \'IN_PROGRESS\', \'ON_HOLD\', \'QA_REVIEW\', \'COMPLETED\', \'REJECTED\', \'CANCELLED\')) NOT NULL DEFAULT \'PENDING\',
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
            
            // Copy data
            DB::statement('INSERT INTO service_jobs_new SELECT * FROM service_jobs');
            
            // Drop old and rename
            DB::statement('DROP TABLE service_jobs');
            DB::statement('ALTER TABLE service_jobs_new RENAME TO service_jobs');
            
            // Recreate indexes
            DB::statement('CREATE INDEX service_jobs_status_due_date_index ON service_jobs (status, due_date)');
            DB::statement('CREATE INDEX service_jobs_assigned_to_index ON service_jobs (assigned_to)');
            DB::statement('CREATE INDEX service_jobs_priority_index ON service_jobs (priority)');
        } elseif ($driver === 'pgsql') {
            // PostgreSQL: Drop constraint, add new constraint with CANCELLED
            // First drop any existing check constraint
            DB::statement("ALTER TABLE service_jobs DROP CONSTRAINT IF EXISTS service_jobs_status_check");
            // Add new constraint including CANCELLED
            DB::statement("ALTER TABLE service_jobs ADD CONSTRAINT service_jobs_status_check CHECK (status::text = ANY (ARRAY['PENDING'::text, 'ACCEPTED'::text, 'ASSIGNED'::text, 'IN_PROGRESS'::text, 'ON_HOLD'::text, 'QA_REVIEW'::text, 'COMPLETED'::text, 'REJECTED'::text, 'CANCELLED'::text]))");
        } else {
            // For MySQL, use MODIFY with ENUM
            DB::statement("ALTER TABLE service_jobs MODIFY COLUMN status ENUM('PENDING', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'QA_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED') DEFAULT 'PENDING'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // Revert to original enum
            DB::statement('
                CREATE TABLE service_jobs_old (
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
            
            // Only copy non-cancelled jobs
            DB::statement('INSERT INTO service_jobs_old SELECT * FROM service_jobs WHERE status != \'CANCELLED\'');
            
            DB::statement('DROP TABLE service_jobs');
            DB::statement('ALTER TABLE service_jobs_old RENAME TO service_jobs');
            
            // Recreate indexes
            DB::statement('CREATE INDEX service_jobs_status_due_date_index ON service_jobs (status, due_date)');
            DB::statement('CREATE INDEX service_jobs_assigned_to_index ON service_jobs (assigned_to)');
            DB::statement('CREATE INDEX service_jobs_priority_index ON service_jobs (priority)');
        } elseif (DB::getDriverName() === 'pgsql') {
            // PostgreSQL: revert constraint
            DB::statement("ALTER TABLE service_jobs DROP CONSTRAINT IF EXISTS service_jobs_status_check");
            DB::statement("ALTER TABLE service_jobs ADD CONSTRAINT service_jobs_status_check CHECK (status::text = ANY (ARRAY['PENDING'::text, 'ACCEPTED'::text, 'ASSIGNED'::text, 'IN_PROGRESS'::text, 'ON_HOLD'::text, 'QA_REVIEW'::text, 'COMPLETED'::text, 'REJECTED'::text]))");
        } else {
            DB::statement("ALTER TABLE service_jobs MODIFY COLUMN status ENUM('PENDING', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'QA_REVIEW', 'COMPLETED', 'REJECTED') DEFAULT 'PENDING'");
        }
    }
};
