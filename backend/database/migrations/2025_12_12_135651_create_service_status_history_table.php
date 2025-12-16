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
        Schema::create('service_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_job_id')->constrained()->onDelete('cascade');
            $table->string('from_status')->nullable(); // Allow NULL for initial status
            $table->string('to_status');
            $table->foreignId('changed_by')->nullable()->constrained('users')->onDelete('cascade');
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
            
            $table->index(['service_job_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_status_history');
    }
};
