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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->decimal('original_price', 10, 2)->nullable();
            $table->decimal('cost_price', 10, 2);
            
            // Campos de estoque
            $table->integer('current_stock')->default(0);
            $table->integer('min_stock')->default(5);
            
            // Campos de dose (consolidados)
            $table->integer('doses_por_garrafa')->default(5);
            $table->integer('doses_vendidas')->default(0);
            $table->boolean('can_sell_by_dose')->default(false);
            $table->decimal('dose_price', 10, 2)->nullable();
            
            $table->string('sku')->unique();
            $table->string('barcode')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('visible_online')->default(true);
            $table->boolean('featured')->default(false);
            $table->boolean('offers')->default(false);
            $table->boolean('popular')->default(false);
            $table->string('image_url')->nullable();
            $table->json('images')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
