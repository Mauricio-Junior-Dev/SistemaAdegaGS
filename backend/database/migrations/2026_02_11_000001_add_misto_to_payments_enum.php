c<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Adiciona 'misto' ao enum payment_method para suportar Pagamentos Múltiplos (PDV).
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE payments MODIFY COLUMN payment_method ENUM('dinheiro', 'cartão de débito', 'cartão de crédito', 'pix', 'misto')");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE payments MODIFY COLUMN payment_method ENUM('dinheiro', 'cartão de débito', 'cartão de crédito', 'pix')");
    }
};
