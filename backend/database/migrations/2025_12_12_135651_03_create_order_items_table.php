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
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->nullable()->constrained()->onDelete('set null');
            $table->enum('item_type', ['inventory', 'service', 'dimension']);
            $table->text('description');
            $table->integer('quantity')->default(1);
            $table->json('dimensions')->nullable(); // {width, height, unit}
            $table->decimal('unit_price', 10, 2);
            $table->decimal('line_total', 10, 2);
            $table->foreignId('pricing_rule_id')->nullable()->constrained()->onDelete('set null');
            $table->text('override_reason')->nullable();
            $table->timestamps();
            
            $table->index('order_id');
            $table->index('product_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
