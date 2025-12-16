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
     * Update orders table status constraint to match workflow:
     * Remove: CONFIRMED, QA, DELIVERED
     * Add: PAID, RELEASED
     */
    public function up(): void
    {
        // For SQLite, we need to recreate the table
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('
                CREATE TABLE orders_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    order_number VARCHAR NOT NULL UNIQUE,
                    customer_id INTEGER,
                    order_type VARCHAR CHECK (order_type IN (\'walk_in\', \'quotation\', \'invoice\')) NOT NULL DEFAULT \'walk_in\',
                    status VARCHAR CHECK (status IN (\'DRAFT\', \'PENDING_PAYMENT\', \'PAID\', \'IN_PRODUCTION\', \'READY\', \'RELEASED\', \'COMPLETED\', \'CANCELLED\')) NOT NULL DEFAULT \'DRAFT\',
                    subtotal NUMERIC NOT NULL DEFAULT 0,
                    discount NUMERIC NOT NULL DEFAULT 0,
                    tax NUMERIC NOT NULL DEFAULT 0,
                    total NUMERIC NOT NULL DEFAULT 0,
                    paid_amount NUMERIC NOT NULL DEFAULT 0,
                    balance NUMERIC NOT NULL DEFAULT 0,
                    payment_terms VARCHAR CHECK (payment_terms IN (\'immediate\', \'credit_30\', \'credit_60\')) NOT NULL DEFAULT \'immediate\',
                    notes TEXT,
                    created_by INTEGER,
                    approved_by INTEGER,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
                )
            ');
            
            // Map old statuses to new statuses
            // CONFIRMED -> PAID (if paid) or PENDING_PAYMENT (if not)
            // QA -> READY (production complete)
            // DELIVERED -> RELEASED
            DB::statement('
                INSERT INTO orders_new 
                SELECT 
                    id,
                    order_number,
                    customer_id,
                    order_type,
                    CASE 
                        WHEN status = \'CONFIRMED\' AND paid_amount > 0 THEN \'PAID\'
                        WHEN status = \'CONFIRMED\' AND paid_amount = 0 THEN \'PENDING_PAYMENT\'
                        WHEN status = \'QA\' THEN \'READY\'
                        WHEN status = \'DELIVERED\' THEN \'RELEASED\'
                        ELSE status
                    END as status,
                    subtotal,
                    discount,
                    tax,
                    total,
                    paid_amount,
                    balance,
                    payment_terms,
                    notes,
                    created_by,
                    approved_by,
                    created_at,
                    updated_at
                FROM orders
            ');
            
            // Drop old table
            DB::statement('DROP TABLE orders');
            
            // Rename new table
            DB::statement('ALTER TABLE orders_new RENAME TO orders');
            
            // Recreate indexes
            DB::statement('CREATE INDEX orders_status_created_at_index ON orders (status, created_at)');
            DB::statement('CREATE INDEX orders_customer_id_index ON orders (customer_id)');
            DB::statement('CREATE INDEX orders_order_number_index ON orders (order_number)');
        } else {
            // For other databases, use ALTER TABLE
            // Note: This is a simplified version - full implementation would need to handle constraints
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('
                CREATE TABLE orders_old (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    order_number VARCHAR NOT NULL UNIQUE,
                    customer_id INTEGER,
                    order_type VARCHAR CHECK (order_type IN (\'walk_in\', \'quotation\', \'invoice\')) NOT NULL DEFAULT \'walk_in\',
                    status VARCHAR CHECK (status IN (\'DRAFT\', \'PENDING_PAYMENT\', \'CONFIRMED\', \'IN_PRODUCTION\', \'QA\', \'READY\', \'DELIVERED\', \'COMPLETED\', \'CANCELLED\')) NOT NULL DEFAULT \'DRAFT\',
                    subtotal NUMERIC NOT NULL DEFAULT 0,
                    discount NUMERIC NOT NULL DEFAULT 0,
                    tax NUMERIC NOT NULL DEFAULT 0,
                    total NUMERIC NOT NULL DEFAULT 0,
                    paid_amount NUMERIC NOT NULL DEFAULT 0,
                    balance NUMERIC NOT NULL DEFAULT 0,
                    payment_terms VARCHAR CHECK (payment_terms IN (\'immediate\', \'credit_30\', \'credit_60\')) NOT NULL DEFAULT \'immediate\',
                    notes TEXT,
                    created_by INTEGER,
                    approved_by INTEGER,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
                )
            ');
            
            // Reverse mapping
            DB::statement('
                INSERT INTO orders_old 
                SELECT 
                    id,
                    order_number,
                    customer_id,
                    order_type,
                    CASE 
                        WHEN status = \'PAID\' THEN \'CONFIRMED\'
                        WHEN status = \'RELEASED\' THEN \'DELIVERED\'
                        WHEN status = \'READY\' AND EXISTS (SELECT 1 FROM service_jobs WHERE order_id = orders.id AND status = \'COMPLETED\') THEN \'QA\'
                        ELSE status
                    END as status,
                    subtotal,
                    discount,
                    tax,
                    total,
                    paid_amount,
                    balance,
                    payment_terms,
                    notes,
                    created_by,
                    approved_by,
                    created_at,
                    updated_at
                FROM orders
            ');
            
            DB::statement('DROP TABLE orders');
            DB::statement('ALTER TABLE orders_old RENAME TO orders');
            
            DB::statement('CREATE INDEX orders_status_created_at_index ON orders (status, created_at)');
            DB::statement('CREATE INDEX orders_customer_id_index ON orders (customer_id)');
            DB::statement('CREATE INDEX orders_order_number_index ON orders (order_number)');
        }
    }
};
