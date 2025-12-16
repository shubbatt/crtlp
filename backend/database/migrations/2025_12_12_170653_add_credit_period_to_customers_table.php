<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Add credit_period_days to customers table for customizable credit terms
     */
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->integer('credit_period_days')->nullable()->after('credit_limit');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('credit_period_days');
        });
    }
};
