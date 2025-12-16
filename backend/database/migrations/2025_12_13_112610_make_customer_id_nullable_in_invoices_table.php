<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Make customer_id nullable in invoices table to support walk-in orders
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // SQLite doesn't support ALTER COLUMN, need to recreate table
            // Drop temp table if it exists from previous failed migration
            DB::statement('DROP TABLE IF EXISTS invoices_new');
            
            // Create new table with nullable customer_id
            DB::statement('
                CREATE TABLE invoices_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    invoice_number VARCHAR NOT NULL UNIQUE,
                    order_id INTEGER,
                    customer_id INTEGER,
                    status VARCHAR CHECK (status IN (\'draft\', \'issued\', \'partial\', \'paid\', \'overdue\', \'disputed\')) NOT NULL DEFAULT \'draft\',
                    subtotal NUMERIC NOT NULL,
                    discount NUMERIC NOT NULL DEFAULT 0,
                    tax NUMERIC NOT NULL,
                    total NUMERIC NOT NULL,
                    paid_amount NUMERIC NOT NULL DEFAULT 0,
                    balance NUMERIC NOT NULL,
                    issue_date DATETIME,
                    due_date DATETIME,
                    created_at DATETIME,
                    updated_at DATETIME,
                    purchase_order_number VARCHAR,
                    outlet_id INTEGER,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    FOREIGN KEY(outlet_id) REFERENCES outlets(id) ON DELETE SET NULL
                )
            ');
            
            // Copy existing data - explicitly list all columns in the order they appear in the old table
            DB::statement('
                INSERT INTO invoices_new (
                    id, invoice_number, order_id, customer_id, status, subtotal, discount, tax, 
                    total, paid_amount, balance, issue_date, due_date, created_at, updated_at,
                    purchase_order_number, outlet_id
                )
                SELECT 
                    id, invoice_number, order_id, customer_id, status, subtotal, discount, tax,
                    total, paid_amount, balance, issue_date, due_date, created_at, updated_at,
                    purchase_order_number, outlet_id
                FROM invoices
            ');
            
            // Drop old table and rename
            DB::statement('DROP TABLE invoices');
            DB::statement('ALTER TABLE invoices_new RENAME TO invoices');
            
            // Recreate indexes
            DB::statement('CREATE INDEX invoices_status_due_date_index ON invoices (status, due_date)');
            DB::statement('CREATE INDEX invoices_customer_id_index ON invoices (customer_id)');
            DB::statement('CREATE INDEX invoices_invoice_number_index ON invoices (invoice_number)');
        } else {
            // For other databases, use ALTER TABLE
            Schema::table('invoices', function (Blueprint $table) {
                $table->foreignId('customer_id')->nullable()->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // Revert to non-nullable (only if no NULL values exist)
            DB::statement('DROP TABLE IF EXISTS invoices_old');
            
            DB::statement('
                CREATE TABLE invoices_old (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    invoice_number VARCHAR NOT NULL UNIQUE,
                    order_id INTEGER,
                    customer_id INTEGER NOT NULL,
                    status VARCHAR CHECK (status IN (\'draft\', \'issued\', \'partial\', \'paid\', \'overdue\', \'disputed\')) NOT NULL DEFAULT \'draft\',
                    subtotal NUMERIC NOT NULL,
                    discount NUMERIC NOT NULL DEFAULT 0,
                    tax NUMERIC NOT NULL,
                    total NUMERIC NOT NULL,
                    paid_amount NUMERIC NOT NULL DEFAULT 0,
                    balance NUMERIC NOT NULL,
                    issue_date DATETIME,
                    due_date DATETIME,
                    created_at DATETIME,
                    updated_at DATETIME,
                    purchase_order_number VARCHAR,
                    outlet_id INTEGER,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    FOREIGN KEY(outlet_id) REFERENCES outlets(id) ON DELETE SET NULL
                )
            ');
            
            // Only copy invoices with customer_id (exclude NULL values)
            DB::statement('
                INSERT INTO invoices_old (
                    id, invoice_number, order_id, customer_id, status, subtotal, discount, tax,
                    total, paid_amount, balance, issue_date, due_date, created_at, updated_at,
                    purchase_order_number, outlet_id
                )
                SELECT 
                    id, invoice_number, order_id, customer_id, status, subtotal, discount, tax,
                    total, paid_amount, balance, issue_date, due_date, created_at, updated_at,
                    purchase_order_number, outlet_id
                FROM invoices 
                WHERE customer_id IS NOT NULL
            ');
            
            DB::statement('DROP TABLE invoices');
            DB::statement('ALTER TABLE invoices_old RENAME TO invoices');
            
            // Recreate indexes
            DB::statement('CREATE INDEX invoices_status_due_date_index ON invoices (status, due_date)');
            DB::statement('CREATE INDEX invoices_customer_id_index ON invoices (customer_id)');
            DB::statement('CREATE INDEX invoices_invoice_number_index ON invoices (invoice_number)');
        } else {
            Schema::table('invoices', function (Blueprint $table) {
                $table->foreignId('customer_id')->nullable(false)->change();
            });
        }
    }
};
