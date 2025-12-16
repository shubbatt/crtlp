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
        if (Schema::hasTable('quotations') && !Schema::hasColumn('quotations', 'outlet_id')) {
            Schema::table('quotations', function (Blueprint $table) {
                $table->unsignedBigInteger('outlet_id')->nullable()->after('id');
                $table->foreign('outlet_id')->references('id')->on('outlets')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('quotations', 'outlet_id')) {
            Schema::table('quotations', function (Blueprint $table) {
                $table->dropForeign(['outlet_id']);
                $table->dropColumn('outlet_id');
            });
        }
    }
};
