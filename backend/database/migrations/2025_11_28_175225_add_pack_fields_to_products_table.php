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
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('parent_product_id')->nullable()->after('category_id')->constrained('products')->onDelete('set null');
            $table->integer('stock_multiplier')->default(1)->after('parent_product_id');
            
            // Índice para melhor performance em consultas
            $table->index('parent_product_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['parent_product_id']);
            $table->dropIndex(['parent_product_id']);
            $table->dropColumn(['parent_product_id', 'stock_multiplier']);
        });
    }
};
