<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add outlet_id to orders
        if (Schema::hasTable('orders') && !Schema::hasColumn('orders', 'outlet_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->unsignedBigInteger('outlet_id')->nullable()->after('id');
                $table->foreign('outlet_id')->references('id')->on('outlets')->onDelete('cascade');
            });
        }

        // Add outlet_id to invoices
        if (Schema::hasTable('invoices') && !Schema::hasColumn('invoices', 'outlet_id')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->unsignedBigInteger('outlet_id')->nullable()->after('id');
                $table->foreign('outlet_id')->references('id')->on('outlets')->onDelete('cascade');
            });
        }

        // Note: Users don't have outlet_id since staff rotate between outlets
        // The outlet selection happens at login time and is stored in session
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('orders', 'outlet_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropForeign(['outlet_id']);
                $table->dropColumn('outlet_id');
            });
        }

        if (Schema::hasColumn('invoices', 'outlet_id')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropForeign(['outlet_id']);
                $table->dropColumn('outlet_id');
            });
        }
    }
};
