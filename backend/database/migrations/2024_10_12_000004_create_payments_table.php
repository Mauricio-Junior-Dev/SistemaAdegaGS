<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 10, 2);
            $table->decimal('received_amount', 10, 2)->nullable();
            $table->decimal('change_amount', 10, 2)->nullable();
            $table->enum('payment_method', ['dinheiro', 'cartão de débito', 'cartão de crédito', 'pix']);
            $table->enum('status', ['pending', 'pending_pix', 'completed', 'failed', 'refunded', 'cancelled'])->default('pending');
            $table->string('transaction_id')->nullable();
            $table->text('qr_code')->nullable();
            $table->dateTime('expires_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};