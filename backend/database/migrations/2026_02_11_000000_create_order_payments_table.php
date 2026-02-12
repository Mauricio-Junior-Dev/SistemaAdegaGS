<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabela auxiliar para Pagamentos Múltiplos (Split Payment) no PDV.
     * A tabela orders e a coluna total permanecem inalteradas (backward compatibility com E-commerce).
     */
    public function up(): void
    {
        Schema::create('order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->onDelete('cascade');
            $table->enum('payment_method', ['money', 'pix', 'credit_card', 'debit_card']);
            $table->decimal('amount', 10, 2);
            $table->decimal('change', 10, 2)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_payments');
    }
};
