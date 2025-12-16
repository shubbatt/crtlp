<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Make customer_id nullable in payments table to support walk-in orders
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // SQLite doesn't support ALTER COLUMN, need to recreate table
            DB::statement('
                CREATE TABLE payments_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    payment_number VARCHAR NOT NULL UNIQUE,
                    invoice_id INTEGER,
                    order_id INTEGER,
                    customer_id INTEGER,
                    amount NUMERIC NOT NULL,
                    payment_method VARCHAR CHECK (payment_method IN (\'cash\', \'card\', \'bank_transfer\', \'credit\')) NOT NULL DEFAULT \'cash\',
                    reference_number VARCHAR,
                    received_by INTEGER NOT NULL,
                    payment_date DATETIME NOT NULL,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    FOREIGN KEY(received_by) REFERENCES users(id) ON DELETE CASCADE
                )
            ');
            
            // Copy existing data
            DB::statement('INSERT INTO payments_new SELECT * FROM payments');
            
            // Drop old table and rename
            DB::statement('DROP TABLE payments');
            DB::statement('ALTER TABLE payments_new RENAME TO payments');
            
            // Recreate indexes
            DB::statement('CREATE INDEX payments_customer_id_payment_date_index ON payments (customer_id, payment_date)');
            DB::statement('CREATE INDEX payments_payment_number_index ON payments (payment_number)');
        } else {
            // For other databases, use ALTER TABLE
            Schema::table('payments', function (Blueprint $table) {
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
            // Revert to non-nullable
            DB::statement('
                CREATE TABLE payments_old (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    payment_number VARCHAR NOT NULL UNIQUE,
                    invoice_id INTEGER,
                    order_id INTEGER,
                    customer_id INTEGER NOT NULL,
                    amount NUMERIC NOT NULL,
                    payment_method VARCHAR CHECK (payment_method IN (\'cash\', \'card\', \'bank_transfer\', \'credit\')) NOT NULL DEFAULT \'cash\',
                    reference_number VARCHAR,
                    received_by INTEGER NOT NULL,
                    payment_date DATETIME NOT NULL,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
                    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    FOREIGN KEY(received_by) REFERENCES users(id) ON DELETE CASCADE
                )
            ');
            
            // Only copy payments that have customer_id
            DB::statement('INSERT INTO payments_old SELECT * FROM payments WHERE customer_id IS NOT NULL');
            
            DB::statement('DROP TABLE payments');
            DB::statement('ALTER TABLE payments_old RENAME TO payments');
            
            DB::statement('CREATE INDEX payments_customer_id_payment_date_index ON payments (customer_id, payment_date)');
            DB::statement('CREATE INDEX payments_payment_number_index ON payments (payment_number)');
        } else {
            Schema::table('payments', function (Blueprint $table) {
                $table->foreignId('customer_id')->nullable(false)->change();
            });
        }
    }
};
