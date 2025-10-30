<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cash_session_id');
            $table->enum('type', ['entrada', 'saida']);
            $table->decimal('amount', 10, 2);
            $table->string('description', 255);
            $table->unsignedBigInteger('created_by');
            $table->timestamps();

            $table->foreign('cash_session_id')->references('id')->on('cash_sessions')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_transactions');
    }
};


