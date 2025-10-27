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
        Schema::create('combo_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('combo_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->integer('quantity')->default(1);
            $table->string('sale_type')->default('garrafa'); // 'garrafa' ou 'dose'
            $table->timestamps();
            
            $table->unique(['combo_id', 'product_id', 'sale_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('combo_products');
    }
};
